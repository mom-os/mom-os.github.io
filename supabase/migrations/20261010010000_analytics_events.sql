-- Privacy-friendly product analytics: anon can INSERT only. No PII, no IP.
create table if not exists public.analytics_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  name text not null,
  path text,
  referrer_host text,
  utm_source text,
  visitor_id uuid not null,
  props jsonb not null default '{}'::jsonb
);

create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_name_created_idx on public.analytics_events (name, created_at desc);
create index if not exists analytics_events_visitor_day_idx on public.analytics_events (visitor_id, ((created_at at time zone 'America/Chicago')::date));

alter table public.analytics_events enable row level security;

-- Anon + authenticated may insert; nobody (except service role) can read/update/delete via PostgREST
drop policy if exists "analytics_insert_anon" on public.analytics_events;
create policy "analytics_insert_anon" on public.analytics_events
  for insert
  to anon, authenticated
  with check (
    name in (
      'page_view', 'start_free_click', 'signin_code_sent', 'signup_complete',
      'pro_sheet_open', 'checkout_start', 'install_click'
    )
    and char_length(coalesce(path, '')) <= 200
    and char_length(coalesce(referrer_host, '')) <= 200
    and char_length(coalesce(utm_source, '')) <= 80
    and visitor_id is not null
  );

-- No SELECT/UPDATE/DELETE policies for anon/authenticated → inserts only
comment on table public.analytics_events is 'Mom.OS privacy-friendly events; service role reads via scripts/stats.sh';
