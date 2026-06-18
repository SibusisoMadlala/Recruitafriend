-- Push notification subscriptions
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (user_id)
);

alter table public.push_subscriptions enable row level security;

create policy "Users manage their own push subscription"
  on public.push_subscriptions
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role can read subscriptions to send pushes
create policy "Service role reads push subscriptions"
  on public.push_subscriptions
  for select
  using (true);
