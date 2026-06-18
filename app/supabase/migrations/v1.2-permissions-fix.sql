-- 万岁 V1.2 权限修复补丁
-- 只修 RLS policy 和权限，不删除任何用户数据。

grant usage on schema public to anon;

alter table public.users enable row level security;
alter table public.checkins enable row level security;
alter table public.tasks enable row level security;
alter table public.task_versions enable row level security;

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

grant select, insert, update on public.users to anon;
grant select, insert, update, delete on public.checkins to anon;
grant select, insert, update, delete on public.tasks to anon;
grant select, insert, update, delete on public.task_versions to anon;
