create table if not exists public.profile_views (
  id         uuid primary key default gen_random_uuid(),
  viewer_id  uuid not null references auth.users(id) on delete cascade,
  seeker_id  uuid not null references auth.users(id) on delete cascade,
  viewed_at  timestamptz default now()
);

create index if not exists profile_views_seeker_viewed on public.profile_views (seeker_id, viewed_at desc);

alter table public.profile_views enable row level security;

-- Seekers can read their own view counts; employers can insert views
create policy "Seekers read own views"
  on public.profile_views for select
  using (auth.uid() = seeker_id);

create policy "Employers insert views"
  on public.profile_views for insert
  with check (auth.uid() = viewer_id);
