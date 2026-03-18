"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getDepartments,
  getRolesForDepartment,
  getCategoriesForRole,
  getTasksForCategory,
} from "@/lib/taskData";

type TimerState = "idle" | "running" | "stopped";

export default function ProcessTracker() {
  // Timer state
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Form state
  const [poNumber, setPoNumber] = useState("");
  const [soNumber, setSoNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const [category, setCategory] = useState("");
  const [taskName, setTaskName] = useState("");
  const [taskOwner, setTaskOwner] = useState("");
  const [notes, setNotes] = useState("");
  const [employees, setEmployees] = useState<{ name: string; role: string }[]>(
    []
  );

  // UI state
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Derived options
  const departments = getDepartments();
  const roles = getRolesForDepartment(department);
  const categories = getCategoriesForRole(department, role);
  const tasks = getTasksForCategory(department, role, category);

  // Fetch active employees for the task owner dropdown
  useEffect(() => {
    fetch("/api/employees?active=true")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setEmployees(data);
      })
      .catch(() => {});
  }, []);

  // Timer logic
  const tick = useCallback(() => {
    setElapsed((prev) => prev + 1);
  }, []);

  const handleStart = () => {
    const now = new Date();
    setStartTime(now);
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
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Reset downstream selects when parent changes
  useEffect(() => {
    setRole("");
    setCategory("");
    setTaskName("");
  }, [department]);

  useEffect(() => {
    setCategory("");
    setTaskName("");
  }, [role]);

  useEffect(() => {
    setTaskName("");
  }, [category]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
      .toString()
      .padStart(2, "0");
    const m = Math.floor((seconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
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

    setSubmitStatus("loading");
    setErrorMsg("");

    const endTime = timerState === "running" ? new Date() : undefined;
    if (timerState === "running") handleStop();

    const payload = {
      po_number: poNumber || null,
      so_number: soNumber || null,
      department,
      role,
      task_category: category,
      task_name: taskName,
      task_owner: taskOwner,
      notes: notes || null,
      start_time: startTime?.toISOString(),
      end_time: (endTime || new Date()).toISOString(),
      duration_seconds: elapsed,
    };

    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save entry");

      setSubmitStatus("success");
      // Reset form
      setTimeout(() => {
        setPoNumber("");
        setSoNumber("");
        setDepartment("");
        setRole("");
        setCategory("");
        setTaskName("");
        setTaskOwner("");
        setNotes("");
        setElapsed(0);
        setStartTime(null);
        setTimerState("idle");
        setSubmitStatus("idle");
      }, 2000);
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
      <h1 className="text-2xl font-bold text-[#003087] mb-6">
        Process Tracker
      </h1>

      {/* Timer Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Timer
        </h2>
        <div className={`text-6xl font-mono font-bold text-center mb-5 ${timerColor}`}>
          {formatTime(elapsed)}
        </div>
        <div className="flex justify-center gap-3">
          {timerState === "idle" && (
            <button
              onClick={handleStart}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              ▶ Start
            </button>
          )}
          {timerState === "running" && (
            <button
              onClick={handleStop}
              className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
            >
              ■ Stop
            </button>
          )}
          {timerState === "stopped" && (
            <>
              <button
                onClick={handleStart}
                className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                ▶ Restart
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
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
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4"
      >
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Entry Details
        </h2>

        {/* PO / SO Numbers */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PO Number
            </label>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="e.g. PO-123456"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SO Number
            </label>
            <input
              type="text"
              value={soNumber}
              onChange={(e) => setSoNumber(e.target.value)}
              placeholder="e.g. SO-789012"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
            />
          </div>
        </div>

        {/* Department */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Department <span className="text-red-500">*</span>
          </label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
          >
            <option value="">Select Department</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={!department}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">Select Role</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Task Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Task Category <span className="text-red-500">*</span>
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={!role}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">Select Category</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Task Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Task Name <span className="text-red-500">*</span>
          </label>
          <select
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            disabled={!category}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">Select Task</option>
            {tasks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Task Owner */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Task Owner <span className="text-red-500">*</span>
          </label>
          {employees.length > 0 ? (
            <select
              value={taskOwner}
              onChange={(e) => setTaskOwner(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
            >
              <option value="">Select Employee</option>
              {employees.map((emp) => (
                <option key={emp.name} value={emp.name}>
                  {emp.name} — {emp.role}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={taskOwner}
              onChange={(e) => setTaskOwner(e.target.value)}
              placeholder="Enter name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
            />
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this task..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] resize-none"
          />
        </div>

        {/* Error */}
        {errorMsg && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitStatus === "loading" || submitStatus === "success"}
          className={`w-full py-3 rounded-lg font-semibold text-white transition-colors ${
            submitStatus === "success"
              ? "bg-green-600 cursor-default"
              : submitStatus === "loading"
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#003087] hover:bg-[#002060]"
          }`}
        >
          {submitStatus === "loading"
            ? "Saving..."
            : submitStatus === "success"
            ? "✓ Entry Saved!"
            : "Submit Entry"}
        </button>
      </form>
    </div>
  );
}
