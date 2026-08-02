-- PROGRESS app — fix RLS policies for anon/publishable key
-- Run in Supabase Dashboard → SQL Editor → New query → Run

-- 1) Ensure RLS is ON
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;

-- 2) Drop old policies (safe re-run)
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

-- 3) Allow anon + authenticated (MVP: open access)
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

-- 4) Table grants (required alongside RLS policies)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
