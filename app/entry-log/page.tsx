"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TimeEntry, Profile } from "@/lib/supabase";
import { useRouter } from "next/navigation";

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDurationDecimal(seconds: number | null) {
  if (!seconds) return "0.00";
  return (seconds / 3600).toFixed(2);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function formatDateCSV(iso: string) {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 19);
}

type ViewMode = "detail" | "summary";

type SummaryRow = {
  department: string;
  role: string;
  category: string;
  taskName: string;
  entryCount: number;
  totalSeconds: number;
  owners: string[];
};

export default function EntryLog() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("detail");

  // Filters
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterTask, setFilterTask] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Check auth + admin on mount
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);
      setAuthLoading(false);
    };
    checkAuth();
  }, [router]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/entries");
      const data = await res.json();
      if (Array.isArray(data)) setEntries(data);
    } catch {
      console.error("Failed to fetch entries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && profile?.is_admin) fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, profile]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    setDeleteId(id);
    try {
      await fetch(`/api/entries/${id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      alert("Failed to delete entry.");
    } finally {
      setDeleteId(null);
    }
  };

  // Unique filter values from loaded entries
  const depts = Array.from(new Set(entries.map((e) => e.department))).sort();
  const roles = Array.from(new Set(entries.map((e) => e.role))).sort();
  const owners = Array.from(new Set(entries.map((e) => e.task_owner))).sort();
  const categories = Array.from(new Set(entries.map((e) => e.task_category))).sort();
  const taskNames = Array.from(new Set(entries.map((e) => e.task_name))).sort();

  // Cascading: filter task names based on selected category
  const filteredTaskNames = filterCategory
    ? Array.from(new Set(entries.filter((e) => e.task_category === filterCategory).map((e) => e.task_name))).sort()
    : taskNames;

  // Apply filters
  const filtered = useMemo(() => entries.filter((e) => {
    if (filterDept && e.department !== filterDept) return false;
    if (filterRole && e.role !== filterRole) return false;
    if (filterOwner && e.task_owner !== filterOwner) return false;
    if (filterCategory && e.task_category !== filterCategory) return false;
    if (filterTask && e.task_name !== filterTask) return false;
    if (filterDateFrom) {
      const entryDate = e.created_at.slice(0, 10);
      if (entryDate < filterDateFrom) return false;
    }
    if (filterDateTo) {
      const entryDate = e.created_at.slice(0, 10);
      if (entryDate > filterDateTo) return false;
    }
    return true;
  }), [entries, filterDept, filterRole, filterOwner, filterCategory, filterTask, filterDateFrom, filterDateTo]);

  const totalTime = filtered.reduce((sum, e) => sum + (e.duration_seconds || 0), 0);

  // Summary data: group by dept > role > category > task
  const summaryRows: SummaryRow[] = useMemo(() => {
    const map = new Map<string, SummaryRow>();
    for (const e of filtered) {
      const key = `${e.department}||${e.role}||${e.task_category}||${e.task_name}`;
      const existing = map.get(key);
      if (existing) {
        existing.entryCount++;
        existing.totalSeconds += e.duration_seconds || 0;
        if (!existing.owners.includes(e.task_owner)) existing.owners.push(e.task_owner);
      } else {
        map.set(key, {
          department: e.department,
          role: e.role,
          category: e.task_category,
          taskName: e.task_name,
          entryCount: 1,
          totalSeconds: e.duration_seconds || 0,
          owners: [e.task_owner],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.department.localeCompare(b.department) ||
      a.role.localeCompare(b.role) ||
      a.category.localeCompare(b.category) ||
      a.taskName.localeCompare(b.taskName)
    );
  }, [filtered]);

  if (authLoading) {
    return <div className="text-center py-16 text-gray-400">Loading...</div>;
  }

  if (!profile?.is_admin) {
    return (
      <div className="max-w-sm mx-auto mt-20 text-center">
        <p className="text-gray-500 text-lg">Access Denied</p>
        <p className="text-gray-400 text-sm mt-2">
          You need admin access to view the Entry Log.
        </p>
      </div>
    );
  }

  // --- CSV Export ---
  const escapeCSV = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const exportDetailCSV = () => {
    const headers = ["Date", "Owner", "Department", "Role", "Category", "Task", "PO #", "SO #", "Quote #", "Order Type", "# of Line Items", "Duration (seconds)", "Duration (minutes)", "Duration (hours)", "Notes"];
    const rows = filtered.map((e) => [
      formatDateCSV(e.created_at),
      e.task_owner,
      e.department,
      e.role,
      e.task_category,
      e.task_name,
      e.po_number || "",
      e.so_number || "",
      e.quote_number || "",
      e.order_type || "",
      e.line_item_count != null ? String(e.line_item_count) : "",
      String(e.duration_seconds || 0),
      ((e.duration_seconds || 0) / 60).toFixed(2),
      formatDurationDecimal(e.duration_seconds),
      e.notes || "",
    ]);

    const csv = [headers, ...rows].map((row) => row.map(escapeCSV).join(",")).join("\n");
    downloadCSV(csv, "time-entries-detail.csv");
  };

  const exportSummaryCSV = () => {
    const headers = ["Department", "Role", "Category", "Task", "Entries", "Total Duration (seconds)", "Total Duration (minutes)", "Total Duration (hours)", "Owners"];
    const rows = summaryRows.map((r) => [
      r.department,
      r.role,
      r.category,
      r.taskName,
      String(r.entryCount),
      String(r.totalSeconds),
      (r.totalSeconds / 60).toFixed(2),
      formatDurationDecimal(r.totalSeconds),
      r.owners.join("; "),
    ]);

    // Add totals row
    const totalEntries = summaryRows.reduce((s, r) => s + r.entryCount, 0);
    const totalSec = summaryRows.reduce((s, r) => s + r.totalSeconds, 0);
    rows.push(["TOTAL", "", "", "", String(totalEntries), String(totalSec), (totalSec / 60).toFixed(2), formatDurationDecimal(totalSec), ""]);

    const csv = [headers, ...rows].map((row) => row.map(escapeCSV).join(",")).join("\n");
    downloadCSV(csv, "time-entries-summary.csv");
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setFilterDept("");
    setFilterRole("");
    setFilterOwner("");
    setFilterCategory("");
    setFilterTask("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const hasActiveFilters = filterDept || filterRole || filterOwner || filterCategory || filterTask || filterDateFrom || filterDateTo;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A3C28]">Entry Log</h1>
        <span className="text-sm text-gray-500">
          {filtered.length} entries · {formatDuration(totalTime)} total
          {hasActiveFilters && <span className="text-amber-600 ml-1">(filtered)</span>}
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]">
            <option value="">All Departments</option>
            {depts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]">
            <option value="">All Roles</option>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setFilterTask(""); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]">
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterTask} onChange={(e) => setFilterTask(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]">
            <option value="">All Tasks</option>
            {filteredTaskNames.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]">
            <option value="">All Owners</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]"
              placeholder="From" />
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]"
              placeholder="To" />
          </div>
          <div className="flex items-center">
            {hasActiveFilters && (
              <button onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700 underline">
                Clear all filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Action bar: view toggle + buttons */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode("detail")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "detail" ? "bg-white text-[#1A3C28] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Detail View
          </button>
          <button
            onClick={() => setViewMode("summary")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "summary" ? "bg-white text-[#1A3C28] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Summary View
          </button>
        </div>

        <div className="flex gap-2">
          <button onClick={fetchEntries}
            className="px-4 py-2 bg-[#1A3C28] text-white text-sm rounded-lg hover:bg-[#122B1C] transition-colors">
            Refresh
          </button>
          <button
            onClick={viewMode === "detail" ? exportDetailCSV : exportSummaryCSV}
            disabled={filtered.length === 0}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading entries...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No entries found.</div>
      ) : viewMode === "detail" ? (
        /* ===== DETAIL VIEW ===== */
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Dept</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">PO #</th>
                <th className="px-4 py-3">SO #</th>
                <th className="px-4 py-3">Quote #</th>
                <th className="px-4 py-3">Order Type</th>
                <th className="px-4 py-3">Line Items</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">{formatDate(entry.created_at)}</td>
                  <td className="px-4 py-3 font-medium">{entry.task_owner}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.department}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.role}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.task_category}</td>
                  <td className="px-4 py-3 font-medium text-[#1A3C28]">{entry.task_name}</td>
                  <td className="px-4 py-3 text-gray-500">{entry.po_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{entry.so_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{entry.quote_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{entry.order_type || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{entry.line_item_count != null ? entry.line_item_count : "—"}</td>
                  <td className="px-4 py-3 font-mono text-green-700 font-semibold">{formatDuration(entry.duration_seconds)}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{entry.notes || "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(entry.id)} disabled={deleteId === entry.id}
                      className="text-red-500 hover:text-red-700 text-xs font-medium disabled:opacity-40">
                      {deleteId === entry.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold text-sm">
                <td className="px-4 py-3 text-gray-600" colSpan={11}>
                  Total ({filtered.length} entries)
                </td>
                <td className="px-4 py-3 font-mono text-green-700">{formatDuration(totalTime)}</td>
                <td colSpan={2} className="px-4 py-3 text-gray-400 text-xs">
                  {formatDurationDecimal(totalTime)} hrs
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        /* ===== SUMMARY VIEW ===== */
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3 text-right">Entries</th>
                <th className="px-4 py-3 text-right">Total Time</th>
                <th className="px-4 py-3 text-right">Hours</th>
                <th className="px-4 py-3">Owners</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summaryRows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{row.department}</td>
                  <td className="px-4 py-3 text-gray-600">{row.role}</td>
                  <td className="px-4 py-3 text-gray-600">{row.category}</td>
                  <td className="px-4 py-3 font-medium text-[#1A3C28]">{row.taskName}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{row.entryCount}</td>
                  <td className="px-4 py-3 text-right font-mono text-green-700 font-semibold">{formatDuration(row.totalSeconds)}</td>
                  <td className="px-4 py-3 text-right text-gray-500 font-mono">{formatDurationDecimal(row.totalSeconds)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{row.owners.join(", ")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold text-sm">
                <td className="px-4 py-3 text-gray-600" colSpan={4}>
                  Total ({summaryRows.length} groups, {filtered.length} entries)
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{filtered.length}</td>
                <td className="px-4 py-3 text-right font-mono text-green-700">{formatDuration(totalTime)}</td>
                <td className="px-4 py-3 text-right text-gray-500 font-mono">{formatDurationDecimal(totalTime)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
