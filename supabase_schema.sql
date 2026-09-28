-- ============================================================
-- ZOOSH PRODUCTION SCHEDULING — SUPABASE REALTIME SCHEMA
-- Run this in your Supabase SQL Editor to enable multi-user sync.
-- ============================================================

-- 1. Create the factory_state table to hold synchronized state
CREATE TABLE IF NOT EXISTS factory_state (
  id TEXT PRIMARY KEY DEFAULT 'zoosh_main',
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_by TEXT DEFAULT 'Factory Floor'
);

-- 2. Enable Row Level Security (RLS) and allow public read/write with anon key
ALTER TABLE factory_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read factory_state" ON factory_state;
CREATE POLICY "Allow public read factory_state"
  ON factory_state FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow public insert factory_state" ON factory_state;
CREATE POLICY "Allow public insert factory_state"
  ON factory_state FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update factory_state" ON factory_state;
CREATE POLICY "Allow public update factory_state"
  ON factory_state FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 3. Enable Supabase Realtime so all connected browsers receive instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE factory_state;
