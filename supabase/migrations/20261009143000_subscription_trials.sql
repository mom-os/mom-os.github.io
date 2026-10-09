-- Trial tracking for honest one-trial-per-customer Pro subscriptions
alter table public.subscriptions
  add column if not exists trial_used boolean not null default false,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists trial_reminder_sent_at timestamptz;

comment on column public.subscriptions.trial_used is 'True after any trial or paid/founding Pro — never offer another free trial.';
comment on column public.subscriptions.trial_ends_at is 'When current trial ends (status=trialing).';
