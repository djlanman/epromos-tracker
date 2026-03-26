import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Helper: verify caller is admin
async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  return profile?.is_admin ? user : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json();
  const { email, password, ...profileFields } = body;

  // If email or password is being changed, use the Supabase Admin API
  if (email || password) {
    const adminClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const authUpdate: Record<string, string> = {};
    if (email) authUpdate.email = email;
    if (password) authUpdate.password = password;

    const { error: authError } = await adminClient.auth.admin.updateUserById(
      params.id,
      authUpdate
    );

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }
  }

  // Update profile fields if any were provided
  const allowedProfileFields = ["name", "role", "department", "is_admin", "is_manager", "active"];
  const filteredProfile: Record<string, unknown> = {};
  for (const key of allowedProfileFields) {
    if (key in profileFields) {
      filteredProfile[key] = profileFields[key];
    }
  }

  if (Object.keys(filteredProfile).length > 0) {
    // Use service role for profile update to bypass RLS
    const adminClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await adminClient
      .from("profiles")
      .update(filteredProfile)
      .eq("id", params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // If only email/password were changed, return the current profile
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", params.id)
    .single();

  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  // Delete from Supabase Auth (cascades to profiles via FK)
  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await adminClient.auth.admin.deleteUser(params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
