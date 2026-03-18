"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Department = { id: number; name: string; sort_order: number; active: boolean };
type Role = { id: number; name: string; department_id: number; sort_order: number; active: boolean; departments?: { name: string } };
type Category = { id: number; name: string; role_id: number; sort_order: number; active: boolean; roles?: { name: string; departments?: { name: string } } };

type Tab = "departments" | "roles" | "categories";

export default function ManageTasksPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("departments");

  // Data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterDeptId, setFilterDeptId] = useState<number | "">("");
  const [filterRoleId, setFilterRoleId] = useState<number | "">("");

  // Add form
  const [newName, setNewName] = useState("");
  const [addDeptId, setAddDeptId] = useState<number | "">("");
  const [addRoleId, setAddRoleId] = useState<number | "">("");
  const [addStatus, setAddStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [addError, setAddError] = useState("");

  // Inline edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  // Auth check
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

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, roleRes, catRes] = await Promise.all([
        fetch("/api/task-hierarchy?type=departments"),
        fetch("/api/task-hierarchy?type=roles"),
        fetch("/api/task-hierarchy?type=categories"),
      ]);
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (roleRes.ok) setRoles(await roleRes.json());
      if (catRes.ok) setCategories(await catRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && profile?.is_admin) fetchData();
  }, [authLoading, profile, fetchData]);

  // Filtered data
  const filteredRoles = filterDeptId
    ? roles.filter((r) => r.department_id === filterDeptId)
    : roles;

  const filteredCategories = filterRoleId
    ? categories.filter((c) => c.role_id === filterRoleId)
    : filterDeptId
    ? categories.filter((c) => {
        const role = roles.find((r) => r.id === c.role_id);
        return role && role.department_id === filterDeptId;
      })
    : categories;

  // Roles available for the category add form (filtered by department if set)
  const rolesForAddForm = addDeptId
    ? roles.filter((r) => r.department_id === addDeptId)
    : roles;

  // Add item
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) { setAddError("Name is required."); return; }

    setAddStatus("loading");
    setAddError("");

    const body: Record<string, unknown> = { name: newName.trim() };
    if (activeTab === "departments") {
      body.type = "department";
    } else if (activeTab === "roles") {
      if (!addDeptId) { setAddError("Select a department."); setAddStatus("idle"); return; }
      body.type = "role";
      body.department_id = addDeptId;
    } else {
      if (!addRoleId) { setAddError("Select a role."); setAddStatus("idle"); return; }
      body.type = "category";
      body.role_id = addRoleId;
    }

    try {
      const res = await fetch("/api/task-hierarchy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");

      setAddStatus("success");
      setNewName("");
      fetchData();
      setTimeout(() => setAddStatus("idle"), 2000);
    } catch (err: unknown) {
      setAddStatus("error");
      setAddError(err instanceof Error ? err.message : "Failed to create.");
    }
  };

  // Rename item
  const handleRename = async (type: string, id: number) => {
    if (!editName.trim()) return;
    try {
      await fetch("/api/task-hierarchy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, name: editName.trim() }),
      });
      setEditingId(null);
      setEditName("");
      fetchData();
    } catch {
      // silently fail
    }
  };

  // Toggle active
  const handleToggleActive = async (type: string, id: number, currentActive: boolean) => {
    try {
      await fetch("/api/task-hierarchy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, active: !currentActive }),
      });
      fetchData();
    } catch {
      // silently fail
    }
  };

  // Delete item
  const handleDelete = async (type: string, id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This will also delete all child items.`)) return;
    try {
      await fetch(`/api/task-hierarchy?type=${type}&id=${id}`, { method: "DELETE" });
      fetchData();
    } catch {
      // silently fail
    }
  };

  if (authLoading) return <div className="text-center py-16 text-gray-400">Loading...</div>;
  if (!profile?.is_admin) {
    return (
      <div className="max-w-sm mx-auto mt-20 text-center">
        <p className="text-gray-500 text-lg">Access Denied</p>
        <p className="text-gray-400 text-sm mt-2">You need admin access to manage tasks.</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "departments", label: "Departments", count: departments.length },
    { key: "roles", label: "Roles", count: filteredRoles.length },
    { key: "categories", label: "Task Categories", count: filteredCategories.length },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[#003087] mb-6">Manage Tasks</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setEditingId(null); setNewName(""); setAddError(""); setAddStatus("idle"); }}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-[#003087] shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-gray-400">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Filters (for roles and categories tabs) */}
      {(activeTab === "roles" || activeTab === "categories") && (
        <div className="flex gap-3 mb-4">
          <select
            value={filterDeptId}
            onChange={(e) => { setFilterDeptId(e.target.value ? parseInt(e.target.value) : ""); setFilterRoleId(""); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
          >
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {activeTab === "categories" && (
            <select
              value={filterRoleId}
              onChange={(e) => setFilterRoleId(e.target.value ? parseInt(e.target.value) : "")}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
            >
              <option value="">All Roles</option>
              {(filterDeptId ? roles.filter((r) => r.department_id === filterDeptId) : roles).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Add Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Add {activeTab === "departments" ? "Department" : activeTab === "roles" ? "Role" : "Task Category"}
        </h2>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
          {activeTab === "roles" && (
            <select
              value={addDeptId}
              onChange={(e) => setAddDeptId(e.target.value ? parseInt(e.target.value) : "")}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
            >
              <option value="">Select Department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          {activeTab === "categories" && (
            <>
              <select
                value={addDeptId}
                onChange={(e) => { setAddDeptId(e.target.value ? parseInt(e.target.value) : ""); setAddRoleId(""); }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
              >
                <option value="">Select Department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select
                value={addRoleId}
                onChange={(e) => setAddRoleId(e.target.value ? parseInt(e.target.value) : "")}
                disabled={!addDeptId}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">Select Role</option>
                {rolesForAddForm.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </>
          )}
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`New ${activeTab === "departments" ? "department" : activeTab === "roles" ? "role" : "category"} name`}
            className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
          />
          <button
            type="submit"
            disabled={addStatus === "loading" || addStatus === "success"}
            className={`px-5 py-2 rounded-lg font-semibold text-white text-sm transition-colors ${
              addStatus === "success" ? "bg-green-600" : addStatus === "loading" ? "bg-gray-400" : "bg-[#003087] hover:bg-[#002060]"
            }`}
          >
            {addStatus === "loading" ? "Adding..." : addStatus === "success" ? "✓ Added" : "Add"}
          </button>
        </form>
        {addError && <p className="text-red-600 text-sm mt-2">{addError}</p>}
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Name</th>
                {activeTab !== "departments" && <th className="px-4 py-3">Department</th>}
                {activeTab === "categories" && <th className="px-4 py-3">Role</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Departments tab */}
              {activeTab === "departments" && departments.map((dept) => (
                <tr key={dept.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {editingId === dept.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleRename("department", dept.id); if (e.key === "Escape") setEditingId(null); }}
                          className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
                          autoFocus
                        />
                        <button onClick={() => handleRename("department", dept.id)} className="text-green-600 text-xs font-semibold">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-gray-400 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <span className={`font-medium ${!dept.active ? "text-gray-400 line-through" : ""}`}>{dept.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive("department", dept.id, dept.active)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                        dept.active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {dept.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditingId(dept.id); setEditName(dept.name); }} className="text-[#003087] hover:text-[#002060] text-xs font-semibold">Rename</button>
                      <button onClick={() => handleDelete("department", dept.id, dept.name)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Roles tab */}
              {activeTab === "roles" && filteredRoles.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {editingId === role.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleRename("role", role.id); if (e.key === "Escape") setEditingId(null); }}
                          className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
                          autoFocus
                        />
                        <button onClick={() => handleRename("role", role.id)} className="text-green-600 text-xs font-semibold">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-gray-400 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <span className={`font-medium ${!role.active ? "text-gray-400 line-through" : ""}`}>{role.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {role.departments?.name || departments.find((d) => d.id === role.department_id)?.name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive("role", role.id, role.active)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                        role.active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {role.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditingId(role.id); setEditName(role.name); }} className="text-[#003087] hover:text-[#002060] text-xs font-semibold">Rename</button>
                      <button onClick={() => handleDelete("role", role.id, role.name)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Categories tab */}
              {activeTab === "categories" && filteredCategories.map((cat) => {
                const parentRole = roles.find((r) => r.id === cat.role_id);
                const parentDept = parentRole ? departments.find((d) => d.id === parentRole.department_id) : null;
                return (
                  <tr key={cat.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {editingId === cat.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleRename("category", cat.id); if (e.key === "Escape") setEditingId(null); }}
                            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
                            autoFocus
                          />
                          <button onClick={() => handleRename("category", cat.id)} className="text-green-600 text-xs font-semibold">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-gray-400 text-xs">Cancel</button>
                        </div>
                      ) : (
                        <span className={`font-medium ${!cat.active ? "text-gray-400 line-through" : ""}`}>{cat.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{parentDept?.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{parentRole?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive("category", cat.id, cat.active)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                          cat.active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {cat.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setEditingId(cat.id); setEditName(cat.name); }} className="text-[#003087] hover:text-[#002060] text-xs font-semibold">Rename</button>
                        <button onClick={() => handleDelete("category", cat.id, cat.name)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Empty state */}
              {((activeTab === "departments" && departments.length === 0) ||
                (activeTab === "roles" && filteredRoles.length === 0) ||
                (activeTab === "categories" && filteredCategories.length === 0)) && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    No {activeTab} found. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
