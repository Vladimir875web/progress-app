-- Client training schedule (run in Supabase SQL Editor)
alter table public.clients
  add column if not exists schedule jsonb not null default '{"sessions":[]}'::jsonb;
