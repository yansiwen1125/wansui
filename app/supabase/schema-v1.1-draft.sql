-- 万岁 V1.1 Supabase 迁移草稿
-- 先不要直接在线上执行。等本地 V1.1 确认后，再在 Supabase SQL Editor 里逐段执行。

create table if not exists public.users (
  username text primary key,
  created_at timestamptz not null default now()
);

insert into public.users (username)
values ('ysw')
on conflict (username) do nothing;

alter table public.checkins
  add column if not exists username text;

update public.checkins
set username = 'ysw'
where username is null;

alter table public.checkins
  alter column username set not null;

alter table public.checkins
  drop constraint if exists checkins_task_id_check;

alter table public.checkins
  drop constraint if exists checkins_pkey;

alter table public.checkins
  add primary key (username, task_id, date);

create table if not exists public.tasks (
  id text not null,
  username text not null references public.users(username) on delete cascade,
  name text not null,
  color text not null,
  sort_order integer not null,
  created_date date not null default date '2026-06-10',
  hidden_periods jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (username, id)
);

insert into public.tasks (username, id, name, color, sort_order, created_date)
values
  ('ysw', 'preset_bowel', '拉屎', '#A9795B', 1, date '2026-06-10'),
  ('ysw', 'preset_sleep', '早睡', '#315F8A', 2, date '2026-06-10'),
  ('ysw', 'preset_exercise', '运动', '#82BDE3', 3, date '2026-06-10'),
  ('ysw', 'preset_healthy_diet', '饮食健康', '#7FB77E', 4, date '2026-06-10')
on conflict (username, id) do nothing;

create or replace function public.set_task_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
before update on public.tasks
for each row execute function public.set_task_updated_at();

alter table public.users enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "v1.1 users read" on public.users;
create policy "v1.1 users read"
on public.users for select
to anon
using (true);

drop policy if exists "v1.1 users insert" on public.users;
create policy "v1.1 users insert"
on public.users for insert
to anon
with check (true);

drop policy if exists "v1.1 tasks read" on public.tasks;
create policy "v1.1 tasks read"
on public.tasks for select
to anon
using (true);

drop policy if exists "v1.1 tasks insert" on public.tasks;
create policy "v1.1 tasks insert"
on public.tasks for insert
to anon
with check (true);

drop policy if exists "v1.1 tasks update" on public.tasks;
create policy "v1.1 tasks update"
on public.tasks for update
to anon
using (true)
with check (true);

drop policy if exists "v1 checkins read" on public.checkins;
drop policy if exists "v1 checkins insert" on public.checkins;
drop policy if exists "v1 checkins update" on public.checkins;

create policy "v1.1 checkins read"
on public.checkins for select
to anon
using (date >= date '2026-06-10');

create policy "v1.1 checkins insert"
on public.checkins for insert
to anon
with check (date >= date '2026-06-10');

create policy "v1.1 checkins update"
on public.checkins for update
to anon
using (date >= date '2026-06-10')
with check (date >= date '2026-06-10');

grant select, insert on public.users to anon;
grant select, insert, update on public.tasks to anon;
grant select, insert, update on public.checkins to anon;
