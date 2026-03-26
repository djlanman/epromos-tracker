import { createClient } from "@/lib/supabase/server";
import ProcessTrackerForm from "@/components/ProcessTrackerForm";
import type { Profile } from "@/lib/supabase";

export default async function ProcessTrackerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return <ProcessTrackerForm initialProfile={profile} />;
}
