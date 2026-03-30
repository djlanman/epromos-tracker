import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const EXCLUDED_EMAILS = [
  "david.jackson@epromos.com",
  "tej.matharoo@epromos.com",
  "tejsingh@aol.in",
];

export async function GET() {
  return fixUsers();
}

async function fixUsers() {
  // Verify caller is admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin)
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );

  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Step 1: Get all users and their profile data via SQL
  const { data: allUsers, error: queryError } = await adminClient.rpc(
    "get_users_for_migration"
  );

  if (queryError) {
    return NextResponse.json(
      {
        error: queryError.message,
        hint: "You need to create the get_users_for_migration() function first. See instructions.",
      },
      { status: 500 }
    );
  }

  const results: { email: string; status: string }[] = [];

  for (const u of allUsers || []) {
    if (!u.email || EXCLUDED_EMAILS.includes(u.email)) {
      results.push({ email: u.email || "unknown", status: "skipped" });
      continue;
    }

    // First try updateUserById — if it works, user is fine
    const { error: updateError } =
      await adminClient.auth.admin.updateUserById(u.id, {
        password: "tracker26!",
      });

    if (!updateError) {
      results.push({ email: u.email, status: "already_ok" });
      continue;
    }

    // User is broken — delete via SQL and recreate via Auth API
    try {
      // Delete the broken auth record (profile cascade will handle the rest)
      const { error: deleteError } = await adminClient.rpc(
        "delete_auth_user",
        { user_id: u.id }
      );

      if (deleteError) {
        results.push({
          email: u.email,
          status: `delete_error: ${deleteError.message}`,
        });
        continue;
      }

      // Recreate via Auth API with proper password
      const { data: newUser, error: createError } =
        await adminClient.auth.admin.createUser({
          email: u.email,
          password: "tracker26!",
          email_confirm: true,
          user_metadata: {
            name: u.name || u.email.split("@")[0],
            role: u.role || "",
            department: u.department || "",
            is_admin: u.is_admin || false,
            is_manager: u.is_manager || false,
          },
        });

      if (createError) {
        results.push({
          email: u.email,
          status: `create_error: ${createError.message}`,
        });
        continue;
      }

      results.push({ email: u.email, status: "fixed" });
    } catch (err) {
      results.push({
        email: u.email,
        status: `exception: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  }

  const fixedCount = results.filter((r) => r.status === "fixed").length;
  const okCount = results.filter((r) => r.status === "already_ok").length;
  const errorCount = results.filter(
    (r) =>
      r.status.startsWith("delete_error") ||
      r.status.startsWith("create_error") ||
      r.status.startsWith("exception")
  ).length;

  return NextResponse.json({
    message: `Fixed: ${fixedCount}, Already OK: ${okCount}, Errors: ${errorCount}, Skipped: ${results.filter((r) => r.status === "skipped").length}`,
    results,
  });
}
