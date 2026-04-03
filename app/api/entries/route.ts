import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const department = searchParams.get("department");
  const role = searchParams.get("role");
  const task_owner = searchParams.get("task_owner");
  const date = searchParams.get("date");

  const supabase = getServiceClient();

  // Fetch all entries using pagination to bypass the 1000-row PostgREST limit
  const PAGE_SIZE = 1000;
  let allData: Record<string, unknown>[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from("time_entries")
      .select("*")
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (department) query = query.eq("department", department);
    if (role) query = query.eq("role", role);
    if (task_owner) query = query.eq("task_owner", task_owner);
    if (date) query = query.gte("created_at", `${date}T00:00:00`).lte("created_at", `${date}T23:59:59`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (data && data.length > 0) {
      allData = allData.concat(data);
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
    page++;
  }

  return NextResponse.json(allData);
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const body = await req.json();

  const {
    po_number,
    so_number,
    quote_number,
    department,
    role,
    task_category,
    task_name,
    task_owner,
    notes,
    order_type,
    line_item_count,
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
      quote_number,
      department,
      role,
      task_category,
      task_name,
      task_owner,
      notes,
      order_type,
      line_item_count,
      start_time,
      end_time,
      duration_seconds,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
