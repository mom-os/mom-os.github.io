-- Server-side entitlements (source of truth). Clients may SELECT own row; only service role writes.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  founding_mom boolean not null default false,
  founding_expires_at timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  status text not null default 'none',
  price_lookup_key text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx on public.subscriptions (stripe_customer_id);
create index if not exists subscriptions_sub_idx on public.subscriptions (stripe_subscription_id);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);
-- no insert/update/delete policies for authenticated → service role only

-- Strip client-writable plan fields from user_settings.doc so plan can't be self-granted via sync.
create or replace function public.strip_plan_from_settings_doc()
returns trigger
language plpgsql
as $$
begin
  if new.doc is null then
    new.doc := '{}'::jsonb;
  end if;
  new.doc := new.doc - 'plan' - 'foundingMom' - 'stripeCustomerId' - 'stripeSubscriptionId';
  return new;
end;
$$;

drop trigger if exists user_settings_strip_plan on public.user_settings;
create trigger user_settings_strip_plan
  before insert or update on public.user_settings
  for each row execute function public.strip_plan_from_settings_doc();

do $$ begin
  begin alter publication supabase_realtime add table public.subscriptions; exception when others then null; end;
end $$;
