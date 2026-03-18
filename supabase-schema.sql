-- ============================================================
-- ePromos Time Study — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Time Entries Table
CREATE TABLE IF NOT EXISTS time_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  po_number        TEXT,
  so_number        TEXT,
  department       TEXT NOT NULL,
  role             TEXT NOT NULL,
  task_category    TEXT NOT NULL,
  task_name        TEXT NOT NULL,
  task_owner       TEXT NOT NULL,
  notes            TEXT,
  start_time       TIMESTAMPTZ,
  end_time         TIMESTAMPTZ,
  duration_seconds INTEGER
);

-- Employees Table
CREATE TABLE IF NOT EXISTS employees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name        TEXT NOT NULL,
  role        TEXT NOT NULL,
  department  TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_time_entries_created_at ON time_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_task_owner ON time_entries (task_owner);
CREATE INDEX IF NOT EXISTS idx_time_entries_department  ON time_entries (department);
CREATE INDEX IF NOT EXISTS idx_employees_active         ON employees (active);

-- ============================================================
-- Row Level Security (RLS)
-- Enable RLS and allow public read/write for the anon key.
-- Tighten these policies once you add Supabase Auth if needed.
-- ============================================================

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees    ENABLE ROW LEVEL SECURITY;

-- Allow all operations with the anon key (public access)
CREATE POLICY "Allow all time_entries" ON time_entries
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all employees" ON employees
  FOR ALL USING (true) WITH CHECK (true);
