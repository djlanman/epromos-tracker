import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
};

export type Employee = {
  id: string;
  created_at: string;
  name: string;
  role: string;
  department: string;
  active: boolean;
};
