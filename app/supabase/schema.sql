create table if not exists public.app_config (
  id smallint primary key check (id = 1),
  username text not null unique check (username = 'ysw'),
  first_initialized_at timestamptz not null default now(),
  effective_start_date date not null default date '2026-06-10' check (effective_start_date = date '2026-06-10'),
  schema_version integer not null default 1,
  last_known_time_zone text
);

create table if not exists public.checkins (
  task_id text not null check (
    task_id in (
      'preset_bowel',
      'preset_sleep',
      'preset_exercise',
      'preset_healthy_diet'
    )
  ),
  date date not null check (date >= date '2026-06-10'),
  completed boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (task_id, date)
);

create or replace function public.set_checkin_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists checkins_updated_at on public.checkins;
create trigger checkins_updated_at
before update on public.checkins
for each row execute function public.set_checkin_updated_at();

alter table public.app_config enable row level security;
alter table public.checkins enable row level security;

drop policy if exists "v1 app config read" on public.app_config;
create policy "v1 app config read"
on public.app_config for select
to anon
using (id = 1);

drop policy if exists "v1 app config insert" on public.app_config;
create policy "v1 app config insert"
on public.app_config for insert
to anon
with check (id = 1 and username = 'ysw' and effective_start_date = date '2026-06-10');

drop policy if exists "v1 checkins read" on public.checkins;
create policy "v1 checkins read"
on public.checkins for select
to anon
using (date >= date '2026-06-10');

drop policy if exists "v1 checkins insert" on public.checkins;
create policy "v1 checkins insert"
on public.checkins for insert
to anon
with check (date >= date '2026-06-10');

drop policy if exists "v1 checkins update" on public.checkins;
create policy "v1 checkins update"
on public.checkins for update
to anon
using (date >= date '2026-06-10')
with check (date >= date '2026-06-10');

grant select, insert on public.app_config to anon;
grant select, insert, update on public.checkins to anon;
