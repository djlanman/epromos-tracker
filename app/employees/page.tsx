"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Department = { id: number; name: string };
type Role = { id: number; name: string; department_id: number };

export default function EmployeesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  // Dynamic departments/roles from database
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);

  // Add form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [addStatus, setAddStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [addError, setAddError] = useState("");

  // Roles filtered by selected department
  const filteredRoles = department
    ? allRoles.filter((r) => {
        const dept = departments.find((d) => d.name === department);
        return dept && r.department_id === dept.id;
      })
    : [];

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
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
        // Silently fail — dropdowns may be empty
      }
    };
    fetchTaskData();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("name");
      if (data) setEmployees(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && profile?.is_admin) fetchEmployees();
  }, [authLoading, profile]);

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
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create account");

      setAddStatus("success");
      setName(""); setEmail(""); setPassword(""); setRole(""); setDepartment(""); setIsAdmin(false);
      fetchEmployees();
      setTimeout(() => setAddStatus("idle"), 2500);
    } catch (err: unknown) {
      setAddStatus("error");
      setAddError(err instanceof Error ? err.message : "Failed to create account.");
    }
  };

  const toggleActive = async (emp: Profile) => {
    const supabase = createClient();
    await supabase.from("profiles").update({ active: !emp.active }).eq("id", emp.id);
    setEmployees((prev) =>
      prev.map((e) => (e.id === emp.id ? { ...e, active: !e.active } : e))
    );
  };

  if (authLoading) {
    return <div className="text-center py-16 text-gray-400">Loading...</div>;
  }

  if (!profile?.is_admin) {
    return (
      <div className="max-w-sm mx-auto mt-20 text-center">
        <p className="text-gray-500 text-lg">Access Denied</p>
        <p className="text-gray-400 text-sm mt-2">
          You need admin access to manage employees.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[#003087] mb-6">Employee Roster</h1>

      {/* Create Employee Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Create Employee Account
        </h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Name"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Temporary password"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
            />
            <select
              value={department}
              onChange={(e) => { setDepartment(e.target.value); setRole(""); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
            >
              <option value="">Select Department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={!department}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">Select Role</option>
              {filteredRoles.map((r) => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer self-center">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="rounded"
              />
              Admin access (Entry Log & Employees)
            </label>
          </div>

          {addError && (
            <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
              {addError}
            </p>
          )}

          <button
            type="submit"
            disabled={addStatus === "loading" || addStatus === "success"}
            className={`px-6 py-2.5 rounded-lg font-semibold text-white text-sm transition-colors ${
              addStatus === "success"
                ? "bg-green-600 cursor-default"
                : addStatus === "loading"
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#003087] hover:bg-[#002060]"
            }`}
          >
            {addStatus === "loading"
              ? "Creating..."
              : addStatus === "success"
              ? "✓ Account Created"
              : "Create Account"}
          </button>
        </form>
      </div>

      {/* Employee Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
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
                <th className="px-4 py-3">Access</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{emp.name}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.department}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.role}</td>
                  <td className="px-4 py-3">
                    {emp.is_admin ? (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                        Admin
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">
                        Standard
                      </span>
                    )}
                  </td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
