"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Profile } from "@/lib/supabase";
import type { TaskData } from "@/lib/taskData";

type TimerState = "idle" | "running" | "stopped";

export default function ProcessTrackerForm({
  initialProfile,
}: {
  initialProfile: Profile | null;
}) {
  // Timer state
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Task hierarchy from database
  const [taskData, setTaskData] = useState<TaskData>({});
  const [taskDataLoading, setTaskDataLoading] = useState(true);

  // Form state — initialized directly from server-fetched profile
  const [poNumber, setPoNumber] = useState("");
  const [soNumber, setSoNumber] = useState("");
  const [department, setDepartment] = useState(initialProfile?.department ?? "");
  const [role, setRole] = useState(initialProfile?.role ?? "");
  const [category, setCategory] = useState("");
  const [taskName, setTaskName] = useState("");
  const [taskOwner, setTaskOwner] = useState(initialProfile?.name ?? "");
  const [notes, setNotes] = useState("");

  // UI state
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Fetch task hierarchy from Supabase
  useEffect(() => {
    const fetchTaskData = async () => {
      try {
        const res = await fetch("/api/task-hierarchy");
        if (res.ok) {
          const data = await res.json();
          setTaskData(data);
        }
      } catch {
        // Fall back silently — dropdowns will be empty
      } finally {
        setTaskDataLoading(false);
      }
    };
    fetchTaskData();
  }, []);

  // Derived dropdown options from database data
  const departments = Object.keys(taskData);
  const roles = department ? Object.keys(taskData[department] || {}) : [];
  const categories = department && role ? Object.keys(taskData[department]?.[role] || {}) : [];
  const tasks = department && role && category ? (taskData[department]?.[role]?.[category] || []) : [];

  // Timer
  const tick = useCallback(() => setElapsed((s) => s + 1), []);

  const handleStart = () => {
    setStartTime(new Date());
    setElapsed(0);
    setTimerState("running");
    intervalRef.current = setInterval(tick, 1000);
  };

  const handleStop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimerState("stopped");
  };

  const handleReset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimerState("idle");
    setElapsed(0);
    setStartTime(null);
  };

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Only reset category/task when user manually changes department or role
  const prevDept = useRef(initialProfile?.department ?? "");
  const prevRole = useRef(initialProfile?.role ?? "");

  const handleDepartmentChange = (val: string) => {
    setDepartment(val);
    if (val !== prevDept.current) {
      setRole("");
      setCategory("");
      setTaskName("");
      prevDept.current = val;
    }
  };

  const handleRoleChange = (val: string) => {
    setRole(val);
    if (val !== prevRole.current) {
      setCategory("");
      setTaskName("");
      prevRole.current = val;
    }
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const resetForm = () => {
    setPoNumber("");
    setSoNumber("");
    setCategory("");
    setTaskName("");
    setNotes("");
    setElapsed(0);
    setStartTime(null);
    setTimerState("idle");
    setSubmitStatus("idle");
    setDepartment(initialProfile?.department ?? "");
    setRole(initialProfile?.role ?? "");
    setTaskOwner(initialProfile?.name ?? "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!department || !role || !category || !taskName || !taskOwner) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }
    if (timerState === "idle") {
      setErrorMsg("Please start and stop the timer before submitting.");
      return;
    }

    const finalElapsed = elapsed;
    if (timerState === "running") handleStop();
    setSubmitStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_number: poNumber || null,
          so_number: soNumber || null,
          department,
          role,
          task_category: category,
          task_name: taskName,
          task_owner: taskOwner,
          notes: notes || null,
          start_time: startTime?.toISOString() ?? null,
          end_time: new Date().toISOString(),
          duration_seconds: finalElapsed,
        }),
      });
      if (!res.ok) throw new Error("Failed to save entry");
      setSubmitStatus("success");
      setTimeout(resetForm, 2000);
    } catch {
      setSubmitStatus("error");
      setErrorMsg("Failed to save entry. Please try again.");
    }
  };

  const timerColor =
    timerState === "running"
      ? "text-green-600"
      : timerState === "stopped"
      ? "text-[#003087]"
      : "text-gray-400";

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#003087] mb-6">Process Tracker</h1>

      {/* Timer */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Timer</h2>
        <div className={`text-6xl font-mono font-bold text-center mb-5 ${timerColor}`}>
          {formatTime(elapsed)}
        </div>
        <div className="flex justify-center gap-3">
          {timerState === "idle" && (
            <button onClick={handleStart} className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors">
              ▶ Start
            </button>
          )}
          {timerState === "running" && (
            <button onClick={handleStop} className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors">
              ■ Stop
            </button>
          )}
          {timerState === "stopped" && (
            <>
              <button onClick={handleStart} className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors">
                ▶ Restart
              </button>
              <button onClick={handleReset} className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors">
                ↺ Reset
              </button>
            </>
          )}
        </div>
        {startTime && (
          <p className="text-center text-xs text-gray-400 mt-3">
            Started at {startTime.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Entry Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Entry Details</h2>

        {taskDataLoading && (
          <p className="text-sm text-gray-400">Loading task options...</p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PO Number</label>
            <input type="text" value={poNumber} onChange={(e) => setPoNumber(e.target.value)}
              placeholder="e.g. PO-123456"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SO Number</label>
            <input type="text" value={soNumber} onChange={(e) => setSoNumber(e.target.value)}
              placeholder="e.g. SO-789012"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Department <span className="text-red-500">*</span>
          </label>
          <select value={department} onChange={(e) => handleDepartmentChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]">
            <option value="">Select Department</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role <span className="text-red-500">*</span>
          </label>
          <select value={role} onChange={(e) => handleRoleChange(e.target.value)}
            disabled={!department}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] disabled:bg-gray-100 disabled:text-gray-400">
            <option value="">Select Role</option>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Task Category <span className="text-red-500">*</span>
          </label>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setTaskName(""); }}
            disabled={!role}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] disabled:bg-gray-100 disabled:text-gray-400">
            <option value="">Select Category</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Task Name <span className="text-red-500">*</span>
          </label>
          <select value={taskName} onChange={(e) => setTaskName(e.target.value)}
            disabled={!category}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] disabled:bg-gray-100 disabled:text-gray-400">
            <option value="">Select Task</option>
            {tasks.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Task Owner <span className="text-red-500">*</span>
          </label>
          <input type="text" value={taskOwner} onChange={(e) => setTaskOwner(e.target.value)}
            placeholder="Your name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] bg-gray-50" />
          {initialProfile && (
            <p className="text-xs text-green-600 mt-1">✓ Auto-filled from your account</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this task..." rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] resize-none" />
        </div>

        {errorMsg && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
        )}

        <button type="submit"
          disabled={submitStatus === "loading" || submitStatus === "success"}
          className={`w-full py-3 rounded-lg font-semibold text-white transition-colors ${
            submitStatus === "success" ? "bg-green-600 cursor-default"
            : submitStatus === "loading" ? "bg-gray-400 cursor-not-allowed"
            : "bg-[#003087] hover:bg-[#002060]"
          }`}>
          {submitStatus === "loading" ? "Saving..."
            : submitStatus === "success" ? "✓ Entry Saved!"
            : "Submit Entry"}
        </button>
      </form>
    </div>
  );
}
