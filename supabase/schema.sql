-- Run once in the Supabase SQL editor. One row per player holding the whole save as JSON.
create table if not exists public.player_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  save jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;

create policy "players read own save"
  on public.player_saves for select
  using (auth.uid() = user_id);

create policy "players insert own save"
  on public.player_saves for insert
  with check (auth.uid() = user_id);

create policy "players update own save"
  on public.player_saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
