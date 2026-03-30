import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const EXCLUDED_EMAILS = [
  "david.jackson@epromos.com",
  "tej.matharoo@epromos.com",
  "tejsingh@aol.in",
];

// Allow both GET and POST so you can just visit the URL in your browser
export async function GET() {
  return resetAllPasswords();
}

export async function POST() {
  return resetAllPasswords();
}

async function resetAllPasswords() {
  // Verify caller is admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Use SQL query via RPC instead of listUsers (which fails for SQL-imported users)
  const { data: users, error: queryError } = await adminClient.rpc("get_user_emails");

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  const results: { email: string; status: string }[] = [];

  for (const u of users || []) {
    if (!u.email || EXCLUDED_EMAILS.includes(u.email)) {
      results.push({ email: u.email || "unknown", status: "skipped" });
      continue;
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      u.id,
      { password: "tracker26!" }
    );

    results.push({
      email: u.email,
      status: updateError ? `error: ${updateError.message}` : "reset",
    });
  }

  const resetCount = results.filter((r) => r.status === "reset").length;
  const errorCount = results.filter((r) => r.status.startsWith("error")).length;

  return NextResponse.json({
    message: `Reset ${resetCount} passwords. ${errorCount} errors.`,
    results,
  });
}
