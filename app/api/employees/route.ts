import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  // Verify caller is authenticated admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!callerProfile?.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active") === "true";

  let query = supabase
    .from("profiles")
    .select("*")
    .order("name", { ascending: true });

  if (activeOnly) query = query.eq("active", true);

  const { data: profiles, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch emails from auth.users using service role with pagination
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const emailMap = new Map<string, string>();
  let page = 1;
  const perPage = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: authUsersResponse, error: authError } =
      await serviceClient.auth.admin.listUsers({ page, perPage });

    if (authError || !authUsersResponse?.users?.length) {
      hasMore = false;
    } else {
      for (const u of authUsersResponse.users) {
        if (u.email) emailMap.set(u.id, u.email);
      }
      hasMore = authUsersResponse.users.length === perPage;
      page++;
    }
  }

  // Merge email into profile data
  const enriched = (profiles || []).map((p) => ({
    ...p,
    email: emailMap.get(p.id) || null,
  }));

  return NextResponse.json(enriched);
}
