"use client";

import { useState, useEffect } from "react";
import type { Employee } from "@/lib/supabase";
import { getDepartments, getRolesForDepartment } from "@/lib/taskData";

const ROLES_LIST = [
  "Enterprise Business Manager",
  "Account Manager",
  "Brand Account Manager",
  "Brand Consultant",
  "Program Account Manager",
  "Program Specialist",
  "Account Coordinator",
  "Graphic Artist",
  "Order Processing Executive",
  "QA - Account Coordinator",
];

export default function EmployeesPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  // Add form
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [addStatus, setAddStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [addError, setAddError] = useState("");

  const departments = getDepartments();

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === (process.env.NEXT_PUBLIC_EMPLOYEES_PASSWORD || "epromos_admin")) {
      setAuthed(true);
    } else {
      setAuthError("Incorrect password.");
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (Array.isArray(data)) setEmployees(data);
    } catch {
      console.error("Failed to fetch employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authed) fetchEmployees();
  }, [authed]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role || !department) {
      setAddError("Name, role, and department are required.");
      return;
    }
    setAddStatus("loading");
    setAddError("");
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role, department, active: true }),
      });
      if (!res.ok) throw new Error("Failed");
      setAddStatus("success");
      setName("");
      setRole("");
      setDepartment("");
      fetchEmployees();
      setTimeout(() => setAddStatus("idle"), 2000);
    } catch {
      setAddStatus("error");
      setAddError("Failed to add employee.");
    }
  };

  const toggleActive = async (emp: Employee) => {
    try {
      await fetch(`/api/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !emp.active }),
      });
      setEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, active: !e.active } : e))
      );
    } catch {
      alert("Failed to update employee.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this employee?")) return;
    try {
      await fetch(`/api/employees/${id}`, { method: "DELETE" });
      setEmployees((prev) => prev.filter((e) => e.id !== id));
    } catch {
      alert("Failed to delete employee.");
    }
  };

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-20">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-xl font-bold text-[#003087] mb-6 text-center">
            Employees — Admin Access
          </h1>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
                autoFocus
              />
            </div>
            {authError && <p className="text-red-600 text-sm">{authError}</p>}
            <button
              type="submit"
              className="w-full py-2.5 bg-[#003087] text-white rounded-lg font-semibold hover:bg-[#002060] transition-colors"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[#003087] mb-6">
        Employee Roster
      </h1>

      {/* Add Employee Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Add Employee
        </h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full Name"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
          />
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
          >
            <option value="">Department</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
          >
            <option value="">Role</option>
            {ROLES_LIST.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={addStatus === "loading" || addStatus === "success"}
            className={`py-2.5 rounded-lg font-semibold text-white text-sm transition-colors ${
              addStatus === "success"
                ? "bg-green-600 cursor-default"
                : addStatus === "loading"
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#003087] hover:bg-[#002060]"
            }`}
          >
            {addStatus === "loading" ? "Adding…" : addStatus === "success" ? "✓ Added" : "Add Employee"}
          </button>
        </form>
        {addError && <p className="text-red-600 text-sm mt-2">{addError}</p>}
      </div>

      {/* Employee Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No employees yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{emp.name}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.department}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.role}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(emp)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                        emp.active
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {emp.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(emp.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(emp.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      Remove
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
