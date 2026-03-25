"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Profile } from "@/lib/supabase";
import type { TaskData, TaskInfo } from "@/lib/taskData";

// --- Types ---

type SlotStatus = "running" | "paused" | "stopped";

type TaskSlot = {
  id: string;
  status: SlotStatus;
  elapsed: number; // accumulated seconds
  startTime: Date | null; // when this slot was first started
  lastResumed: number | null; // Date.now() when timer last resumed (for live ticking)
  // Form fields
  poNumber: string;
  soNumber: string;
  quoteNumber: string;
  department: string;
  role: string;
  category: string;
  taskName: string;
  taskOwner: string;
  notes: string;
  orderType: string;
  lineItemCount: string;
};

const MAX_SLOTS = 5;

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

// --- Component ---

export default function ProcessTrackerForm({
  initialProfile,
}: {
  initialProfile: Profile | null;
}) {
  // Task hierarchy from database
  const [taskData, setTaskData] = useState<TaskData>({});
  const [taskDataLoading, setTaskDataLoading] = useState(true);
  const [orderTypes, setOrderTypes] = useState<string[]>([]);

  // Multi-task slots
  const [slots, setSlots] = useState<TaskSlot[]>([]);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  // UI state
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Tick ref for the running timer
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch task hierarchy and order types from Supabase
  useEffect(() => {
    const fetchTaskData = async () => {
      try {
        const [hierRes, otRes] = await Promise.all([
          fetch("/api/task-hierarchy"),
          fetch("/api/task-hierarchy?type=order_types"),
        ]);
        if (hierRes.ok) setTaskData(await hierRes.json());
        if (otRes.ok) {
          const otData = await otRes.json();
          setOrderTypes(otData.map((o: { name: string }) => o.name));
        }
      } catch {
        // Fall back silently
      } finally {
        setTaskDataLoading(false);
      }
    };
    fetchTaskData();
  }, []);

  // Active slot helper
  const activeSlot = slots.find((s) => s.id === activeSlotId) ?? null;

  // Derived dropdown options for the active slot
  const departments = Object.keys(taskData);
  const roles = activeSlot?.department ? Object.keys(taskData[activeSlot.department] || {}) : [];
  const categories =
    activeSlot?.department && activeSlot?.role
      ? Object.keys(taskData[activeSlot.department]?.[activeSlot.role] || {})
      : [];
  const tasks: TaskInfo[] =
    activeSlot?.department && activeSlot?.role && activeSlot?.category
      ? taskData[activeSlot.department]?.[activeSlot.role]?.[activeSlot.category] || []
      : [];

  // Determine if dynamic fields should be shown based on selected task
  const selectedTaskInfo = tasks.find((t) => t.name === activeSlot?.taskName);
  const showOrderType = selectedTaskInfo?.showOrderType ?? false;
  const showLineItems = selectedTaskInfo?.showLineItems ?? false;

  // --- Timer tick ---
  // Single interval that ticks the running slot
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);

    const runningSlot = slots.find((s) => s.status === "running");
    if (!runningSlot) return;

    tickRef.current = setInterval(() => {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === runningSlot.id && s.status === "running"
            ? { ...s, elapsed: s.elapsed + 1 }
            : s
        )
      );
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [slots.find((s) => s.status === "running")?.id, slots.find((s) => s.status === "running")?.status]);

  // --- Slot actions ---

  const createNewSlot = () => {
    if (slots.length >= MAX_SLOTS) {
      setErrorMsg(`Maximum ${MAX_SLOTS} concurrent tasks allowed.`);
      return;
    }

    // Auto-pause any running slot
    setSlots((prev) =>
      prev.map((s) => (s.status === "running" ? { ...s, status: "paused" as const } : s))
    );

    const newSlot: TaskSlot = {
      id: generateId(),
      status: "paused",
      elapsed: 0,
      startTime: null,
      lastResumed: null,
      poNumber: "",
      soNumber: "",
      quoteNumber: "",
      department: initialProfile?.department ?? "",
      role: initialProfile?.role ?? "",
      category: "",
      taskName: "",
      taskOwner: initialProfile?.name ?? "",
      notes: "",
      orderType: "",
      lineItemCount: "",
    };

    setSlots((prev) => [...prev, newSlot]);
    setActiveSlotId(newSlot.id);
    setErrorMsg("");
  };

  const switchToSlot = (slotId: string) => {
    setActiveSlotId(slotId);
    setErrorMsg("");
    setSubmitStatus("idle");
  };

  const startOrResumeSlot = (slotId: string) => {
    setSlots((prev) =>
      prev.map((s) => {
        if (s.id === slotId) {
          return {
            ...s,
            status: "running" as const,
            startTime: s.startTime ?? new Date(),
            lastResumed: Date.now(),
          };
        }
        // Auto-pause any other running slot
        if (s.status === "running") {
          return { ...s, status: "paused" as const };
        }
        return s;
      })
    );
    setActiveSlotId(slotId);
    setErrorMsg("");
  };

  const pauseSlot = (slotId: string) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, status: "paused" as const } : s))
    );
  };

  const stopSlot = (slotId: string) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, status: "stopped" as const } : s))
    );
  };

  const discardSlot = (slotId: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
    if (activeSlotId === slotId) {
      const remaining = slots.filter((s) => s.id !== slotId);
      setActiveSlotId(remaining.length > 0 ? remaining[0].id : null);
    }
    setErrorMsg("");
    setSubmitStatus("idle");
  };

  // Update a field on the active slot
  const updateActiveSlot = (updates: Partial<TaskSlot>) => {
    if (!activeSlotId) return;
    setSlots((prev) =>
      prev.map((s) => (s.id === activeSlotId ? { ...s, ...updates } : s))
    );
  };

  const handleDepartmentChange = (val: string) => {
    if (!activeSlot) return;
    if (val !== activeSlot.department) {
      updateActiveSlot({ department: val, role: "", category: "", taskName: "", orderType: "", lineItemCount: "" });
    } else {
      updateActiveSlot({ department: val });
    }
  };

  const handleRoleChange = (val: string) => {
    if (!activeSlot) return;
    if (val !== activeSlot.role) {
      updateActiveSlot({ role: val, category: "", taskName: "", orderType: "", lineItemCount: "" });
    } else {
      updateActiveSlot({ role: val });
    }
  };

  const handleTaskNameChange = (val: string) => {
    if (!activeSlot) return;
    const newTaskInfo = tasks.find((t) => t.name === val);
    updateActiveSlot({
      taskName: val,
      orderType: newTaskInfo?.showOrderType ? activeSlot.orderType : "",
      lineItemCount: newTaskInfo?.showLineItems ? activeSlot.lineItemCount : "",
    });
  };

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSlot) return;

    if (!activeSlot.department || !activeSlot.role || !activeSlot.category || !activeSlot.taskName || !activeSlot.taskOwner) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }
    if (showOrderType && !activeSlot.orderType) {
      setErrorMsg("Please select an Order Type for this task.");
      return;
    }
    if (showLineItems && !activeSlot.lineItemCount) {
      setErrorMsg("Please enter the number of line items for this task.");
      return;
    }
    if (activeSlot.elapsed === 0 && activeSlot.status === "paused" && !activeSlot.startTime) {
      setErrorMsg("Please start the timer before submitting.");
      return;
    }

    // Stop the timer if still running
    if (activeSlot.status === "running") {
      stopSlot(activeSlot.id);
    }

    setSubmitStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_number: activeSlot.poNumber || null,
          so_number: activeSlot.soNumber || null,
          quote_number: activeSlot.quoteNumber || null,
          department: activeSlot.department,
          role: activeSlot.role,
          task_category: activeSlot.category,
          task_name: activeSlot.taskName,
          task_owner: activeSlot.taskOwner,
          notes: activeSlot.notes || null,
          order_type: activeSlot.orderType || null,
          line_item_count: activeSlot.lineItemCount ? parseInt(activeSlot.lineItemCount) : null,
          start_time: activeSlot.startTime?.toISOString() ?? null,
          end_time: new Date().toISOString(),
          duration_seconds: activeSlot.elapsed,
        }),
      });
      if (!res.ok) throw new Error("Failed to save entry");
      setSubmitStatus("success");
      setTimeout(() => {
        discardSlot(activeSlot.id);
        setSubmitStatus("idle");
      }, 1500);
    } catch {
      setSubmitStatus("error");
      setErrorMsg("Failed to save entry. Please try again.");
    }
  };

  // --- Formatting ---
  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const formatTimeShort = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  const getSlotLabel = (slot: TaskSlot) => {
    if (slot.taskName) return slot.taskName;
    if (slot.category) return slot.category;
    if (slot.role) return slot.role;
    if (slot.department) return slot.department;
    return "New Task";
  };

  // Timer display color for active slot
  const timerColor =
    activeSlot?.status === "running"
      ? "text-green-600"
      : activeSlot?.status === "stopped"
      ? "text-[#1A3C28]"
      : activeSlot?.status === "paused"
      ? "text-amber-600"
      : "text-gray-400";

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#1A3C28] mb-6">Process Tracker</h1>

      {/* Task Slot Cards */}
      <div className="flex flex-wrap gap-2 mb-4">
        {slots.map((slot) => (
          <button
            key={slot.id}
            onClick={() => switchToSlot(slot.id)}
            className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
              slot.id === activeSlotId
                ? slot.status === "running"
                  ? "bg-green-50 border-green-500 text-green-800 shadow-sm"
                  : slot.status === "paused"
                  ? "bg-amber-50 border-amber-400 text-amber-800 shadow-sm"
                  : "bg-gray-50 border-[#1A3C28] text-[#1A3C28] shadow-sm"
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
            }`}
          >
            {/* Status indicator dot */}
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                slot.status === "running"
                  ? "bg-green-500 animate-pulse"
                  : slot.status === "paused"
                  ? "bg-amber-400"
                  : "bg-gray-400"
              }`}
            />
            <span className="truncate max-w-[120px]">{getSlotLabel(slot)}</span>
            <span className="font-mono text-xs opacity-70">{formatTimeShort(slot.elapsed)}</span>
          </button>
        ))}

        {/* New Task button */}
        {slots.length < MAX_SLOTS && (
          <button
            onClick={createNewSlot}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-dashed border-gray-300 text-gray-500 hover:border-[#1A3C28] hover:text-[#1A3C28] transition-colors"
          >
            + New Task
          </button>
        )}
      </div>

      {/* Empty state */}
      {slots.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-400 mb-4">No active tasks. Start one to begin tracking time.</p>
          <button
            onClick={createNewSlot}
            className="px-6 py-2.5 bg-[#1A3C28] text-white rounded-lg font-semibold hover:bg-[#122B1C] transition-colors"
          >
            + Start a Task
          </button>
        </div>
      )}

      {/* Active slot content */}
      {activeSlot && (
        <>
          {/* Timer */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Timer</h2>
              {activeSlot.status === "paused" && activeSlot.elapsed > 0 && (
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                  Paused
                </span>
              )}
              {activeSlot.status === "running" && (
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full animate-pulse">
                  Recording
                </span>
              )}
              {activeSlot.status === "stopped" && (
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  Stopped
                </span>
              )}
            </div>
            <div className={`text-6xl font-mono font-bold text-center mb-5 ${timerColor}`}>
              {formatTime(activeSlot.elapsed)}
            </div>
            <div className="flex justify-center gap-3">
              {/* Not started yet */}
              {activeSlot.status === "paused" && activeSlot.elapsed === 0 && !activeSlot.startTime && (
                <button
                  onClick={() => startOrResumeSlot(activeSlot.id)}
                  className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                >
                  ▶ Start
                </button>
              )}
              {/* Running */}
              {activeSlot.status === "running" && (
                <>
                  <button
                    onClick={() => pauseSlot(activeSlot.id)}
                    className="px-6 py-2.5 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors"
                  >
                    ⏸ Pause
                  </button>
                  <button
                    onClick={() => stopSlot(activeSlot.id)}
                    className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                  >
                    ■ Stop
                  </button>
                </>
              )}
              {/* Paused (with time) */}
              {activeSlot.status === "paused" && (activeSlot.elapsed > 0 || activeSlot.startTime) && (
                <>
                  <button
                    onClick={() => startOrResumeSlot(activeSlot.id)}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  >
                    ▶ Resume
                  </button>
                  <button
                    onClick={() => stopSlot(activeSlot.id)}
                    className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                  >
                    ■ Stop
                  </button>
                  <button
                    onClick={() => discardSlot(activeSlot.id)}
                    className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    ✕ Discard
                  </button>
                </>
              )}
              {/* Stopped */}
              {activeSlot.status === "stopped" && (
                <>
                  <button
                    onClick={() => startOrResumeSlot(activeSlot.id)}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  >
                    ▶ Resume
                  </button>
                  <button
                    onClick={() => discardSlot(activeSlot.id)}
                    className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    ✕ Discard
                  </button>
                </>
              )}
            </div>
            {activeSlot.startTime && (
              <p className="text-center text-xs text-gray-400 mt-3">
                Started at {activeSlot.startTime.toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Entry Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Entry Details</h2>

            {taskDataLoading && (
              <p className="text-sm text-gray-400">Loading task options...</p>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PO Number</label>
                <input type="text" value={activeSlot.poNumber}
                  onChange={(e) => updateActiveSlot({ poNumber: e.target.value })}
                  placeholder="e.g. PO-123456"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SO Number</label>
                <input type="text" value={activeSlot.soNumber}
                  onChange={(e) => updateActiveSlot({ soNumber: e.target.value })}
                  placeholder="e.g. SO-789012"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quote #</label>
                <input type="text" value={activeSlot.quoteNumber}
                  onChange={(e) => updateActiveSlot({ quoteNumber: e.target.value })}
                  placeholder="e.g. Q-12345"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department <span className="text-red-500">*</span>
              </label>
              <select value={activeSlot.department} onChange={(e) => handleDepartmentChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]">
                <option value="">Select Department</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <select value={activeSlot.role} onChange={(e) => handleRoleChange(e.target.value)}
                disabled={!activeSlot.department}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28] disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">Select Role</option>
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Category <span className="text-red-500">*</span>
              </label>
              <select value={activeSlot.category}
                onChange={(e) => updateActiveSlot({ category: e.target.value, taskName: "", orderType: "", lineItemCount: "" })}
                disabled={!activeSlot.role}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28] disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">Select Category</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Name <span className="text-red-500">*</span>
              </label>
              <select value={activeSlot.taskName}
                onChange={(e) => handleTaskNameChange(e.target.value)}
                disabled={!activeSlot.category}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28] disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">Select Task</option>
                {tasks.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>

            {/* Dynamic: Order Type — only shown when task has showOrderType flag */}
            {showOrderType && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order Type <span className="text-red-500">*</span>
                </label>
                <select value={activeSlot.orderType}
                  onChange={(e) => updateActiveSlot({ orderType: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]">
                  <option value="">Select Order Type</option>
                  {orderTypes.map((ot) => <option key={ot} value={ot}>{ot}</option>)}
                </select>
              </div>
            )}

            {/* Dynamic: # of Line Items — only shown when task has showLineItems flag */}
            {showLineItems && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  # of Line Items <span className="text-red-500">*</span>
                </label>
                <input type="number" min="1" value={activeSlot.lineItemCount}
                  onChange={(e) => updateActiveSlot({ lineItemCount: e.target.value })}
                  placeholder="e.g. 5"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Owner <span className="text-red-500">*</span>
              </label>
              <input type="text" value={activeSlot.taskOwner}
                onChange={(e) => updateActiveSlot({ taskOwner: e.target.value })}
                placeholder="Your name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28] bg-gray-50" />
              {initialProfile && (
                <p className="text-xs text-green-600 mt-1">✓ Auto-filled from your account</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={activeSlot.notes}
                onChange={(e) => updateActiveSlot({ notes: e.target.value })}
                placeholder="Optional notes about this task..." rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28] resize-none" />
            </div>

            {errorMsg && (
              <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
            )}

            <button type="submit"
              disabled={submitStatus === "loading" || submitStatus === "success"}
              className={`w-full py-3 rounded-lg font-semibold text-white transition-colors ${
                submitStatus === "success" ? "bg-green-600 cursor-default"
                : submitStatus === "loading" ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#1A3C28] hover:bg-[#122B1C]"
              }`}>
              {submitStatus === "loading" ? "Saving..."
                : submitStatus === "success" ? "✓ Entry Saved!"
                : "Submit Entry"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
