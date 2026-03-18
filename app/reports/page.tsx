"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TimeEntry, Profile } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// ── Helpers ──────────────────────────────────────────────────

function fmt(seconds: number) {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function hrs(seconds: number) {
  return (seconds / 3600).toFixed(2);
}

function weekKey(iso: string) {
  const d = new Date(iso);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return start.toISOString().slice(0, 10);
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function stddev(values: number[], mean: number) {
  if (values.length < 2) return 0;
  const sumSq = values.reduce((s, v) => s + (v - mean) ** 2, 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

function escapeCSV(val: string) {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Types ────────────────────────────────────────────────────

type Tab = "trends" | "benchmarks" | "outliers" | "rollup";
type Granularity = "week" | "month";

type TrendPoint = {
  period: string;
  avgSeconds: number;
  totalSeconds: number;
  entryCount: number;
};

type BenchmarkRow = {
  department: string;
  role: string;
  category: string;
  taskName: string;
  owner: string;
  entryCount: number;
  avgSeconds: number;
  minSeconds: number;
  maxSeconds: number;
  stddevSeconds: number;
  totalSeconds: number;
};

type OutlierEntry = TimeEntry & {
  taskAvg: number;
  taskStddev: number;
  zScore: number;
};

type RollupRow = {
  department: string;
  role: string;
  entryCount: number;
  totalSeconds: number;
  avgSeconds: number;
  uniqueTasks: number;
  uniqueOwners: number;
};

// ── Component ────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Tab
  const [tab, setTab] = useState<Tab>("trends");

  // Filters
  const [fDept, setFDept] = useState("");
  const [fRole, setFRole] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fTask, setFTask] = useState("");
  const [fOwner, setFOwner] = useState("");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");

  // Trend settings
  const [granularity, setGranularity] = useState<Granularity>("week");

  // Auth
  useEffect(() => {
    const check = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);
      setAuthLoading(false);
    };
    check();
  }, [router]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/entries");
      const data = await res.json();
      if (Array.isArray(data)) setEntries(data);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!authLoading && profile?.is_admin) fetchEntries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, profile]);

  // ── Filter options ────────────────────────────────────────
  const depts = Array.from(new Set(entries.map((e) => e.department))).sort();
  const roles = Array.from(new Set(entries.map((e) => e.role))).sort();
  const cats = Array.from(new Set(entries.map((e) => e.task_category))).sort();
  const taskNames = fCategory
    ? Array.from(new Set(entries.filter((e) => e.task_category === fCategory).map((e) => e.task_name))).sort()
    : Array.from(new Set(entries.map((e) => e.task_name))).sort();
  const owners = Array.from(new Set(entries.map((e) => e.task_owner))).sort();

  // ── Filtered entries ──────────────────────────────────────
  const filtered = useMemo(() => entries.filter((e) => {
    if (fDept && e.department !== fDept) return false;
    if (fRole && e.role !== fRole) return false;
    if (fCategory && e.task_category !== fCategory) return false;
    if (fTask && e.task_name !== fTask) return false;
    if (fOwner && e.task_owner !== fOwner) return false;
    if (fDateFrom && e.created_at.slice(0, 10) < fDateFrom) return false;
    if (fDateTo && e.created_at.slice(0, 10) > fDateTo) return false;
    return true;
  }), [entries, fDept, fRole, fCategory, fTask, fOwner, fDateFrom, fDateTo]);

  // ── TRENDS ────────────────────────────────────────────────
  const trendData: TrendPoint[] = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const e of filtered) {
      const k = granularity === "week" ? weekKey(e.created_at) : monthKey(e.created_at);
      const existing = map.get(k);
      const dur = e.duration_seconds || 0;
      if (existing) { existing.total += dur; existing.count++; }
      else map.set(k, { total: dur, count: 1 });
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, { total, count }]) => ({
        period,
        avgSeconds: count > 0 ? Math.round(total / count) : 0,
        totalSeconds: total,
        entryCount: count,
      }));
  }, [filtered, granularity]);

  const maxTrendAvg = Math.max(...trendData.map((t) => t.avgSeconds), 1);

  // ── BENCHMARKS ────────────────────────────────────────────
  const benchmarks: BenchmarkRow[] = useMemo(() => {
    const map = new Map<string, { durations: number[]; dept: string; role: string; cat: string; task: string; owner: string }>();
    for (const e of filtered) {
      const key = `${e.department}||${e.role}||${e.task_category}||${e.task_name}||${e.task_owner}`;
      const dur = e.duration_seconds || 0;
      const existing = map.get(key);
      if (existing) existing.durations.push(dur);
      else map.set(key, { durations: [dur], dept: e.department, role: e.role, cat: e.task_category, task: e.task_name, owner: e.task_owner });
    }
    return Array.from(map.values()).map(({ durations, dept, role, cat, task, owner }) => {
      const total = durations.reduce((s, d) => s + d, 0);
      const avg = total / durations.length;
      return {
        department: dept, role, category: cat, taskName: task, owner,
        entryCount: durations.length,
        avgSeconds: Math.round(avg),
        minSeconds: Math.min(...durations),
        maxSeconds: Math.max(...durations),
        stddevSeconds: Math.round(stddev(durations, avg)),
        totalSeconds: total,
      };
    }).sort((a, b) => a.department.localeCompare(b.department) || a.taskName.localeCompare(b.taskName) || a.owner.localeCompare(b.owner));
  }, [filtered]);

  // Cross-user comparison: same task, different avg times
  const taskAverages = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const b of benchmarks) {
      const key = `${b.department}||${b.category}||${b.taskName}`;
      const arr = map.get(key) || [];
      arr.push(b.avgSeconds);
      map.set(key, arr);
    }
    const result = new Map<string, { globalAvg: number; globalStddev: number }>();
    Array.from(map.entries()).forEach(([key, avgs]) => {
      const gAvg = avgs.reduce((s: number, v: number) => s + v, 0) / avgs.length;
      result.set(key, { globalAvg: Math.round(gAvg), globalStddev: Math.round(stddev(avgs, gAvg)) });
    });
    return result;
  }, [benchmarks]);

  // ── OUTLIERS ──────────────────────────────────────────────
  const outliers: OutlierEntry[] = useMemo(() => {
    // Compute avg + stddev per task
    const taskStats = new Map<string, { avg: number; sd: number }>();
    const taskGroups = new Map<string, number[]>();
    for (const e of filtered) {
      const key = `${e.department}||${e.task_category}||${e.task_name}`;
      const arr = taskGroups.get(key) || [];
      arr.push(e.duration_seconds || 0);
      taskGroups.set(key, arr);
    }
    Array.from(taskGroups.entries()).forEach(([key, durations]) => {
      const avg = durations.reduce((s: number, d: number) => s + d, 0) / durations.length;
      taskStats.set(key, { avg, sd: stddev(durations, avg) });
    });

    const result: OutlierEntry[] = [];
    for (const e of filtered) {
      const key = `${e.department}||${e.task_category}||${e.task_name}`;
      const stats = taskStats.get(key);
      if (!stats || stats.sd === 0) continue;
      const z = ((e.duration_seconds || 0) - stats.avg) / stats.sd;
      if (Math.abs(z) >= 1.5) {
        result.push({ ...e, taskAvg: Math.round(stats.avg), taskStddev: Math.round(stats.sd), zScore: z });
      }
    }
    return result.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
  }, [filtered]);

  // ── ROLLUP ────────────────────────────────────────────────
  const rollup: RollupRow[] = useMemo(() => {
    const map = new Map<string, { dept: string; role: string; total: number; count: number; tasks: Set<string>; owners: Set<string> }>();
    for (const e of filtered) {
      const key = `${e.department}||${e.role}`;
      const existing = map.get(key);
      const dur = e.duration_seconds || 0;
      if (existing) {
        existing.total += dur; existing.count++;
        existing.tasks.add(e.task_name);
        existing.owners.add(e.task_owner);
      } else {
        map.set(key, { dept: e.department, role: e.role, total: dur, count: 1, tasks: new Set([e.task_name]), owners: new Set([e.task_owner]) });
      }
    }
    return Array.from(map.values())
      .map((v) => ({
        department: v.dept, role: v.role,
        entryCount: v.count, totalSeconds: v.total,
        avgSeconds: Math.round(v.total / v.count),
        uniqueTasks: v.tasks.size, uniqueOwners: v.owners.size,
      }))
      .sort((a, b) => a.department.localeCompare(b.department) || a.role.localeCompare(b.role));
  }, [filtered]);

  // ── CSV Exports ───────────────────────────────────────────
  const exportTrendCSV = () => {
    const h = ["Period", "Entries", "Avg Duration (s)", "Avg Duration (hrs)", "Total Duration (s)", "Total Duration (hrs)"];
    const rows = trendData.map((t) => [t.period, String(t.entryCount), String(t.avgSeconds), hrs(t.avgSeconds), String(t.totalSeconds), hrs(t.totalSeconds)]);
    downloadCSV([h, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n"), "trend-report.csv");
  };

  const exportBenchmarkCSV = () => {
    const h = ["Department", "Role", "Category", "Task", "Owner", "Entries", "Avg (s)", "Avg (hrs)", "Min (s)", "Max (s)", "StdDev (s)", "Total (s)", "Total (hrs)", "Global Task Avg (s)", "Variance vs Global"];
    const rows = benchmarks.map((b) => {
      const gKey = `${b.department}||${b.category}||${b.taskName}`;
      const g = taskAverages.get(gKey);
      const variance = g ? ((b.avgSeconds - g.globalAvg) / (g.globalAvg || 1) * 100).toFixed(1) + "%" : "—";
      return [b.department, b.role, b.category, b.taskName, b.owner, String(b.entryCount), String(b.avgSeconds), hrs(b.avgSeconds), String(b.minSeconds), String(b.maxSeconds), String(b.stddevSeconds), String(b.totalSeconds), hrs(b.totalSeconds), g ? String(g.globalAvg) : "—", variance];
    });
    downloadCSV([h, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n"), "benchmark-report.csv");
  };

  const exportOutlierCSV = () => {
    const h = ["Date", "Owner", "Department", "Category", "Task", "Duration (s)", "Duration (hrs)", "Task Avg (s)", "Task StdDev (s)", "Z-Score", "Flag"];
    const rows = outliers.map((o) => [
      new Date(o.created_at).toISOString().slice(0, 19),
      o.task_owner, o.department, o.task_category, o.task_name,
      String(o.duration_seconds || 0), hrs(o.duration_seconds || 0),
      String(o.taskAvg), String(o.taskStddev), o.zScore.toFixed(2),
      o.zScore > 0 ? "SLOW" : "FAST",
    ]);
    downloadCSV([h, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n"), "outlier-report.csv");
  };

  const exportRollupCSV = () => {
    const h = ["Department", "Role", "Entries", "Total (s)", "Total (hrs)", "Avg per Entry (s)", "Avg per Entry (hrs)", "Unique Tasks", "Unique Owners"];
    const rows = rollup.map((r) => [r.department, r.role, String(r.entryCount), String(r.totalSeconds), hrs(r.totalSeconds), String(r.avgSeconds), hrs(r.avgSeconds), String(r.uniqueTasks), String(r.uniqueOwners)]);
    downloadCSV([h, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n"), "rollup-report.csv");
  };

  // ── Auth guards ───────────────────────────────────────────
  if (authLoading) return <div className="text-center py-16 text-gray-400">Loading...</div>;
  if (!profile?.is_admin) return (
    <div className="max-w-sm mx-auto mt-20 text-center">
      <p className="text-gray-500 text-lg">Access Denied</p>
      <p className="text-gray-400 text-sm mt-2">Admin access required.</p>
    </div>
  );

  const hasFilters = fDept || fRole || fCategory || fTask || fOwner || fDateFrom || fDateTo;
  const clearFilters = () => { setFDept(""); setFRole(""); setFCategory(""); setFTask(""); setFOwner(""); setFDateFrom(""); setFDateTo(""); };

  const sel = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]";

  const tabs: { key: Tab; label: string }[] = [
    { key: "trends", label: "Trends" },
    { key: "benchmarks", label: "Benchmarks" },
    { key: "outliers", label: "Outliers" },
    { key: "rollup", label: "Dept / Role Rollup" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A3C28]">Reports &amp; Analytics</h1>
        <span className="text-sm text-gray-500">
          {filtered.length} entries{hasFilters && <span className="text-amber-600 ml-1">(filtered)</span>}
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <select value={fDept} onChange={(e) => setFDept(e.target.value)} className={sel}>
            <option value="">All Departments</option>
            {depts.map((d) => <option key={d}>{d}</option>)}
          </select>
          <select value={fRole} onChange={(e) => setFRole(e.target.value)} className={sel}>
            <option value="">All Roles</option>
            {roles.map((r) => <option key={r}>{r}</option>)}
          </select>
          <select value={fCategory} onChange={(e) => { setFCategory(e.target.value); setFTask(""); }} className={sel}>
            <option value="">All Categories</option>
            {cats.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={fTask} onChange={(e) => setFTask(e.target.value)} className={sel}>
            <option value="">All Tasks</option>
            {taskNames.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select value={fOwner} onChange={(e) => setFOwner(e.target.value)} className={sel}>
            <option value="">All Owners</option>
            {owners.map((o) => <option key={o}>{o}</option>)}
          </select>
          <input type="date" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} className={sel} />
          <input type="date" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} className={sel} />
          <div className="flex items-center gap-3">
            {hasFilters && (
              <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 underline">Clear filters</button>
            )}
            <button onClick={fetchEntries} className="px-3 py-2 bg-[#1A3C28] text-white text-sm rounded-lg hover:bg-[#122B1C] transition-colors">Refresh</button>
          </div>
        </div>
      </div>

      {/* Tabs + Export */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.key ? "bg-white text-[#1A3C28] shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              {t.label}
              {t.key === "outliers" && outliers.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-xs">{outliers.length}</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={tab === "trends" ? exportTrendCSV : tab === "benchmarks" ? exportBenchmarkCSV : tab === "outliers" ? exportOutlierCSV : exportRollupCSV}
          disabled={filtered.length === 0}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40">
          Export CSV
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No entries found. Adjust your filters or add time entries first.</div>
      ) : (
        <>
          {/* ═══ TRENDS TAB ═══ */}
          {tab === "trends" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Group by:</span>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  <button onClick={() => setGranularity("week")}
                    className={`px-3 py-1 rounded-md text-xs font-medium ${granularity === "week" ? "bg-white text-[#1A3C28] shadow-sm" : "text-gray-500"}`}>
                    Weekly
                  </button>
                  <button onClick={() => setGranularity("month")}
                    className={`px-3 py-1 rounded-md text-xs font-medium ${granularity === "month" ? "bg-white text-[#1A3C28] shadow-sm" : "text-gray-500"}`}>
                    Monthly
                  </button>
                </div>
              </div>

              {/* Bar chart */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  Average Duration per Entry ({granularity === "week" ? "Weekly" : "Monthly"})
                </h3>
                {trendData.length === 0 ? (
                  <p className="text-gray-400 text-sm">Not enough data for trends.</p>
                ) : (
                  <div className="space-y-2">
                    {trendData.map((t) => (
                      <div key={t.period} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-20 flex-shrink-0 font-mono">{t.period}</span>
                        <div className="flex-1 h-7 bg-gray-100 rounded-md overflow-hidden relative">
                          <div
                            className="h-full bg-[#2E7D47] rounded-md transition-all duration-300"
                            style={{ width: `${Math.max((t.avgSeconds / maxTrendAvg) * 100, 2)}%` }}
                          />
                          <span className="absolute inset-y-0 right-2 flex items-center text-xs font-medium text-gray-600">
                            {fmt(t.avgSeconds)} avg
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 w-20 text-right flex-shrink-0">{t.entryCount} entries</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Trend table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3 text-right">Entries</th>
                      <th className="px-4 py-3 text-right">Avg Duration</th>
                      <th className="px-4 py-3 text-right">Avg (hrs)</th>
                      <th className="px-4 py-3 text-right">Total Duration</th>
                      <th className="px-4 py-3 text-right">Total (hrs)</th>
                      <th className="px-4 py-3 text-right">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trendData.map((t, i) => {
                      const prev = i > 0 ? trendData[i - 1].avgSeconds : null;
                      const change = prev ? ((t.avgSeconds - prev) / prev * 100) : null;
                      return (
                        <tr key={t.period} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-gray-600">{t.period}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{t.entryCount}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">{fmt(t.avgSeconds)}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-500">{hrs(t.avgSeconds)}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-600">{fmt(t.totalSeconds)}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-500">{hrs(t.totalSeconds)}</td>
                          <td className="px-4 py-3 text-right text-xs font-semibold">
                            {change !== null ? (
                              <span className={change > 5 ? "text-red-600" : change < -5 ? "text-green-600" : "text-gray-400"}>
                                {change > 0 ? "+" : ""}{change.toFixed(1)}%
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ BENCHMARKS TAB ═══ */}
          {tab === "benchmarks" && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Task</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3 text-right">Entries</th>
                    <th className="px-4 py-3 text-right">Avg</th>
                    <th className="px-4 py-3 text-right">Min</th>
                    <th className="px-4 py-3 text-right">Max</th>
                    <th className="px-4 py-3 text-right">StdDev</th>
                    <th className="px-4 py-3 text-right">Global Avg</th>
                    <th className="px-4 py-3 text-right">vs Global</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {benchmarks.map((b, i) => {
                    const gKey = `${b.department}||${b.category}||${b.taskName}`;
                    const g = taskAverages.get(gKey);
                    const variance = g ? ((b.avgSeconds - g.globalAvg) / (g.globalAvg || 1)) * 100 : 0;
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-[#1A3C28]">{b.taskName}</td>
                        <td className="px-4 py-3 text-gray-500">{b.category}</td>
                        <td className="px-4 py-3 font-medium">{b.owner}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{b.entryCount}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">{fmt(b.avgSeconds)}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-500">{fmt(b.minSeconds)}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-500">{fmt(b.maxSeconds)}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-400">{fmt(b.stddevSeconds)}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-500">{g ? fmt(g.globalAvg) : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {g ? (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              variance > 20 ? "bg-red-100 text-red-700"
                              : variance < -20 ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                            }`}>
                              {variance > 0 ? "+" : ""}{variance.toFixed(0)}%
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {benchmarks.length === 0 && (
                <div className="text-center py-12 text-gray-400">No benchmark data available.</div>
              )}
            </div>
          )}

          {/* ═══ OUTLIERS TAB ═══ */}
          {tab === "outliers" && (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Entries flagged as outliers (1.5+ standard deviations from the task average). Red = significantly slower, green = significantly faster.
              </p>
              {outliers.length === 0 ? (
                <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
                  No outliers detected. All entries are within normal range.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-3">Flag</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Owner</th>
                        <th className="px-4 py-3">Task</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3 text-right">Duration</th>
                        <th className="px-4 py-3 text-right">Task Avg</th>
                        <th className="px-4 py-3 text-right">Deviation</th>
                        <th className="px-4 py-3 text-right">Z-Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {outliers.map((o) => (
                        <tr key={o.id} className={`hover:bg-gray-50 ${o.zScore > 0 ? "bg-red-50/50" : "bg-green-50/50"}`}>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              o.zScore > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                            }`}>
                              {o.zScore > 0 ? "SLOW" : "FAST"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 font-medium">{o.task_owner}</td>
                          <td className="px-4 py-3 font-medium text-[#1A3C28]">{o.task_name}</td>
                          <td className="px-4 py-3 text-gray-500">{o.task_category}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">{fmt(o.duration_seconds || 0)}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-500">{fmt(o.taskAvg)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {o.zScore > 0 ? "+" : ""}{fmt(Math.abs((o.duration_seconds || 0) - o.taskAvg))}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                            {o.zScore > 0 ? "+" : ""}{o.zScore.toFixed(2)}σ
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══ ROLLUP TAB ═══ */}
          {tab === "rollup" && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 text-right">Entries</th>
                    <th className="px-4 py-3 text-right">Total Time</th>
                    <th className="px-4 py-3 text-right">Hours</th>
                    <th className="px-4 py-3 text-right">Avg / Entry</th>
                    <th className="px-4 py-3 text-right">Unique Tasks</th>
                    <th className="px-4 py-3 text-right">Unique Owners</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rollup.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{r.department}</td>
                      <td className="px-4 py-3 text-gray-600">{r.role}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.entryCount}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">{fmt(r.totalSeconds)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500">{hrs(r.totalSeconds)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">{fmt(r.avgSeconds)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{r.uniqueTasks}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{r.uniqueOwners}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold text-sm">
                    <td className="px-4 py-3" colSpan={2}>Total</td>
                    <td className="px-4 py-3 text-right">{filtered.length}</td>
                    <td className="px-4 py-3 text-right font-mono text-green-700">{fmt(rollup.reduce((s, r) => s + r.totalSeconds, 0))}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">{hrs(rollup.reduce((s, r) => s + r.totalSeconds, 0))}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
