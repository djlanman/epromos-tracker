import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const department = searchParams.get("department");
  const role = searchParams.get("role");
  const task_owner = searchParams.get("task_owner");
  const date = searchParams.get("date");

  let query = supabase
    .from("time_entries")
    .select("*")
    .order("created_at", { ascending: false });

  if (department) query = query.eq("department", department);
  if (role) query = query.eq("role", role);
  if (task_owner) query = query.eq("task_owner", task_owner);
  if (date) query = query.gte("created_at", `${date}T00:00:00`).lte("created_at", `${date}T23:59:59`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const {
    po_number,
    so_number,
    department,
    role,
    task_category,
    task_name,
    task_owner,
    notes,
    start_time,
    end_time,
    duration_seconds,
  } = body;

  if (!department || !role || !task_category || !task_name || !task_owner) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      po_number,
      so_number,
      department,
      role,
      task_category,
      task_name,
      task_owner,
      notes,
      start_time,
      end_time,
      duration_seconds,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
