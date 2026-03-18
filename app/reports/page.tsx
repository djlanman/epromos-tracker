"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TimeEntry, Profile } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// ── Palette ─────────────────────────────────────────────────
const COLORS = [
  "#6366F1", // indigo
  "#F59E0B", // amber
  "#10B981", // emerald
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
  "#3B82F6", // blue
  "#84CC16", // lime
  "#06B6D4", // cyan
  "#E11D48", // rose
];

function colorFor(i: number) { return COLORS[i % COLORS.length]; }

// ── Helpers ─────────────────────────────────────────────────
function fmt(seconds: number) {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
function hrs(seconds: number) { return (seconds / 3600).toFixed(2); }
function mins(seconds: number) { return (seconds / 60).toFixed(1); }
function weekKey(iso: string) {
  const d = new Date(iso); const s = new Date(d); s.setDate(d.getDate() - d.getDay());
  return s.toISOString().slice(0, 10);
}
function monthKey(iso: string) { return iso.slice(0, 7); }
function dayName(n: number) { return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][n]; }
function stddev(values: number[], mean: number) {
  if (values.length < 2) return 0;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1));
}
function escapeCSV(val: string) {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) return `"${val.replace(/"/g, '""')}"`;
  return val;
}
function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

// ── Types ───────────────────────────────────────────────────
type Tab = "dashboard" | "benchmarks" | "outliers" | "rollup";
type Granularity = "week" | "month";

type BenchmarkRow = { department: string; role: string; category: string; taskName: string; owner: string; entryCount: number; avgSeconds: number; minSeconds: number; maxSeconds: number; stddevSeconds: number; totalSeconds: number };
type OutlierEntry = TimeEntry & { taskAvg: number; taskStddev: number; zScore: number };
type RollupRow = { department: string; role: string; entryCount: number; totalSeconds: number; avgSeconds: number; uniqueTasks: number; uniqueOwners: number };

