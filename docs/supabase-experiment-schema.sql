-- Run in Supabase SQL Editor
-- Purpose: store normalized experiment sessions + event rows from /api/experiment/events/batch

create table if not exists public.experiment_sessions (
  session_id text primary key,
  participant_id text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  app_version text null,
  summary jsonb null,
  event_count integer not null default 0,
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.experiment_events (
  id bigserial primary key,
  event_id text not null unique,
  session_id text not null references public.experiment_sessions(session_id) on delete cascade,
  participant_id text not null,
  phase text null check (phase in ('pre', 'monster', 'post', 'meta')),
  task text null,
  step text null,
  question_id text null,
  trial_id integer null,
  rt_ms double precision null,
  user_answer jsonb null,
  correct_answer jsonb null,
  is_correct boolean null,
  stimulus_data jsonb null,
  metrics_data jsonb null,
  raw_json jsonb not null,
  created_at timestamptz not null,
  inserted_at timestamptz not null default now()
);

create index if not exists experiment_events_session_id_idx
  on public.experiment_events(session_id);

create index if not exists experiment_events_task_idx
  on public.experiment_events(task);

create index if not exists experiment_events_phase_idx
  on public.experiment_events(phase);

create index if not exists experiment_events_created_at_idx
  on public.experiment_events(created_at);

-- Optional: keep updated_at fresh on session upserts
create or replace function public.touch_experiment_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_experiment_sessions_updated_at on public.experiment_sessions;
create trigger trg_touch_experiment_sessions_updated_at
before update on public.experiment_sessions
for each row execute function public.touch_experiment_sessions_updated_at();

-- Recommended: enable RLS and keep table private.
alter table public.experiment_sessions enable row level security;
alter table public.experiment_events enable row level security;

-- Do not create anon policies unless you explicitly need browser direct access.
-- The Next.js API route uses SUPABASE_SERVICE_ROLE_KEY and bypasses RLS.

