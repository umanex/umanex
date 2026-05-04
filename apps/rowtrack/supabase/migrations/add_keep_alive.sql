-- Keep-alive tabel om Supabase free tier project actief te houden
create table public.keep_alive (
  id         uuid primary key default gen_random_uuid(),
  pinged_at  timestamptz not null default now()
);

-- Index op pinged_at voor snelle delete van oude rijen
create index keep_alive_pinged_at_idx on public.keep_alive (pinged_at);

-- Veiligheid: voorkom dat clients pinged_at in de toekomst zetten
alter table public.keep_alive
  add constraint keep_alive_no_future
  check (pinged_at <= now() + interval '1 minute');

-- RLS aan
alter table public.keep_alive enable row level security;

-- Anon mag inserten (kolomen vullen zich via defaults)
create policy "anon can insert keep_alive"
  on public.keep_alive
  for insert
  to anon
  with check (true);

-- Anon mag alleen oude rijen verwijderen (>1 dag oud)
create policy "anon can delete old keep_alive"
  on public.keep_alive
  for delete
  to anon
  using (pinged_at < now() - interval '1 day');