// ── Component ───────────────────────────────────────────────
export default function ReportsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [fDept, setFDept] = useState("");
  const [fRole, setFRole] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fTask, setFTask] = useState("");
  const [fOwner, setFOwner] = useState("");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");
  const [granularity, setGranularity] = useState<Granularity>("week");

  useEffect(() => {
    const check = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data); setAuthLoading(false);
    };
    check();
  }, [router]);

  const fetchEntries = async () => {
    setLoading(true);
    try { const res = await fetch("/api/entries"); const data = await res.json(); if (Array.isArray(data)) setEntries(data); }
    catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!authLoading && profile?.is_admin) fetchEntries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, profile]);

  // Filter options
  const depts = Array.from(new Set(entries.map((e) => e.department))).sort();
  const rolesOpts = Array.from(new Set(entries.map((e) => e.role))).sort();
  const cats = Array.from(new Set(entries.map((e) => e.task_category))).sort();
  const taskNames = fCategory ? Array.from(new Set(entries.filter((e) => e.task_category === fCategory).map((e) => e.task_name))).sort() : Array.from(new Set(entries.map((e) => e.task_name))).sort();
  const owners = Array.from(new Set(entries.map((e) => e.task_owner))).sort();

  // Filtered
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

  const totalSeconds = useMemo(() => filtered.reduce((s, e) => s + (e.duration_seconds || 0), 0), [filtered]);
  const avgSeconds = filtered.length > 0 ? Math.round(totalSeconds / filtered.length) : 0;

  // ── Dashboard data ────────────────────────────────────────

  // KPI: unique owners, unique tasks, unique categories
  const uniqueOwners = useMemo(() => new Set(filtered.map((e) => e.task_owner)).size, [filtered]);
  const uniqueTasks = useMemo(() => new Set(filtered.map((e) => e.task_name)).size, [filtered]);
  const uniqueCategories = useMemo(() => new Set(filtered.map((e) => e.task_category)).size, [filtered]);

  // Category breakdown (for pie + bar)
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) { map.set(e.task_category, (map.get(e.task_category) || 0) + (e.duration_seconds || 0)); }
    return Array.from(map.entries()).map(([name, secs]) => ({ name, seconds: secs })).sort((a, b) => b.seconds - a.seconds);
  }, [filtered]);

  // Top 10 tasks by total time
  const topTasks = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const e of filtered) {
      const ex = map.get(e.task_name);
      const d = e.duration_seconds || 0;
      if (ex) { ex.total += d; ex.count++; } else map.set(e.task_name, { total: d, count: 1 });
    }
    return Array.from(map.entries()).map(([name, { total, count }]) => ({ name, total, count, avg: Math.round(total / count) })).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [filtered]);

  // User leaderboard (total time per user)
  const userLeaderboard = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const e of filtered) {
      const ex = map.get(e.task_owner);
      const d = e.duration_seconds || 0;
      if (ex) { ex.total += d; ex.count++; } else map.set(e.task_owner, { total: d, count: 1 });
    }
    return Array.from(map.entries()).map(([name, { total, count }]) => ({ name, total, count, avg: Math.round(total / count) })).sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Day-of-week activity
  const dayOfWeek = useMemo(() => {
    const days = [0, 0, 0, 0, 0, 0, 0];
    for (const e of filtered) { days[new Date(e.created_at).getDay()] += (e.duration_seconds || 0); }
    return days;
  }, [filtered]);
  const maxDay = Math.max(...dayOfWeek, 1);

  // Hourly distribution
  const hourly = useMemo(() => {
    const h = new Array(24).fill(0) as number[];
    for (const e of filtered) { if (e.start_time) h[new Date(e.start_time).getHours()] += 1; }
    return h;
  }, [filtered]);
  const maxHour = Math.max(...hourly, 1);

  // Trend data
  const trendData = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const e of filtered) {
      const k = granularity === "week" ? weekKey(e.created_at) : monthKey(e.created_at);
      const ex = map.get(k); const d = e.duration_seconds || 0;
      if (ex) { ex.total += d; ex.count++; } else map.set(k, { total: d, count: 1 });
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([period, { total, count }]) => ({ period, avg: count > 0 ? Math.round(total / count) : 0, total, count }));
  }, [filtered, granularity]);
  const maxTrendAvg = Math.max(...trendData.map((t) => t.avg), 1);

  // ── Benchmarks ────────────────────────────────────────────
  const benchmarks: BenchmarkRow[] = useMemo(() => {
    const map = new Map<string, { durations: number[]; dept: string; role: string; cat: string; task: string; owner: string }>();
    for (const e of filtered) {
      const key = `${e.department}||${e.role}||${e.task_category}||${e.task_name}||${e.task_owner}`;
      const dur = e.duration_seconds || 0; const ex = map.get(key);
      if (ex) ex.durations.push(dur); else map.set(key, { durations: [dur], dept: e.department, role: e.role, cat: e.task_category, task: e.task_name, owner: e.task_owner });
    }
    return Array.from(map.values()).map(({ durations, dept, role, cat, task, owner }) => {
      const total = durations.reduce((s, d) => s + d, 0); const avg = total / durations.length;
      return { department: dept, role, category: cat, taskName: task, owner, entryCount: durations.length, avgSeconds: Math.round(avg), minSeconds: Math.min(...durations), maxSeconds: Math.max(...durations), stddevSeconds: Math.round(stddev(durations, avg)), totalSeconds: total };
    }).sort((a, b) => a.taskName.localeCompare(b.taskName) || a.owner.localeCompare(b.owner));
  }, [filtered]);

  const taskAverages = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const b of benchmarks) { const key = `${b.department}||${b.category}||${b.taskName}`; const arr = map.get(key) || []; arr.push(b.avgSeconds); map.set(key, arr); }
    const result = new Map<string, { globalAvg: number; globalStddev: number }>();
    Array.from(map.entries()).forEach(([key, avgs]) => {
      const gAvg = avgs.reduce((s: number, v: number) => s + v, 0) / avgs.length;
      result.set(key, { globalAvg: Math.round(gAvg), globalStddev: Math.round(stddev(avgs, gAvg)) });
    });
    return result;
  }, [benchmarks]);

  // ── Outliers ──────────────────────────────────────────────
  const outliers: OutlierEntry[] = useMemo(() => {
    const taskStats = new Map<string, { avg: number; sd: number }>();
    const taskGroups = new Map<string, number[]>();
    for (const e of filtered) { const key = `${e.department}||${e.task_category}||${e.task_name}`; const arr = taskGroups.get(key) || []; arr.push(e.duration_seconds || 0); taskGroups.set(key, arr); }
    Array.from(taskGroups.entries()).forEach(([key, durations]) => {
      const avg = durations.reduce((s: number, d: number) => s + d, 0) / durations.length;
      taskStats.set(key, { avg, sd: stddev(durations, avg) });
    });
    const result: OutlierEntry[] = [];
    for (const e of filtered) {
      const key = `${e.department}||${e.task_category}||${e.task_name}`; const stats = taskStats.get(key);
      if (!stats || stats.sd === 0) continue;
      const z = ((e.duration_seconds || 0) - stats.avg) / stats.sd;
      if (Math.abs(z) >= 1.5) result.push({ ...e, taskAvg: Math.round(stats.avg), taskStddev: Math.round(stats.sd), zScore: z });
    }
    return result.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
  }, [filtered]);

  // ── Rollup ────────────────────────────────────────────────
  const rollup: RollupRow[] = useMemo(() => {
    const map = new Map<string, { dept: string; role: string; total: number; count: number; tasks: Set<string>; owners: Set<string> }>();
    for (const e of filtered) {
      const key = `${e.department}||${e.role}`; const dur = e.duration_seconds || 0; const ex = map.get(key);
      if (ex) { ex.total += dur; ex.count++; ex.tasks.add(e.task_name); ex.owners.add(e.task_owner); }
      else map.set(key, { dept: e.department, role: e.role, total: dur, count: 1, tasks: new Set([e.task_name]), owners: new Set([e.task_owner]) });
    }
    return Array.from(map.values()).map((v) => ({ department: v.dept, role: v.role, entryCount: v.count, totalSeconds: v.total, avgSeconds: Math.round(v.total / v.count), uniqueTasks: v.tasks.size, uniqueOwners: v.owners.size }))
      .sort((a, b) => a.department.localeCompare(b.department) || a.role.localeCompare(b.role));
  }, [filtered]);

  // ── CSV Exports ───────────────────────────────────────────
  const exportDashboardCSV = () => {
    const h = ["Metric", "Value"];
    const rows = [
      ["Total Entries", String(filtered.length)], ["Total Time (hrs)", hrs(totalSeconds)], ["Total Time (min)", mins(totalSeconds)],
      ["Avg per Entry (min)", mins(avgSeconds)], ["Unique Owners", String(uniqueOwners)], ["Unique Tasks", String(uniqueTasks)], ["Unique Categories", String(uniqueCategories)],
      [""], ["Category Breakdown", ""], ["Category", "Total (hrs)"],
      ...categoryBreakdown.map((c) => [c.name, hrs(c.seconds)]),
      [""], ["Top Tasks by Time", ""], ["Task", "Total (hrs)", "Entries", "Avg (min)"],
      ...topTasks.map((t) => [t.name, hrs(t.total), String(t.count), mins(t.avg)]),
    ];
    downloadCSV([h, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n"), "dashboard-report.csv");
  };
  const exportBenchmarkCSV = () => {
    const h = ["Department", "Role", "Category", "Task", "Owner", "Entries", "Avg (s)", "Avg (min)", "Avg (hrs)", "Min (s)", "Max (s)", "StdDev (s)", "Total (s)", "Total (min)", "Total (hrs)", "Global Avg (s)", "Variance"];
    const rows = benchmarks.map((b) => {
      const gKey = `${b.department}||${b.category}||${b.taskName}`; const g = taskAverages.get(gKey);
      const variance = g ? ((b.avgSeconds - g.globalAvg) / (g.globalAvg || 1) * 100).toFixed(1) + "%" : "—";
      return [b.department, b.role, b.category, b.taskName, b.owner, String(b.entryCount), String(b.avgSeconds), mins(b.avgSeconds), hrs(b.avgSeconds), String(b.minSeconds), String(b.maxSeconds), String(b.stddevSeconds), String(b.totalSeconds), mins(b.totalSeconds), hrs(b.totalSeconds), g ? String(g.globalAvg) : "—", variance];
    });
    downloadCSV([h, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n"), "benchmark-report.csv");
  };
  const exportOutlierCSV = () => {
    const h = ["Date", "Owner", "Dept", "Category", "Task", "Duration (s)", "Duration (min)", "Duration (hrs)", "Task Avg (s)", "StdDev (s)", "Z-Score", "Flag"];
    const rows = outliers.map((o) => [new Date(o.created_at).toISOString().slice(0, 19), o.task_owner, o.department, o.task_category, o.task_name, String(o.duration_seconds || 0), mins(o.duration_seconds || 0), hrs(o.duration_seconds || 0), String(o.taskAvg), String(o.taskStddev), o.zScore.toFixed(2), o.zScore > 0 ? "SLOW" : "FAST"]);
    downloadCSV([h, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n"), "outlier-report.csv");
  };
  const exportRollupCSV = () => {
    const h = ["Department", "Role", "Entries", "Total (s)", "Total (min)", "Total (hrs)", "Avg/Entry (s)", "Avg/Entry (min)", "Unique Tasks", "Unique Owners"];
    const rows = rollup.map((r) => [r.department, r.role, String(r.entryCount), String(r.totalSeconds), mins(r.totalSeconds), hrs(r.totalSeconds), String(r.avgSeconds), mins(r.avgSeconds), String(r.uniqueTasks), String(r.uniqueOwners)]);
    downloadCSV([h, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n"), "rollup-report.csv");
  };

  // Auth guards
  if (authLoading) return <div className="text-center py-16 text-gray-400">Loading...</div>;
  if (!profile?.is_admin) return (<div className="max-w-sm mx-auto mt-20 text-center"><p className="text-gray-500 text-lg">Access Denied</p><p className="text-gray-400 text-sm mt-2">Admin access required.</p></div>);

  const hasFilters = fDept || fRole || fCategory || fTask || fOwner || fDateFrom || fDateTo;
  const clearFilters = () => { setFDept(""); setFRole(""); setFCategory(""); setFTask(""); setFOwner(""); setFDateFrom(""); setFDateTo(""); };
  const sel = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]";
  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "benchmarks", label: "Benchmarks" },
    { key: "outliers", label: "Outliers", badge: outliers.length },
    { key: "rollup", label: "Dept / Role" },
  ];
  const catTotal = categoryBreakdown.reduce((s, c) => s + c.seconds, 0) || 1;
  const maxTaskTotal = topTasks.length > 0 ? topTasks[0].total : 1;
  const maxUserTotal = userLeaderboard.length > 0 ? userLeaderboard[0].total : 1;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports &amp; Analytics</h1>
        <span className="text-sm text-gray-500">{filtered.length} entries{hasFilters && <span className="text-violet-600 ml-1">(filtered)</span>}</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <select value={fDept} onChange={(e) => setFDept(e.target.value)} className={sel}><option value="">All Departments</option>{depts.map((d) => <option key={d}>{d}</option>)}</select>
          <select value={fRole} onChange={(e) => setFRole(e.target.value)} className={sel}><option value="">All Roles</option>{rolesOpts.map((r) => <option key={r}>{r}</option>)}</select>
          <select value={fCategory} onChange={(e) => { setFCategory(e.target.value); setFTask(""); }} className={sel}><option value="">All Categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
          <select value={fTask} onChange={(e) => setFTask(e.target.value)} className={sel}><option value="">All Tasks</option>{taskNames.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select value={fOwner} onChange={(e) => setFOwner(e.target.value)} className={sel}><option value="">All Owners</option>{owners.map((o) => <option key={o}>{o}</option>)}</select>
          <input type="date" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} className={sel} />
          <input type="date" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} className={sel} />
          <div className="flex items-center gap-3">
            {hasFilters && <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 underline">Clear</button>}
            <button onClick={fetchEntries} className="px-3 py-2 bg-[#6366F1] text-white text-sm rounded-lg hover:bg-[#4F46E5] transition-colors">Refresh</button>
          </div>
        </div>
      </div>

      {/* Tabs + Export */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.key ? "bg-white text-[#6366F1] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {t.label}
              {t.badge ? <span className="ml-1.5 px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-xs">{t.badge}</span> : null}
            </button>
          ))}
        </div>
        <button onClick={tab === "dashboard" ? exportDashboardCSV : tab === "benchmarks" ? exportBenchmarkCSV : tab === "outliers" ? exportOutlierCSV : exportRollupCSV}
          disabled={filtered.length === 0} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40">Export CSV</button>
      </div>

      {loading ? <div className="text-center py-16 text-gray-400">Loading...</div>
      : filtered.length === 0 ? <div className="text-center py-16 text-gray-400">No entries found.</div>
      : (<>

      {/* ═══════ DASHBOARD ═══════ */}
      {tab === "dashboard" && (<div className="space-y-6">

        {/* KPI Tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Time", value: hrs(totalSeconds) + "h", sub: mins(totalSeconds) + " min", color: "bg-indigo-500", icon: "⏱" },
            { label: "Avg per Entry", value: mins(avgSeconds) + " min", sub: fmt(avgSeconds), color: "bg-amber-500", icon: "📊" },
            { label: "Total Entries", value: String(filtered.length), sub: `${uniqueOwners} people`, color: "bg-emerald-500", icon: "📝" },
            { label: "Active Tasks", value: String(uniqueTasks), sub: `${uniqueCategories} categories`, color: "bg-rose-500", icon: "🎯" },
          ].map((tile) => (
            <div key={tile.label} className="bg-white rounded-xl border border-gray-200 p-5 relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-16 h-16 ${tile.color} opacity-10 rounded-bl-full`} />
              <div className="text-2xl mb-1">{tile.icon}</div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{tile.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{tile.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{tile.sub}</p>
            </div>
          ))}
        </div>

        {/* Row: Category Donut + Top Tasks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Category Breakdown — horizontal bars with percentage */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Time by Category</h3>
            <div className="space-y-2.5">
              {categoryBreakdown.slice(0, 8).map((c, i) => {
                const pct = (c.seconds / catTotal) * 100;
                return (
                  <div key={c.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-700 font-medium truncate max-w-[60%]">{c.name}</span>
                      <span className="text-gray-500">{hrs(c.seconds)}h ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: colorFor(i) }} />
                    </div>
                  </div>
                );
              })}
              {categoryBreakdown.length > 8 && <p className="text-xs text-gray-400 mt-2">+ {categoryBreakdown.length - 8} more categories</p>}
            </div>
          </div>

          {/* Top 10 Tasks */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 10 Tasks by Total Time</h3>
            <div className="space-y-2">
              {topTasks.map((t, i) => (
                <div key={t.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-5 text-gray-400">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-700 font-medium truncate max-w-[55%]">{t.name}</span>
                      <span className="text-gray-500">{hrs(t.total)}h · {t.count} entries</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(t.total / maxTaskTotal) * 100}%`, backgroundColor: colorFor(i) }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row: User Leaderboard + Day of Week + Hourly */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* User Leaderboard */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">User Leaderboard</h3>
            <div className="space-y-3">
              {userLeaderboard.slice(0, 10).map((u, i) => (
                <div key={u.name} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`} style={{ backgroundColor: colorFor(i) }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-800 truncate">{u.name}</span>
                      <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{hrs(u.total)}h</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                      <div className="h-full rounded-full" style={{ width: `${(u.total / maxUserTotal) * 100}%`, backgroundColor: colorFor(i) }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{u.count} entries · avg {mins(u.avg)} min</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Day of Week Heatmap */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Activity by Day</h3>
            <div className="space-y-2">
              {dayOfWeek.map((secs, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-8 font-medium">{dayName(i)}</span>
                  <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden">
                    <div className="h-full rounded-md transition-all duration-500" style={{ width: `${(secs / maxDay) * 100}%`, backgroundColor: secs === maxDay ? "#6366F1" : secs > maxDay * 0.7 ? "#8B5CF6" : secs > maxDay * 0.4 ? "#A78BFA" : "#C4B5FD" }} />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">{hrs(secs)}h</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hourly Distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Peak Hours (entries started)</h3>
            <div className="flex items-end gap-0.5 h-32">
              {hourly.map((count, h) => (
                <div key={h} className="flex-1 flex flex-col items-center justify-end">
                  <div className="w-full rounded-t transition-all duration-300" style={{ height: `${Math.max((count / maxHour) * 100, 2)}%`, backgroundColor: count === maxHour ? "#F59E0B" : count > maxHour * 0.7 ? "#FBBF24" : count > maxHour * 0.3 ? "#FDE68A" : "#FEF3C7" }} />
                </div>
              ))}
            </div>
            <div className="flex gap-0.5 mt-1">
              {hourly.map((_, h) => (
                <div key={h} className="flex-1 text-center">
                  {h % 3 === 0 && <span className="text-[9px] text-gray-400">{h}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Avg Duration Trend</h3>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button onClick={() => setGranularity("week")} className={`px-3 py-1 rounded-md text-xs font-medium ${granularity === "week" ? "bg-white text-[#6366F1] shadow-sm" : "text-gray-500"}`}>Weekly</button>
              <button onClick={() => setGranularity("month")} className={`px-3 py-1 rounded-md text-xs font-medium ${granularity === "month" ? "bg-white text-[#6366F1] shadow-sm" : "text-gray-500"}`}>Monthly</button>
            </div>
          </div>
          <div className="space-y-1.5">
            {trendData.map((t, i) => {
              const prev = i > 0 ? trendData[i - 1].avg : null;
              const change = prev ? ((t.avg - prev) / prev * 100) : null;
              return (
                <div key={t.period} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-20 flex-shrink-0 font-mono">{t.period}</span>
                  <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden relative">
                    <div className="h-full rounded-md transition-all duration-500" style={{ width: `${Math.max((t.avg / maxTrendAvg) * 100, 2)}%`, backgroundColor: "#6366F1" }} />
                  </div>
                  <span className="text-xs font-mono text-gray-600 w-16 text-right">{mins(t.avg)}m</span>
                  <span className="text-xs text-gray-400 w-14 text-right">{t.count} ent</span>
                  <span className="w-14 text-right text-xs font-semibold">
                    {change !== null ? <span className={change > 5 ? "text-red-500" : change < -5 ? "text-emerald-500" : "text-gray-400"}>{change > 0 ? "+" : ""}{change.toFixed(0)}%</span> : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>)}

      {/* ═══════ BENCHMARKS ═══════ */}
      {tab === "benchmarks" && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">Task</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3 text-right">Entries</th><th className="px-4 py-3 text-right">Avg</th><th className="px-4 py-3 text-right">Min</th>
              <th className="px-4 py-3 text-right">Max</th><th className="px-4 py-3 text-right">StdDev</th><th className="px-4 py-3 text-right">Global Avg</th><th className="px-4 py-3 text-right">vs Global</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {benchmarks.map((b, i) => {
                const gKey = `${b.department}||${b.category}||${b.taskName}`; const g = taskAverages.get(gKey);
                const variance = g ? ((b.avgSeconds - g.globalAvg) / (g.globalAvg || 1)) * 100 : 0;
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-[#6366F1]">{b.taskName}</td>
                    <td className="px-4 py-3 text-gray-500">{b.category}</td>
                    <td className="px-4 py-3 font-medium">{b.owner}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{b.entryCount}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-indigo-600">{fmt(b.avgSeconds)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">{fmt(b.minSeconds)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">{fmt(b.maxSeconds)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-400">{fmt(b.stddevSeconds)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">{g ? fmt(g.globalAvg) : "—"}</td>
                    <td className="px-4 py-3 text-right">{g ? (<span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${variance > 20 ? "bg-red-100 text-red-700" : variance < -20 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{variance > 0 ? "+" : ""}{variance.toFixed(0)}%</span>) : "—"}</td>
                  </tr>);
              })}
            </tbody>
          </table>
          {benchmarks.length === 0 && <div className="text-center py-12 text-gray-400">No benchmark data.</div>}
        </div>
      )}

      {/* ═══════ OUTLIERS ═══════ */}
      {tab === "outliers" && (<div>
        <p className="text-sm text-gray-500 mb-4">Entries 1.5+ standard deviations from task average. <span className="text-red-500 font-medium">Red = slow</span>, <span className="text-emerald-500 font-medium">Green = fast</span>.</p>
        {outliers.length === 0 ? <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">All entries within normal range.</div>
        : (<div className="overflow-x-auto rounded-xl border border-gray-200 bg-white"><table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3">Flag</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Task</th><th className="px-4 py-3">Category</th><th className="px-4 py-3 text-right">Duration</th>
            <th className="px-4 py-3 text-right">Task Avg</th><th className="px-4 py-3 text-right">Deviation</th><th className="px-4 py-3 text-right">Z-Score</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {outliers.map((o) => (
              <tr key={o.id} className={`hover:bg-gray-50 ${o.zScore > 0 ? "bg-red-50/40" : "bg-emerald-50/40"}`}>
                <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-1 rounded-full ${o.zScore > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{o.zScore > 0 ? "SLOW" : "FAST"}</span></td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-medium">{o.task_owner}</td>
                <td className="px-4 py-3 font-medium text-[#6366F1]">{o.task_name}</td>
                <td className="px-4 py-3 text-gray-500">{o.task_category}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">{fmt(o.duration_seconds || 0)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-500">{fmt(o.taskAvg)}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">{o.zScore > 0 ? "+" : ""}{fmt(Math.abs((o.duration_seconds || 0) - o.taskAvg))}</td>
                <td className="px-4 py-3 text-right font-mono text-xs font-semibold">{o.zScore > 0 ? "+" : ""}{o.zScore.toFixed(2)}σ</td>
              </tr>
            ))}
          </tbody>
        </table></div>)}
      </div>)}

      {/* ═══════ ROLLUP ═══════ */}
      {tab === "rollup" && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white"><table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3">Department</th><th className="px-4 py-3">Role</th><th className="px-4 py-3 text-right">Entries</th>
            <th className="px-4 py-3 text-right">Total Time</th><th className="px-4 py-3 text-right">Hours</th><th className="px-4 py-3 text-right">Avg / Entry</th>
            <th className="px-4 py-3 text-right">Tasks</th><th className="px-4 py-3 text-right">Owners</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rollup.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{r.department}</td><td className="px-4 py-3 text-gray-600">{r.role}</td>
                <td className="px-4 py-3 text-right">{r.entryCount}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-indigo-600">{fmt(r.totalSeconds)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-500">{hrs(r.totalSeconds)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-600">{fmt(r.avgSeconds)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{r.uniqueTasks}</td><td className="px-4 py-3 text-right text-gray-500">{r.uniqueOwners}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="bg-gray-50 font-semibold text-sm">
            <td className="px-4 py-3" colSpan={2}>Total</td><td className="px-4 py-3 text-right">{filtered.length}</td>
            <td className="px-4 py-3 text-right font-mono text-indigo-600">{fmt(totalSeconds)}</td>
            <td className="px-4 py-3 text-right font-mono text-gray-500">{hrs(totalSeconds)}</td><td colSpan={3}></td>
          </tr></tfoot>
        </table></div>
      )}

      </>)}
    </div>
  );
}
