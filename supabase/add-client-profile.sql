-- Client profile visible to trainer (run in Supabase SQL Editor)
alter table public.clients
  add column if not exists profile jsonb not null default '{}'::jsonb;
