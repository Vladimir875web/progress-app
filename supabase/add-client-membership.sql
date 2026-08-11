-- Client membership / payments (run in Supabase SQL Editor)
alter table public.clients
  add column if not exists membership jsonb not null default '{"remainingSessions":0,"payments":[]}'::jsonb;
