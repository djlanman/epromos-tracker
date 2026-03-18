-- ============================================================
-- ePromos Tracker — Schema v3 (Dynamic Task Hierarchy)
-- Run this in the Supabase SQL Editor AFTER running v1 & v2
-- ============================================================

-- 1. Departments
CREATE TABLE IF NOT EXISTS departments (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  sort_order  INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Roles (belong to a department)
CREATE TABLE IF NOT EXISTS roles (
  id              SERIAL PRIMARY KEY,
  department_id   INT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  sort_order      INT NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(department_id, name)
);

-- 3. Task Categories (belong to a role)
CREATE TABLE IF NOT EXISTS task_categories (
  id          SERIAL PRIMARY KEY,
  role_id     INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, name)
);

-- 4. Task Names (belong to a category) — kept for data integrity
--    even though not editable from the UI yet
CREATE TABLE IF NOT EXISTS task_names (
  id              SERIAL PRIMARY KEY,
  category_id     INT NOT NULL REFERENCES task_categories(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  sort_order      INT NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category_id, name)
);

-- 5. Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_roles_department ON roles(department_id);
CREATE INDEX IF NOT EXISTS idx_task_categories_role ON task_categories(role_id);
CREATE INDEX IF NOT EXISTS idx_task_names_category ON task_names(category_id);

-- 6. Row Level Security
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_names ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed for dropdowns)
CREATE POLICY "Authenticated users can view departments" ON departments
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view roles" ON roles
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view task_categories" ON task_categories
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view task_names" ON task_names
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service role has full access (used by admin API routes)
CREATE POLICY "Service role full access on departments" ON departments
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on roles" ON roles
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on task_categories" ON task_categories
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on task_names" ON task_names
  FOR ALL USING (auth.role() = 'service_role');
