-- Employer subscription plans catalogue
create table if not exists public.subscription_plans (
  id          text primary key,           -- 'starter' | 'growth' | 'professional' | 'enterprise'
  name        text not null,
  price_month numeric(10,2) not null default 0,
  price_year  numeric(10,2) not null default 0,
  listing_limit        int  not null default 1,   -- max active job listings (-1 = unlimited)
  application_limit    int  not null default 10,  -- per listing (-1 = unlimited)
  cv_search_limit      int  not null default 0,   -- per month (-1 = unlimited)
  ats_kanban           boolean not null default false,
  video_assessments    boolean not null default false,
  advanced_analytics   boolean not null default false,
  api_access           boolean not null default false,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now()
);

insert into public.subscription_plans values
  ('starter',      'Starter',      0,       0,       1,  10,  0,    false, false, false, false, true, now()),
  ('growth',       'Growth',       799,     7199,    5,  -1,  50,   true,  false, false, false, true, now()),
  ('professional', 'Professional', 1999,    17999,   20, -1,  -1,   true,  true,  true,  false, true, now()),
  ('enterprise',   'Enterprise',   0,       0,       -1, -1,  -1,   true,  true,  true,  true,  true, now())
on conflict (id) do nothing;


-- Employer subscriptions (one active row per employer)
create table if not exists public.employer_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  employer_id     uuid not null references public.profiles(id) on delete cascade,
  plan_id         text not null references public.subscription_plans(id),
  billing_cycle   text not null default 'monthly' check (billing_cycle in ('monthly','annual')),
  status          text not null default 'active'
                    check (status in ('active','trialing','cancelled','past_due','paused')),
  trial_ends_at   timestamptz,
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz,
  cancelled_at    timestamptz,
  payment_ref     text,                   -- payment provider reference (filled once payments are live)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint uq_employer_subscription unique (employer_id)
);

-- Subscription change history for auditing
create table if not exists public.subscription_events (
  id            uuid primary key default gen_random_uuid(),
  employer_id   uuid not null references public.profiles(id) on delete cascade,
  event_type    text not null
                  check (event_type in ('started_trial','plan_selected','plan_changed','cancelled','reactivated','payment_confirmed')),
  from_plan     text references public.subscription_plans(id),
  to_plan       text references public.subscription_plans(id),
  billing_cycle text,
  payment_ref   text,
  meta          jsonb,
  created_at    timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_employer_subscriptions_updated_at on public.employer_subscriptions;
create trigger trg_employer_subscriptions_updated_at
  before update on public.employer_subscriptions
  for each row execute function public.set_updated_at();


-- RLS: employers can only read/write their own row
alter table public.employer_subscriptions enable row level security;
alter table public.subscription_events     enable row level security;
alter table public.subscription_plans      enable row level security;

create policy "plans_public_read"
  on public.subscription_plans for select using (true);

create policy "employers_own_subscription"
  on public.employer_subscriptions for all
  using (employer_id = auth.uid());

create policy "employers_own_events"
  on public.subscription_events for select
  using (employer_id = auth.uid());
