-- Mom.OS sync schema: per-user documents with RLS + Realtime

create extension if not exists pgcrypto with schema extensions;

-- Per-day planner documents
create table if not exists public.days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day_date date not null,
  doc jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, day_date)
);
create index if not exists days_user_updated_idx on public.days (user_id, updated_at desc);

-- Settings (textSize, anchors, style, …)
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  doc jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Day templates (weekday / weekend blueprints)
create table if not exists public.templates (
  user_id uuid primary key references auth.users (id) on delete cascade,
  doc jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Month notes keyed by YYYY-MM
create table if not exists public.month_notes (
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null,
  doc jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, month_key)
);

-- Secret token for public ICS subscription URL
create table if not exists public.calendar_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

-- Auto-touch updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists days_set_updated_at on public.days;
create trigger days_set_updated_at before update on public.days
  for each row execute function public.set_updated_at();
drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();
drop trigger if exists templates_set_updated_at on public.templates;
create trigger templates_set_updated_at before update on public.templates
  for each row execute function public.set_updated_at();
drop trigger if exists month_notes_set_updated_at on public.month_notes;
create trigger month_notes_set_updated_at before update on public.month_notes
  for each row execute function public.set_updated_at();

-- RLS
alter table public.days enable row level security;
alter table public.user_settings enable row level security;
alter table public.templates enable row level security;
alter table public.month_notes enable row level security;
alter table public.calendar_tokens enable row level security;

create policy "days_own" on public.days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "settings_own" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "templates_own" on public.templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "month_notes_own" on public.month_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "calendar_tokens_own" on public.calendar_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime (ignore if already added)
do $$ begin
  begin alter publication supabase_realtime add table public.days; exception when duplicate_object then null; when others then null; end;
  begin alter publication supabase_realtime add table public.user_settings; exception when others then null; end;
  begin alter publication supabase_realtime add table public.templates; exception when others then null; end;
  begin alter publication supabase_realtime add table public.month_notes; exception when others then null; end;
end $$;

-- Helper: ensure a calendar token exists for the current user
create or replace function public.ensure_calendar_token()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  t text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select token into t from public.calendar_tokens where user_id = auth.uid();
  if t is null then
    t := encode(gen_random_bytes(32), 'hex');
    insert into public.calendar_tokens (user_id, token) values (auth.uid(), t);
  end if;
  return t;
end;
$$;

create or replace function public.rotate_calendar_token()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  t text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  t := encode(gen_random_bytes(32), 'hex');
  insert into public.calendar_tokens (user_id, token, rotated_at)
    values (auth.uid(), t, now())
    on conflict (user_id) do update
      set token = excluded.token, rotated_at = now();
  return t;
end;
$$;

grant execute on function public.ensure_calendar_token() to authenticated;
grant execute on function public.rotate_calendar_token() to authenticated;
