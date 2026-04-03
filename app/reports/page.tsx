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
type Tab = "dashboard" | "entries" | "benchmarks" | "outliers" | "rollup";
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

  // ── Sort state for each table ─────────────────────────────
  const [entriesSortCol, setEntriesSortCol] = useState<string>("date");
  const [entriesSortDir, setEntriesSortDir] = useState<"asc" | "desc">("desc");
  const [benchmarkSortCol, setBenchmarkSortCol] = useState<string>("taskName");
  const [benchmarkSortDir, setBenchmarkSortDir] = useState<"asc" | "desc">("asc");
  const [outlierSortCol, setOutlierSortCol] = useState<string>("zScore");
  const [outlierSortDir, setOutlierSortDir] = useState<"asc" | "desc">("desc");
  const [rollupSortCol, setRollupSortCol] = useState<string>("department");
  const [rollupSortDir, setRollupSortDir] = useState<"asc" | "desc">("asc");

  // ── Sort handlers ────────────────────────────────────────
  const handleEntriesSort = (col: string) => {
    if (entriesSortCol === col) {
      setEntriesSortDir(entriesSortDir === "asc" ? "desc" : "asc");
    } else {
      setEntriesSortCol(col);
      setEntriesSortDir("asc");
    }
  };

  const handleBenchmarkSort = (col: string) => {
    if (benchmarkSortCol === col) {
      setBenchmarkSortDir(benchmarkSortDir === "asc" ? "desc" : "asc");
    } else {
      setBenchmarkSortCol(col);
      setBenchmarkSortDir("asc");
    }
  };

  const handleOutlierSort = (col: string) => {
    if (outlierSortCol === col) {
      setOutlierSortDir(outlierSortDir === "asc" ? "desc" : "asc");
    } else {
      setOutlierSortCol(col);
      setOutlierSortDir("asc");
    }
  };

  const handleRollupSort = (col: string) => {
    if (rollupSortCol === col) {
      setRollupSortDir(rollupSortDir === "asc" ? "desc" : "asc");
    } else {
      setRollupSortCol(col);
      setRollupSortDir("asc");
    }
  };

  // ── Pagination state ──────────────────────────────────────
  const [entriesPage, setEntriesPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(50);
  const [benchmarkPage, setBenchmarkPage] = useState(1);
  const [benchmarkPerPage, setBenchmarkPerPage] = useState(25);
  const [outlierPage, setOutlierPage] = useState(1);
  const [outlierPerPage, setOutlierPerPage] = useState(25);

  // Reset pages when filters/sort change
  useEffect(() => { setEntriesPage(1); }, [fDept, fRole, fCategory, fTask, fOwner, fDateFrom, fDateTo, entriesSortCol, entriesSortDir]);
  useEffect(() => { setBenchmarkPage(1); }, [fDept, fRole, fCategory, fTask, fOwner, fDateFrom, fDateTo, benchmarkSortCol, benchmarkSortDir]);
  useEffect(() => { setOutlierPage(1); }, [fDept, fRole, fCategory, fTask, fOwner, fDateFrom, fDateTo, outlierSortCol, outlierSortDir]);

  // Drill-down: clicking a chart element sets filters and shows entries
  const drillTo = (filters: { category?: string; task?: string; owner?: string; dept?: string; role?: string; dateFrom?: string; dateTo?: string }) => {
    if (filters.category !== undefined) setFCategory(filters.category);
    if (filters.task !== undefined) setFTask(filters.task);
    if (filters.owner !== undefined) setFOwner(filters.owner);
    if (filters.dept !== undefined) setFDept(filters.dept);
    if (filters.role !== undefined) setFRole(filters.role);
    if (filters.dateFrom !== undefined) setFDateFrom(filters.dateFrom);
    if (filters.dateTo !== undefined) setFDateTo(filters.dateTo);
    setTab("entries");
  };

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
    if (!authLoading && (profile?.is_admin || profile?.is_manager)) fetchEntries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, profile]);

  // For managers, pre-filter entries to their department only
  const accessibleEntries = useMemo(() => {
    if (profile?.is_admin) return entries;
    if (profile?.is_manager) return entries.filter((e) => e.department === profile.department);
    return [];
  }, [entries, profile]);

  // Filter options
  const depts = Array.from(new Set(accessibleEntries.map((e) => e.department))).sort();
  const rolesOpts = Array.from(new Set(accessibleEntries.map((e) => e.role))).sort();
  const cats = Array.from(new Set(accessibleEntries.map((e) => e.task_category))).sort();
  const taskNames = fCategory ? Array.from(new Set(accessibleEntries.filter((e) => e.task_category === fCategory).map((e) => e.task_name))).sort() : Array.from(new Set(accessibleEntries.map((e) => e.task_name))).sort();
  const owners = Array.from(new Set(accessibleEntries.map((e) => e.task_owner))).sort();

  // Filtered
  const filtered = useMemo(() => accessibleEntries.filter((e) => {
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

  // ── Sorted data ───────────────────────────────────────────
  const sortedEntries = useMemo(() => {
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let aVal: any = "";
      let bVal: any = "";
      switch (entriesSortCol) {
        case "date":
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        case "owner":
          aVal = a.task_owner;
          bVal = b.task_owner;
          break;
        case "dept":
          aVal = a.department;
          bVal = b.department;
          break;
        case "role":
          aVal = a.role;
          bVal = b.role;
          break;
        case "category":
          aVal = a.task_category;
          bVal = b.task_category;
          break;
        case "task":
          aVal = a.task_name;
          bVal = b.task_name;
          break;
        case "po":
          aVal = a.po_number || "";
          bVal = b.po_number || "";
          break;
        case "so":
          aVal = a.so_number || "";
          bVal = b.so_number || "";
          break;
        case "duration":
          aVal = a.duration_seconds || 0;
          bVal = b.duration_seconds || 0;
          break;
        default:
          return 0;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return entriesSortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return entriesSortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [filtered, entriesSortCol, entriesSortDir]);

  const sortedBenchmarks = useMemo(() => {
    const sorted = [...benchmarks];
    sorted.sort((a, b) => {
      let aVal: any = "";
      let bVal: any = "";
      switch (benchmarkSortCol) {
        case "taskName":
          aVal = a.taskName;
          bVal = b.taskName;
          break;
        case "category":
          aVal = a.category;
          bVal = b.category;
          break;
        case "owner":
          aVal = a.owner;
          bVal = b.owner;
          break;
        case "entries":
          aVal = a.entryCount;
          bVal = b.entryCount;
          break;
        case "avg":
          aVal = a.avgSeconds;
          bVal = b.avgSeconds;
          break;
        case "min":
          aVal = a.minSeconds;
          bVal = b.minSeconds;
          break;
        case "max":
          aVal = a.maxSeconds;
          bVal = b.maxSeconds;
          break;
        case "stddev":
          aVal = a.stddevSeconds;
          bVal = b.stddevSeconds;
          break;
        case "globalAvg":
          aVal = a.avgSeconds;
          bVal = b.avgSeconds;
          break;
        default:
          return 0;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return benchmarkSortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return benchmarkSortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [benchmarks, benchmarkSortCol, benchmarkSortDir]);

  const sortedOutliers = useMemo(() => {
    const sorted = [...outliers];
    sorted.sort((a, b) => {
      let aVal: any = "";
      let bVal: any = "";
      switch (outlierSortCol) {
        case "flag":
          aVal = a.zScore > 0 ? "SLOW" : "FAST";
          bVal = b.zScore > 0 ? "SLOW" : "FAST";
          break;
        case "date":
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        case "owner":
          aVal = a.task_owner;
          bVal = b.task_owner;
          break;
        case "task":
          aVal = a.task_name;
          bVal = b.task_name;
          break;
        case "category":
          aVal = a.task_category;
          bVal = b.task_category;
          break;
        case "duration":
          aVal = a.duration_seconds || 0;
          bVal = b.duration_seconds || 0;
          break;
        case "taskAvg":
          aVal = a.taskAvg;
          bVal = b.taskAvg;
          break;
        case "deviation":
          aVal = Math.abs((a.duration_seconds || 0) - a.taskAvg);
          bVal = Math.abs((b.duration_seconds || 0) - b.taskAvg);
          break;
        case "zScore":
          aVal = Math.abs(a.zScore);
          bVal = Math.abs(b.zScore);
          break;
        default:
          return 0;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return outlierSortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return outlierSortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [outliers, outlierSortCol, outlierSortDir]);

  const sortedRollup = useMemo(() => {
    const sorted = [...rollup];
    sorted.sort((a, b) => {
      let aVal: any = "";
      let bVal: any = "";
      switch (rollupSortCol) {
        case "department":
          aVal = a.department;
          bVal = b.department;
          break;
        case "role":
          aVal = a.role;
          bVal = b.role;
          break;
        case "entries":
          aVal = a.entryCount;
          bVal = b.entryCount;
          break;
        case "total":
          aVal = a.totalSeconds;
          bVal = b.totalSeconds;
          break;
        case "hours":
          aVal = a.totalSeconds;
          bVal = b.totalSeconds;
          break;
        case "avg":
          aVal = a.avgSeconds;
          bVal = b.avgSeconds;
          break;
        case "tasks":
          aVal = a.uniqueTasks;
          bVal = b.uniqueTasks;
          break;
        case "owners":
          aVal = a.uniqueOwners;
          bVal = b.uniqueOwners;
          break;
        default:
          return 0;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return rollupSortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return rollupSortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [rollup, rollupSortCol, rollupSortDir]);

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
  if (!profile?.is_admin && !profile?.is_manager) return (<div className="max-w-sm mx-auto mt-20 text-center"><p className="text-gray-500 text-lg">Access Denied</p><p className="text-gray-400 text-sm mt-2">Admin or manager access required.</p></div>);

  const hasFilters = fDept || fRole || fCategory || fTask || fOwner || fDateFrom || fDateTo;
  const clearFilters = () => { setFDept(""); setFRole(""); setFCategory(""); setFTask(""); setFOwner(""); setFDateFrom(""); setFDateTo(""); };
  const sel = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]";
  const exportEntriesCSV = () => {
    const h = ["Date", "Owner", "Department", "Role", "Category", "Task", "PO #", "SO #", "Duration (s)", "Duration (min)", "Duration (hrs)", "Notes"];
    const rows = filtered.map((e) => [new Date(e.created_at).toISOString().slice(0, 19), e.task_owner, e.department, e.role, e.task_category, e.task_name, e.po_number || "", e.so_number || "", String(e.duration_seconds || 0), mins(e.duration_seconds || 0), hrs(e.duration_seconds || 0), e.notes || ""]);
    downloadCSV([h, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n"), "filtered-entries.csv");
  };

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "entries", label: "Entries" },
    { key: "benchmarks", label: "Benchmarks" },
    { key: "outliers", label: "Outliers", badge: outliers.length },
    { key: "rollup", label: "Dept / Role" },
  ];
  const catTotal = categoryBreakdown.reduce((s, c) => s + c.seconds, 0) || 1;
  const maxTaskTotal = topTasks.length > 0 ? topTasks[0].total : 1;
  const maxUserTotal = userLeaderboard.length > 0 ? userLeaderboard[0].total : 1;

  // ── Sort indicator helper ────────────────────────────────
  const SortIndicator = ({ col, active, dir }: { col: string; active: boolean; dir: "asc" | "desc" }) => {
    if (!active) return null;
    return <span className="ml-1 text-xs">{dir === "asc" ? "▲" : "▼"}</span>;
  };

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
        <button onClick={tab === "dashboard" ? exportDashboardCSV : tab === "entries" ? exportEntriesCSV : tab === "benchmarks" ? exportBenchmarkCSV : tab === "outliers" ? exportOutlierCSV : exportRollupCSV}
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
                  <div key={i} onClick={() => drillTo({ category: c.name })} className="cursor-pointer group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700 group-hover:text-[#6366F1] transition-colors">{c.name}</span>
                      <span className="text-xs text-gray-400 font-mono">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: pct + "%", backgroundColor: colorFor(i) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Tasks */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 10 Tasks by Time</h3>
            <div className="space-y-2">
              {topTasks.map((t, i) => {
                const pct = (t.total / maxTaskTotal) * 100;
                return (
                  <div key={i} onClick={() => drillTo({ task: t.name })} className="cursor-pointer group">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium text-gray-700 group-hover:text-[#6366F1] transition-colors truncate">{t.name}</span>
                      <span className="text-xs text-gray-400 font-mono ml-2">{hrs(t.total)}h</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: pct + "%", backgroundColor: colorFor(i) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row: User Leaderboard + Activity Heatmap */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* User Leaderboard */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">User Leaderboard (by time)</h3>
            <div className="space-y-2">
              {userLeaderboard.slice(0, 10).map((u, i) => {
                const pct = (u.total / maxUserTotal) * 100;
                return (
                  <div key={i} onClick={() => drillTo({ owner: u.name })} className="cursor-pointer group">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium text-gray-700 group-hover:text-[#6366F1] transition-colors">{u.name}</span>
                      <span className="text-xs text-gray-400 font-mono">{hrs(u.total)}h ({u.count} entries)</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: pct + "%", backgroundColor: colorFor(i) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day-of-Week Heatmap */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Activity by Day</h3>
            <div className="flex gap-1.5 items-end justify-between">
              {dayOfWeek.map((val, i) => {
                const h = (val / maxDay) * 100;
                const minHeight = h === 0 ? 8 : Math.max(h, 8);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col items-center gap-1">
                      <div className="w-full bg-gray-100 rounded" style={{ height: minHeight + "px", backgroundColor: h === 0 ? "#e5e7eb" : colorFor(i) }} />
                      <span className="text-xs font-medium text-gray-500">{dayName(i)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Hourly Heatmap */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Activity by Hour</h3>
          <div className="flex gap-0.5 items-end" style={{ height: "80px" }}>
            {hourly.map((val, i) => {
              const h = (val / maxHour) * 100;
              const minHeight = h === 0 ? 2 : Math.max(h, 2);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-indigo-400 rounded-t" style={{ height: minHeight + "px" }} title={`${i}:00 - ${val} entries`} />
                  <span className="text-xs text-gray-400">{i}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trend Chart (weekly or monthly) */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Trend ({granularity === "week" ? "Weekly" : "Monthly"})</h3>
            <div className="flex gap-2">
              <button onClick={() => setGranularity("week")} className={`text-xs px-2 py-1 rounded ${granularity === "week" ? "bg-indigo-100 text-indigo-700 font-medium" : "text-gray-500 hover:text-gray-700"}`}>Week</button>
              <button onClick={() => setGranularity("month")} className={`text-xs px-2 py-1 rounded ${granularity === "month" ? "bg-indigo-100 text-indigo-700 font-medium" : "text-gray-500 hover:text-gray-700"}`}>Month</button>
            </div>
          </div>
          <div className="flex gap-1 items-end" style={{ height: "120px" }}>
            {trendData.map((t, i) => {
              const h = (t.avg / maxTrendAvg) * 100;
              const minHeight = h === 0 ? 4 : Math.max(h, 4);
              const label = granularity === "week" ? t.period.slice(5) : t.period;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-emerald-400 rounded-t" style={{ height: minHeight + "px" }} title={`${label}: ${mins(t.avg)}min avg`} />
                  <span className="text-xs text-gray-400 whitespace-nowrap">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>)}

      {/* ═══════ ENTRIES (drill-down) ═══════ */}
      {tab === "entries" && (<div>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => { clearFilters(); setTab("dashboard"); }}
            className="text-sm text-[#6366F1] hover:underline font-medium">← Back to Dashboard</button>
          {hasFilters && <span className="text-xs text-gray-400">Showing filtered entries</span>}
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleEntriesSort("date")}>Date<SortIndicator col="date" active={entriesSortCol === "date"} dir={entriesSortDir} /></th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleEntriesSort("owner")}>Owner<SortIndicator col="owner" active={entriesSortCol === "owner"} dir={entriesSortDir} /></th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleEntriesSort("dept")}>Dept<SortIndicator col="dept" active={entriesSortCol === "dept"} dir={entriesSortDir} /></th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleEntriesSort("role")}>Role<SortIndicator col="role" active={entriesSortCol === "role"} dir={entriesSortDir} /></th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleEntriesSort("category")}>Category<SortIndicator col="category" active={entriesSortCol === "category"} dir={entriesSortDir} /></th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleEntriesSort("task")}>Task<SortIndicator col="task" active={entriesSortCol === "task"} dir={entriesSortDir} /></th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleEntriesSort("po")}>PO #<SortIndicator col="po" active={entriesSortCol === "po"} dir={entriesSortDir} /></th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleEntriesSort("so")}>SO #<SortIndicator col="so" active={entriesSortCol === "so"} dir={entriesSortDir} /></th>
              <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleEntriesSort("duration")}>Duration<SortIndicator col="duration" active={entriesSortCol === "duration"} dir={entriesSortDir} /></th>
              <th className="px-4 py-3">Notes</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {sortedEntries.slice((entriesPage - 1) * entriesPerPage, entriesPage * entriesPerPage).map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium">{e.task_owner}</td>
                  <td className="px-4 py-3 text-gray-600">{e.department}</td>
                  <td className="px-4 py-3 text-gray-600">{e.role}</td>
                  <td className="px-4 py-3 text-gray-600">{e.task_category}</td>
                  <td className="px-4 py-3 font-medium text-[#6366F1]">{e.task_name}</td>
                  <td className="px-4 py-3 text-gray-500">{e.po_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{e.so_number || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-indigo-600">{fmt(e.duration_seconds || 0)}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{e.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-gray-50 font-semibold text-sm">
              <td className="px-4 py-3 text-gray-600" colSpan={8}>Total ({filtered.length} entries)</td>
              <td className="px-4 py-3 text-right font-mono text-indigo-600">{fmt(totalSeconds)}</td>
              <td className="px-4 py-3 text-gray-400 text-xs">{hrs(totalSeconds)} hrs</td>
            </tr></tfoot>
          </table>
        </div>
        {/* Entries Pagination */}
        <div className="flex items-center justify-between mt-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Show</span>
            {[50, 100, 200].map((n) => (
              <button key={n} onClick={() => { setEntriesPerPage(n); setEntriesPage(1); }}
                className={`px-2.5 py-1 rounded text-xs font-medium ${entriesPerPage === n ? "bg-[#1A3C28] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{n}</button>
            ))}
            <span className="text-gray-500">per page</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500">Page {entriesPage} of {Math.max(1, Math.ceil(sortedEntries.length / entriesPerPage))}</span>
            <button onClick={() => setEntriesPage((p) => Math.max(1, p - 1))} disabled={entriesPage <= 1}
              className="px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
            <button onClick={() => setEntriesPage((p) => Math.min(Math.ceil(sortedEntries.length / entriesPerPage), p + 1))} disabled={entriesPage >= Math.ceil(sortedEntries.length / entriesPerPage)}
              className="px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      </div>)}

      {/* ═══════ BENCHMARKS ═══════ */}
      {tab === "benchmarks" && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleBenchmarkSort("taskName")}>Task<SortIndicator col="taskName" active={benchmarkSortCol === "taskName"} dir={benchmarkSortDir} /></th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleBenchmarkSort("category")}>Category<SortIndicator col="category" active={benchmarkSortCol === "category"} dir={benchmarkSortDir} /></th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleBenchmarkSort("owner")}>Owner<SortIndicator col="owner" active={benchmarkSortCol === "owner"} dir={benchmarkSortDir} /></th>
              <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleBenchmarkSort("entries")}>Entries<SortIndicator col="entries" active={benchmarkSortCol === "entries"} dir={benchmarkSortDir} /></th>
              <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleBenchmarkSort("avg")}>Avg<SortIndicator col="avg" active={benchmarkSortCol === "avg"} dir={benchmarkSortDir} /></th>
              <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleBenchmarkSort("min")}>Min<SortIndicator col="min" active={benchmarkSortCol === "min"} dir={benchmarkSortDir} /></th>
              <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleBenchmarkSort("max")}>Max<SortIndicator col="max" active={benchmarkSortCol === "max"} dir={benchmarkSortDir} /></th>
              <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleBenchmarkSort("stddev")}>StdDev<SortIndicator col="stddev" active={benchmarkSortCol === "stddev"} dir={benchmarkSortDir} /></th>
              <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleBenchmarkSort("globalAvg")}>Global Avg<SortIndicator col="globalAvg" active={benchmarkSortCol === "globalAvg"} dir={benchmarkSortDir} /></th>
              <th className="px-4 py-3 text-right">vs Global</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {sortedBenchmarks.slice((benchmarkPage - 1) * benchmarkPerPage, benchmarkPage * benchmarkPerPage).map((b, i) => {
                const gKey = `${b.department}||${b.category}||${b.taskName}`; const g = taskAverages.get(gKey);
                const variance = g ? ((b.avgSeconds - g.globalAvg) / (g.globalAvg || 1)) * 100 : 0;
                return (
                  <tr key={i} onClick={() => drillTo({ task: b.taskName, owner: b.owner, category: b.category })} className="hover:bg-indigo-50 cursor-pointer">
                    <td className="px-4 py-3 font-medium text-[#6366F1] hover:underline">{b.taskName}</td>
                    <td className="px-4 py-3 text-gray-500">{b.category}</td>
                    <td className="px-4 py-3 font-medium hover:underline">{b.owner}</td>
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
        {/* Benchmarks Pagination */}
        {sortedBenchmarks.length > 0 && (
          <div className="flex items-center justify-between mt-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Show</span>
              {[25, 50, 100, 200].map((n) => (
                <button key={n} onClick={() => { setBenchmarkPerPage(n); setBenchmarkPage(1); }}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${benchmarkPerPage === n ? "bg-[#1A3C28] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{n}</button>
              ))}
              <span className="text-gray-500">per page</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500">Page {benchmarkPage} of {Math.max(1, Math.ceil(sortedBenchmarks.length / benchmarkPerPage))}</span>
              <button onClick={() => setBenchmarkPage((p) => Math.max(1, p - 1))} disabled={benchmarkPage <= 1}
                className="px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
              <button onClick={() => setBenchmarkPage((p) => Math.min(Math.ceil(sortedBenchmarks.length / benchmarkPerPage), p + 1))} disabled={benchmarkPage >= Math.ceil(sortedBenchmarks.length / benchmarkPerPage)}
                className="px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
            </div>
          </div>
        )}
      )}

      {/* ═══════ OUTLIERS ═══════ */}
      {tab === "outliers" && (<div>
        <p className="text-sm text-gray-500 mb-4">Entries 1.5+ standard deviations from task average. <span className="text-red-500 font-medium">Red = slow</span>, <span className="text-emerald-500 font-medium">Green = fast</span>.</p>
        {outliers.length === 0 ? <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">All entries within normal range.</div>
        : (<div className="overflow-x-auto rounded-xl border border-gray-200 bg-white"><table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleOutlierSort("flag")}>Flag<SortIndicator col="flag" active={outlierSortCol === "flag"} dir={outlierSortDir} /></th>
            <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleOutlierSort("date")}>Date<SortIndicator col="date" active={outlierSortCol === "date"} dir={outlierSortDir} /></th>
            <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleOutlierSort("owner")}>Owner<SortIndicator col="owner" active={outlierSortCol === "owner"} dir={outlierSortDir} /></th>
            <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleOutlierSort("task")}>Task<SortIndicator col="task" active={outlierSortCol === "task"} dir={outlierSortDir} /></th>
            <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleOutlierSort("category")}>Category<SortIndicator col="category" active={outlierSortCol === "category"} dir={outlierSortDir} /></th>
            <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleOutlierSort("duration")}>Duration<SortIndicator col="duration" active={outlierSortCol === "duration"} dir={outlierSortDir} /></th>
            <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleOutlierSort("taskAvg")}>Task Avg<SortIndicator col="taskAvg" active={outlierSortCol === "taskAvg"} dir={outlierSortDir} /></th>
            <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleOutlierSort("deviation")}>Deviation<SortIndicator col="deviation" active={outlierSortCol === "deviation"} dir={outlierSortDir} /></th>
            <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleOutlierSort("zScore")}>Z-Score<SortIndicator col="zScore" active={outlierSortCol === "zScore"} dir={outlierSortDir} /></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {sortedOutliers.slice((outlierPage - 1) * outlierPerPage, outlierPage * outlierPerPage).map((o) => (
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
        </table></div>
        {/* Outliers Pagination */}
        <div className="flex items-center justify-between mt-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Show</span>
            {[25, 50, 100, 200].map((n) => (
              <button key={n} onClick={() => { setOutlierPerPage(n); setOutlierPage(1); }}
                className={`px-2.5 py-1 rounded text-xs font-medium ${outlierPerPage === n ? "bg-[#1A3C28] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{n}</button>
            ))}
            <span className="text-gray-500">per page</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500">Page {outlierPage} of {Math.max(1, Math.ceil(sortedOutliers.length / outlierPerPage))}</span>
            <button onClick={() => setOutlierPage((p) => Math.max(1, p - 1))} disabled={outlierPage <= 1}
              className="px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
            <button onClick={() => setOutlierPage((p) => Math.min(Math.ceil(sortedOutliers.length / outlierPerPage), p + 1))} disabled={outlierPage >= Math.ceil(sortedOutliers.length / outlierPerPage)}
              className="px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
        )}
      </div>)}

      {/* ═══════ ROLLUP ═══════ */}
      {tab === "rollup" && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white"><table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleRollupSort("department")}>Department<SortIndicator col="department" active={rollupSortCol === "department"} dir={rollupSortDir} /></th>
            <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleRollupSort("role")}>Role<SortIndicator col="role" active={rollupSortCol === "role"} dir={rollupSortDir} /></th>
            <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleRollupSort("entries")}>Entries<SortIndicator col="entries" active={rollupSortCol === "entries"} dir={rollupSortDir} /></th>
            <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleRollupSort("total")}>Total Time<SortIndicator col="total" active={rollupSortCol === "total"} dir={rollupSortDir} /></th>
            <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleRollupSort("hours")}>Hours<SortIndicator col="hours" active={rollupSortCol === "hours"} dir={rollupSortDir} /></th>
            <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleRollupSort("avg")}>Avg / Entry<SortIndicator col="avg" active={rollupSortCol === "avg"} dir={rollupSortDir} /></th>
            <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleRollupSort("tasks")}>Tasks<SortIndicator col="tasks" active={rollupSortCol === "tasks"} dir={rollupSortDir} /></th>
            <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleRollupSort("owners")}>Owners<SortIndicator col="owners" active={rollupSortCol === "owners"} dir={rollupSortDir} /></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {sortedRollup.map((r, i) => (
              <tr key={i} onClick={() => drillTo({ dept: r.department, role: r.role })} className="hover:bg-indigo-50 cursor-pointer">
                <td className="px-4 py-3 font-medium hover:text-[#6366F1] hover:underline">{r.department}</td><td className="px-4 py-3 text-gray-600">{r.role}</td>
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
