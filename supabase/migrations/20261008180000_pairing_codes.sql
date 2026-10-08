-- Device pairing codes: short-lived single-use codes to sign in another device
-- without email. Only hashed codes are stored; Edge Function (service role) only.

create table if not exists public.pairing_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts int not null default 0,
  max_attempts int not null default 5
);

create index if not exists pairing_codes_user_created_idx
  on public.pairing_codes (user_id, created_at desc);
create index if not exists pairing_codes_expires_idx
  on public.pairing_codes (expires_at)
  where used_at is null;

-- Per-IP redeem rate limiting (hashed IP only)
create table if not exists public.pairing_redeem_rate (
  id bigserial primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists pairing_redeem_rate_ip_created_idx
  on public.pairing_redeem_rate (ip_hash, created_at desc);

alter table public.pairing_codes enable row level security;
alter table public.pairing_redeem_rate enable row level security;

-- Lock down: no policies for anon/authenticated (service role bypasses RLS)
revoke all on table public.pairing_codes from anon, authenticated, public;
revoke all on table public.pairing_redeem_rate from anon, authenticated, public;
grant all on table public.pairing_codes to service_role;
grant all on table public.pairing_redeem_rate to service_role;
grant usage, select on sequence public.pairing_redeem_rate_id_seq to service_role;

-- Cleanup helper (optional, callable by service role / cron later)
create or replace function public.cleanup_pairing_codes()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.pairing_codes
    where expires_at < now() - interval '1 day'
       or (used_at is not null and used_at < now() - interval '1 day');
  delete from public.pairing_redeem_rate
    where created_at < now() - interval '1 day';
$$;

revoke all on function public.cleanup_pairing_codes() from public, anon, authenticated;
grant execute on function public.cleanup_pairing_codes() to service_role;
