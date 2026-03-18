"use client";

import { useState, useEffect } from "react";
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function EntryLog() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filters
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Check auth + admin on mount
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(data);
      setAuthLoading(false);
    };
    checkAuth();
  }, [router]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterDept) params.set("department", filterDept);
      if (filterRole) params.set("role", filterRole);
      if (filterOwner) params.set("task_owner", filterOwner);
      if (filterDate) params.set("date", filterDate);

      const res = await fetch(`/api/entries?${params.toString()}`);
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

  if (authLoading) {
    return <div className="text-center py-16 text-gray-400">Loading…</div>;
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

  // Unique filter values from loaded entries
  const depts = Array.from(new Set(entries.map((e) => e.department))).sort();
  const roles = Array.from(new Set(entries.map((e) => e.role))).sort();
  const owners = Array.from(new Set(entries.map((e) => e.task_owner))).sort();

  const filtered = entries.filter((e) => {
    if (filterDept && e.department !== filterDept) return false;
    if (filterRole && e.role !== filterRole) return false;
    if (filterOwner && e.task_owner !== filterOwner) return false;
    if (filterDate && !e.created_at.startsWith(filterDate)) return false;
    return true;
  });

  const totalTime = filtered.reduce(
    (sum, e) => sum + (e.duration_seconds || 0),
    0
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#003087]">Entry Log</h1>
        <span className="text-sm text-gray-500">
          {filtered.length} entries · {formatDuration(totalTime)} total
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
        >
          <option value="">All Departments</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
        >
          <option value="">All Roles</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={filterOwner}
          onChange={(e) => setFilterOwner(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
        >
          <option value="">All Owners</option>
          {owners.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
        />
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={fetchEntries}
          className="px-4 py-2 bg-[#003087] text-white text-sm rounded-lg hover:bg-[#002060] transition-colors"
        >
          Refresh
        </button>
        <button
          onClick={() => { setFilterDept(""); setFilterRole(""); setFilterOwner(""); setFilterDate(""); }}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
        >
          Clear Filters
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading entries…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No entries found.</div>
      ) : (
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
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                    {formatDate(entry.created_at)}
                  </td>
                  <td className="px-4 py-3 font-medium">{entry.task_owner}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.department}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.role}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.task_category}</td>
                  <td className="px-4 py-3 font-medium text-[#003087]">{entry.task_name}</td>
                  <td className="px-4 py-3 text-gray-500">{entry.po_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{entry.so_number || "—"}</td>
                  <td className="px-4 py-3 font-mono text-green-700 font-semibold">
                    {formatDuration(entry.duration_seconds)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                    {entry.notes || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deleteId === entry.id}
                      className="text-red-500 hover:text-red-700 text-xs font-medium disabled:opacity-40"
                    >
                      {deleteId === entry.id ? "Deleting…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
