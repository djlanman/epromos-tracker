import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const origin = new URL(req.url).origin;
  return NextResponse.redirect(`${origin}/login`, { status: 302 });
}
