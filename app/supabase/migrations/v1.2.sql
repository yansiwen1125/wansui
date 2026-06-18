-- 万岁 Supabase Schema / Migration
-- 可重复执行：用于从 V1 / V1.1 平滑升级到当前版本，不删除已有用户打卡数据。

create table if not exists public.app_config (
  id smallint primary key check (id = 1),
  username text not null default 'ysw',
  first_initialized_at timestamptz not null default now(),
  effective_start_date date not null default date '2026-06-10',
  schema_version integer not null default 12,
  last_known_time_zone text
);

insert into public.app_config (id, username, effective_start_date, schema_version)
values (1, 'ysw', date '2026-06-10', 12)
on conflict (id) do update
set schema_version = greatest(public.app_config.schema_version, 12);

create table if not exists public.users (
  username text primary key,
  created_at timestamptz not null default now()
);

insert into public.users (username)
values ('ysw')
on conflict (username) do nothing;

create table if not exists public.checkins (
  task_id text not null,
  date date not null check (date >= date '2026-06-10'),
  completed boolean not null default true,
  updated_at timestamptz not null default now()
);

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

create table if not exists public.task_versions (
  username text not null references public.users(username) on delete cascade,
  effective_date date not null check (effective_date >= date '2026-06-10'),
  tasks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (username, effective_date)
);

insert into public.task_versions (username, effective_date, tasks)
select
  t.username,
  date '2026-06-10',
  jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'color', t.color,
      'sortOrder', t.sort_order,
      'createdDate', t.created_date,
      'hiddenPeriods', t.hidden_periods,
      'updatedAt', t.updated_at
    )
    order by t.sort_order
  )
from public.tasks t
group by t.username
on conflict (username, effective_date) do nothing;

create or replace function public.set_updated_at()
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
for each row execute function public.set_updated_at();

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists task_versions_updated_at on public.task_versions;
create trigger task_versions_updated_at
before update on public.task_versions
for each row execute function public.set_updated_at();

alter table public.app_config enable row level security;
alter table public.users enable row level security;
alter table public.checkins enable row level security;
alter table public.tasks enable row level security;
alter table public.task_versions enable row level security;

drop policy if exists "v1 app config read" on public.app_config;
drop policy if exists "v1 app config insert" on public.app_config;
drop policy if exists "app config read" on public.app_config;
drop policy if exists "app config insert" on public.app_config;

create policy "app config read"
on public.app_config for select
to anon
using (id = 1);

create policy "app config insert"
on public.app_config for insert
to anon
with check (id = 1 and effective_start_date = date '2026-06-10');

drop policy if exists "v1.1 users read" on public.users;
drop policy if exists "v1.1 users insert" on public.users;
drop policy if exists "v1.1 users update" on public.users;
drop policy if exists "users read" on public.users;
drop policy if exists "users insert" on public.users;
drop policy if exists "users update" on public.users;

create policy "users read"
on public.users for select
to anon
using (true);

create policy "users insert"
on public.users for insert
to anon
with check (true);

create policy "users update"
on public.users for update
to anon
using (true)
with check (true);

drop policy if exists "v1 checkins read" on public.checkins;
drop policy if exists "v1 checkins insert" on public.checkins;
drop policy if exists "v1 checkins update" on public.checkins;
drop policy if exists "v1.1 checkins read" on public.checkins;
drop policy if exists "v1.1 checkins insert" on public.checkins;
drop policy if exists "v1.1 checkins update" on public.checkins;
drop policy if exists "checkins read" on public.checkins;
drop policy if exists "checkins insert" on public.checkins;
drop policy if exists "checkins update" on public.checkins;
drop policy if exists "checkins delete" on public.checkins;

create policy "checkins read"
on public.checkins for select
to anon
using (date >= date '2026-06-10');

create policy "checkins insert"
on public.checkins for insert
to anon
with check (date >= date '2026-06-10');

create policy "checkins update"
on public.checkins for update
to anon
using (date >= date '2026-06-10')
with check (date >= date '2026-06-10');

create policy "checkins delete"
on public.checkins for delete
to anon
using (date >= date '2026-06-10');

drop policy if exists "v1.1 tasks read" on public.tasks;
drop policy if exists "v1.1 tasks insert" on public.tasks;
drop policy if exists "v1.1 tasks update" on public.tasks;
drop policy if exists "tasks read" on public.tasks;
drop policy if exists "tasks insert" on public.tasks;
drop policy if exists "tasks update" on public.tasks;
drop policy if exists "tasks delete" on public.tasks;

create policy "tasks read"
on public.tasks for select
to anon
using (true);

create policy "tasks insert"
on public.tasks for insert
to anon
with check (true);

create policy "tasks update"
on public.tasks for update
to anon
using (true)
with check (true);

create policy "tasks delete"
on public.tasks for delete
to anon
using (true);

drop policy if exists "task versions read" on public.task_versions;
drop policy if exists "task versions insert" on public.task_versions;
drop policy if exists "task versions update" on public.task_versions;
drop policy if exists "task versions delete" on public.task_versions;

create policy "task versions read"
on public.task_versions for select
to anon
using (true);

create policy "task versions insert"
on public.task_versions for insert
to anon
with check (true);

create policy "task versions update"
on public.task_versions for update
to anon
using (true)
with check (true);

create policy "task versions delete"
on public.task_versions for delete
to anon
using (true);

grant select, insert on public.app_config to anon;
grant select, insert, update on public.users to anon;
grant select, insert, update, delete on public.checkins to anon;
grant select, insert, update, delete on public.tasks to anon;
grant select, insert, update, delete on public.task_versions to anon;
