"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Department = { id: number; name: string };
type Role = { id: number; name: string; department_id: number };
type EmployeeWithEmail = Profile & { email: string | null };

export default function EmployeesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeWithEmail[]>([]);
  const [loading, setLoading] = useState(false);

  // Dynamic departments/roles from database
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);

  // Create form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [addStatus, setAddStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [addError, setAddError] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editIsManager, setEditIsManager] = useState(false);
  const [editStatus, setEditStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [editError, setEditError] = useState("");

  // Roles filtered by selected department (for create form)
  const filteredRoles = department
    ? allRoles.filter((r) => {
        const dept = departments.find((d) => d.name === department);
        return dept && r.department_id === dept.id;
      })
    : [];

  // Roles filtered by selected department (for edit form)
  const editFilteredRoles = editDepartment
    ? allRoles.filter((r) => {
        const dept = departments.find((d) => d.name === editDepartment);
        return dept && r.department_id === dept.id;
      })
    : [];

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

  // Fetch departments and roles from database
  useEffect(() => {
    const fetchTaskData = async () => {
      try {
        const [deptRes, roleRes] = await Promise.all([
          fetch("/api/task-hierarchy?type=departments"),
          fetch("/api/task-hierarchy?type=roles"),
        ]);
        if (deptRes.ok) setDepartments(await deptRes.json());
        if (roleRes.ok) setAllRoles(await roleRes.json());
      } catch {
        // Silently fail
      }
    };
    fetchTaskData();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/employees");
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && profile?.is_admin) fetchEmployees();
  }, [authLoading, profile]);

  // --- Create employee ---
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password || !role || !department) {
      setAddError("All fields are required.");
      return;
    }
    setAddStatus("loading");
    setAddError("");
    try {
      const res = await fetch("/api/employees/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim(),
          role,
          department,
          is_admin: isAdmin,
          is_manager: isManager,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create account");
      setAddStatus("success");
      setName(""); setEmail(""); setPassword(""); setRole(""); setDepartment(""); setIsAdmin(false); setIsManager(false);
      fetchEmployees();
      setTimeout(() => setAddStatus("idle"), 2500);
    } catch (err: unknown) {
      setAddStatus("error");
      setAddError(err instanceof Error ? err.message : "Failed to create account.");
    }
  };

  // --- Toggle active ---
  const toggleActive = async (emp: Profile) => {
    try {
      const res = await fetch(`/api/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !emp.active }),
      });
      if (res.ok) {
        setEmployees((prev) =>
          prev.map((e) => (e.id === emp.id ? { ...e, active: !e.active } : e))
        );
      }
    } catch {
      // silently fail
    }
  };

  // --- Start editing ---
  const startEdit = (emp: Profile) => {
    setEditingId(emp.id);
    setEditName(emp.name);
    setEditEmail((emp as EmployeeWithEmail).email || ""); // Pre-fill from auth.users
    setEditPassword("");
    setEditRole(emp.role);
    setEditDepartment(emp.department);
    setEditIsAdmin(emp.is_admin);
    setEditIsManager(emp.is_manager ?? false);
    setEditStatus("idle");
    setEditError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError("");
    setEditStatus("idle");
  };

  // --- Save edit ---
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editName.trim() || !editRole || !editDepartment) {
      setEditError("Name, department, and role are required.");
      return;
    }
    setEditStatus("loading");
    setEditError("");

    const body: Record<string, unknown> = {
      name: editName.trim(),
      role: editRole,
      department: editDepartment,
      is_admin: editIsAdmin,
      is_manager: editIsManager,
    };
    if (editEmail.trim()) body.email = editEmail.trim();
    if (editPassword) body.password = editPassword;

    try {
      const res = await fetch(`/api/employees/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");

      setEditStatus("success");
      fetchEmployees();
      setTimeout(() => {
        setEditingId(null);
        setEditStatus("idle");
      }, 1500);
    } catch (err: unknown) {
      setEditStatus("error");
      setEditError(err instanceof Error ? err.message : "Failed to update.");
    }
  };

  // --- Delete employee ---
  const handleDelete = async (emp: Profile) => {
    if (!confirm(`Delete "${emp.name}"? This will permanently remove their account and cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/employees/${emp.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete");
        return;
      }
      fetchEmployees();
    } catch {
      alert("Failed to delete employee.");
    }
  };

  if (authLoading) return <div className="text-center py-16 text-gray-400">Loading...</div>;
  if (!profile?.is_admin) {
    return (
      <div className="max-w-sm mx-auto mt-20 text-center">
        <p className="text-gray-500 text-lg">Access Denied</p>
        <p className="text-gray-400 text-sm mt-2">You need admin access to manage employees.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[#1A3C28] mb-6">Employee Roster</h1>

      {/* Create Employee Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Create Employee Account
        </h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Full Name"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Temporary password"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]" />
            <select value={department} onChange={(e) => { setDepartment(e.target.value); setRole(""); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]">
              <option value="">Select Department</option>
              {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
            <select value={role} onChange={(e) => setRole(e.target.value)} disabled={!department}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28] disabled:bg-gray-100 disabled:text-gray-400">
              <option value="">Select Role</option>
              {filteredRoles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
            <div className="flex flex-col gap-2 self-center">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="rounded" />
                Admin access
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={isManager} onChange={(e) => setIsManager(e.target.checked)} className="rounded" />
                Manager
              </label>
            </div>
          </div>
          {addError && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{addError}</p>}
          <button type="submit" disabled={addStatus === "loading" || addStatus === "success"}
            className={`px-6 py-2.5 rounded-lg font-semibold text-white text-sm transition-colors ${
              addStatus === "success" ? "bg-green-600 cursor-default"
              : addStatus === "loading" ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#1A3C28] hover:bg-[#122B1C]"
            }`}>
            {addStatus === "loading" ? "Creating..." : addStatus === "success" ? "✓ Account Created" : "Create Account"}
          </button>
        </form>
      </div>

      {/* Employee Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No employees yet.</div>
      ) : (
        <div className="space-y-0 rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Access</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((emp) => (
                <>
                  <tr key={emp.id} className={`hover:bg-gray-50 ${editingId === emp.id ? "bg-green-50" : ""}`}>
                    <td className="px-4 py-3 font-medium">{emp.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{emp.email || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{emp.department}</td>
                    <td className="px-4 py-3 text-gray-600">{emp.role}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {emp.is_admin ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Admin</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">Standard</span>
                        )}
                        {emp.is_manager && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">Manager</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(emp)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                          emp.active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}>
                        {emp.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(emp.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        {editingId === emp.id ? (
                          <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 text-xs font-semibold">
                            Cancel
                          </button>
                        ) : (
                          <>
                            <button onClick={() => startEdit(emp)} className="text-[#1A3C28] hover:text-[#122B1C] text-xs font-semibold">
                              Edit
                            </button>
                            <button onClick={() => handleDelete(emp)} className="text-red-500 hover:text-red-700 text-xs font-semibold">
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline Edit Row */}
                  {editingId === emp.id && (
                    <tr key={`${emp.id}-edit`} className="bg-green-50 border-t border-green-100">
                      <td colSpan={8} className="px-4 py-4">
                        <form onSubmit={handleSaveEdit} className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Email (leave blank to keep current)</label>
                              <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                                placeholder="New email address"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Password (leave blank to keep current)</label>
                              <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)}
                                placeholder="New password"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
                              <select value={editDepartment} onChange={(e) => { setEditDepartment(e.target.value); setEditRole(""); }}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28]">
                                <option value="">Select Department</option>
                                {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                              <select value={editRole} onChange={(e) => setEditRole(e.target.value)} disabled={!editDepartment}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C28] disabled:bg-gray-100 disabled:text-gray-400">
                                <option value="">Select Role</option>
                                {editFilteredRoles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                              </select>
                            </div>
                            <div className="flex items-end">
                              <div className="flex flex-col gap-2 pb-2">
                                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                  <input type="checkbox" checked={editIsAdmin} onChange={(e) => setEditIsAdmin(e.target.checked)} className="rounded" />
                                  Admin access
                                </label>
                                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                  <input type="checkbox" checked={editIsManager} onChange={(e) => setEditIsManager(e.target.checked)} className="rounded" />
                                  Manager
                                </label>
                              </div>
                            </div>
                          </div>

                          {editError && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{editError}</p>}

                          <div className="flex gap-3">
                            <button type="submit" disabled={editStatus === "loading" || editStatus === "success"}
                              className={`px-5 py-2 rounded-lg font-semibold text-white text-sm transition-colors ${
                                editStatus === "success" ? "bg-green-600 cursor-default"
                                : editStatus === "loading" ? "bg-gray-400 cursor-not-allowed"
                                : "bg-[#1A3C28] hover:bg-[#122B1C]"
                              }`}>
                              {editStatus === "loading" ? "Saving..." : editStatus === "success" ? "✓ Saved" : "Save Changes"}
                            </button>
                            <button type="button" onClick={cancelEdit}
                              className="px-5 py-2 rounded-lg font-semibold text-gray-600 text-sm bg-gray-200 hover:bg-gray-300 transition-colors">
                              Cancel
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
