-- PROGRESS app — Supabase schema
-- Run in Supabase Dashboard → SQL Editor → New query

create extension if not exists "pgcrypto";

create table if not exists trainers (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  trainer_id uuid not null references trainers(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  client_code text not null unique references clients(code) on delete cascade,
  days jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists workout_logs (
  id uuid primary key default gen_random_uuid(),
  client_code text not null references clients(code) on delete cascade,
  log_date date not null,
  day_key text not null,
  exercises jsonb not null default '[]'::jsonb,
  notes text default '',
  created_at timestamptz not null default now(),
  unique (client_code, log_date, day_key)
);

create table if not exists body_metrics (
  id uuid primary key default gen_random_uuid(),
  client_code text not null references clients(code) on delete cascade,
  metric_date date not null,
  weight numeric,
  waist numeric,
  chest numeric,
  pulse numeric,
  sleep numeric,
  custom jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (client_code, metric_date)
);

create index if not exists idx_clients_trainer on clients(trainer_id);
create index if not exists idx_workout_logs_client on workout_logs(client_code);
create index if not exists idx_body_metrics_client on body_metrics(client_code);

-- RLS (MVP: open access via anon/publishable key — tighten with auth later)
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainers_all" ON public.trainers;
DROP POLICY IF EXISTS "clients_all" ON public.clients;
DROP POLICY IF EXISTS "programs_all" ON public.programs;
DROP POLICY IF EXISTS "workout_logs_all" ON public.workout_logs;
DROP POLICY IF EXISTS "body_metrics_all" ON public.body_metrics;
DROP POLICY IF EXISTS "trainers_anon_all" ON public.trainers;
DROP POLICY IF EXISTS "clients_anon_all" ON public.clients;
DROP POLICY IF EXISTS "programs_anon_all" ON public.programs;
DROP POLICY IF EXISTS "workout_logs_anon_all" ON public.workout_logs;
DROP POLICY IF EXISTS "body_metrics_anon_all" ON public.body_metrics;

CREATE POLICY "trainers_anon_all" ON public.trainers
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clients_anon_all" ON public.clients
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "programs_anon_all" ON public.programs
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "workout_logs_anon_all" ON public.workout_logs
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "body_metrics_anon_all" ON public.body_metrics
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
