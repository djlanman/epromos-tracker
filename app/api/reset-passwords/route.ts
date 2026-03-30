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

  // Use service role to list all users and reset passwords
  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get all users (paginate through)
  const results: { email: string; status: string }[] = [];
  let page = 1;
  const perPage = 50;

  while (true) {
    const { data: { users }, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      return NextResponse.json({ error: error.message, results }, { status: 500 });
    }

    if (!users || users.length === 0) break;

    for (const u of users) {
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

    if (users.length < perPage) break;
    page++;
  }

  const resetCount = results.filter((r) => r.status === "reset").length;
  const errorCount = results.filter((r) => r.status.startsWith("error")).length;

  return NextResponse.json({
    message: `Reset ${resetCount} passwords. ${errorCount} errors.`,
    results,
  });
}
