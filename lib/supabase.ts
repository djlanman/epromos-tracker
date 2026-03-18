// Shared TypeScript types for the ePromos Tracker
// Supabase clients are now in lib/supabase/client.ts and lib/supabase/server.ts

export type Profile = {
  id: string;
  created_at: string;
  name: string;
  role: string;
  department: string;
  is_admin: boolean;
  active: boolean;
};

// Kept for backwards-compatibility
export type Employee = Profile;

export type TimeEntry = {
  id: string;
  created_at: string;
  po_number: string | null;
  so_number: string | null;
  department: string;
  role: string;
  task_category: string;
  task_name: string;
  task_owner: string;
  notes: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_seconds: number | null;
};
