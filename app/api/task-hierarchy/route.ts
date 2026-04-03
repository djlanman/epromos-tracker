import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/task-hierarchy
// Returns the full task hierarchy as a nested object matching the old TaskData shape
// Optional query params: department_id, role_id (for filtered fetches)
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  // If requesting flat lists for admin management
  const type = searchParams.get("type");

  if (type === "departments") {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (type === "roles") {
    const deptId = searchParams.get("department_id");
    let query = supabase
      .from("roles")
      .select("*, departments(name)")
      .order("name");
    if (deptId) query = query.eq("department_id", parseInt(deptId));
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (type === "categories") {
    const roleId = searchParams.get("role_id");
    let query = supabase
      .from("task_categories")
      .select("*, roles(name, departments(name))")
      .order("name");
    if (roleId) query = query.eq("role_id", parseInt(roleId));
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (type === "task_names") {
    const catId = searchParams.get("category_id");
    let query = supabase
      .from("task_names")
      .select("*, task_categories(name, role_id, roles(name, department_id, departments(name)))")
      .order("name");
    if (catId) query = query.eq("category_id", parseInt(catId));
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (type === "order_types") {
    const { data, error } = await supabase
      .from("order_types")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (type === "order_types_all") {
    const { data, error } = await supabase
      .from("order_types")
      .select("*")
      .order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Default: return full nested hierarchy for the process tracker dropdowns
  // All sorted alphabetically by name for consistent dropdown ordering
  const { data: departments, error: dErr } = await supabase
    .from("departments")
    .select("id, name")
    .eq("active", true)
    .order("name");
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

  const { data: roles, error: rErr } = await supabase
    .from("roles")
    .select("id, name, department_id")
    .eq("active", true)
    .order("name");
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  const { data: categories, error: cErr } = await supabase
    .from("task_categories")
    .select("id, name, role_id")
    .eq("active", true)
    .order("name");
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const { data: tasks, error: tErr } = await supabase
    .from("task_names")
    .select("id, name, category_id, show_order_type, show_line_items")
    .eq("active", true)
    .order("name");
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  type DeptRow = { id: number; name: string };
  type RoleRow = { id: number; name: string; department_id: number };
  type CatRow = { id: number; name: string; role_id: number };
  type TaskRow = { id: number; name: string; category_id: number; show_order_type: boolean; show_line_items: boolean };

  type TaskInfoOut = { name: string; showOrderType: boolean; showLineItems: boolean };

  // Build the nested structure: { [dept]: { [role]: { [category]: TaskInfo[] } } }
  const hierarchy: Record<string, Record<string, Record<string, TaskInfoOut[]>>> = {};

  for (const dept of (departments || []) as DeptRow[]) {
    hierarchy[dept.name] = {};
    const deptRoles = ((roles || []) as RoleRow[]).filter((r) => r.department_id === dept.id);
    for (const role of deptRoles) {
      hierarchy[dept.name][role.name] = {};
      const roleCats = ((categories || []) as CatRow[]).filter((c) => c.role_id === role.id);
      for (const cat of roleCats) {
        const catTasks = ((tasks || []) as TaskRow[]).filter((t) => t.category_id === cat.id);
        hierarchy[dept.name][role.name][cat.name] = catTasks.map((t) => ({
          name: t.name,
          showOrderType: t.show_order_type,
          showLineItems: t.show_line_items,
        }));
      }
    }
  }

  return NextResponse.json(hierarchy);
}

// POST /api/task-hierarchy
// Create a new department, role, or category
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json();
  const { type, name, department_id, role_id, category_id, show_order_type, show_line_items } = body;

  // Use service role for insert (RLS only allows service_role to write)
  const { createClient: createServiceClient } = await import("@supabase/supabase-js");
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (type === "department") {
    const { data: maxOrder } = await serviceClient
      .from("departments")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();
    const { data, error } = await serviceClient
      .from("departments")
      .insert({ name, sort_order: (maxOrder?.sort_order || 0) + 1 })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  }

  if (type === "role") {
    if (!department_id) return NextResponse.json({ error: "department_id required" }, { status: 400 });
    const { data: maxOrder } = await serviceClient
      .from("roles")
      .select("sort_order")
      .eq("department_id", department_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();
    const { data, error } = await serviceClient
      .from("roles")
      .insert({ name, department_id, sort_order: (maxOrder?.sort_order || 0) + 1 })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  }

  if (type === "category") {
    if (!role_id) return NextResponse.json({ error: "role_id required" }, { status: 400 });
    const { data: maxOrder } = await serviceClient
      .from("task_categories")
      .select("sort_order")
      .eq("role_id", role_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();
    const { data, error } = await serviceClient
      .from("task_categories")
      .insert({ name, role_id, sort_order: (maxOrder?.sort_order || 0) + 1 })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  }

  if (type === "task_name") {
    if (!category_id) return NextResponse.json({ error: "category_id required" }, { status: 400 });
    const { data: maxOrder } = await serviceClient
      .from("task_names")
      .select("sort_order")
      .eq("category_id", category_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();
    const { data, error } = await serviceClient
      .from("task_names")
      .insert({
        name,
        category_id,
        sort_order: (maxOrder?.sort_order || 0) + 1,
        show_order_type: show_order_type || false,
        show_line_items: show_line_items || false,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  }

  if (type === "order_type") {
    const { data: maxOrder } = await serviceClient
      .from("order_types")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();
    const { data, error } = await serviceClient
      .from("order_types")
      .insert({ name, sort_order: (maxOrder?.sort_order || 0) + 1 })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

// PATCH /api/task-hierarchy
// Update a department, role, or category (rename or toggle active)
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json();
  const { type, id, ...updates } = body;

  const { createClient: createServiceClient } = await import("@supabase/supabase-js");
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const table = type === "department" ? "departments"
    : type === "role" ? "roles"
    : type === "category" ? "task_categories"
    : type === "task_name" ? "task_names"
    : type === "order_type" ? "order_types"
    : null;

  if (!table || !id) return NextResponse.json({ error: "Invalid type or missing id" }, { status: 400 });

  const { data, error } = await serviceClient
    .from(table)
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

// DELETE /api/task-hierarchy
// Delete a department, role, category, task name, or order type (cascading)
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  const { createClient: createServiceClient } = await import("@supabase/supabase-js");
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const table = type === "department" ? "departments"
    : type === "role" ? "roles"
    : type === "category" ? "task_categories"
    : type === "task_name" ? "task_names"
    : type === "order_type" ? "order_types"
    : null;

  if (!table || !id) return NextResponse.json({ error: "Invalid type or missing id" }, { status: 400 });

  const { error } = await serviceClient
    .from(table)
    .delete()
    .eq("id", parseInt(id));

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
