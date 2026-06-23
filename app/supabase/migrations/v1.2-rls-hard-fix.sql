-- 万岁 V1.2 RLS 强制修复补丁
-- 用途：清掉历史残留 policy，重建当前网页版本需要的读写权限。
-- 不删除任何用户、任务、打卡、任务版本数据。

grant usage on schema public to anon, authenticated;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('app_config', 'users', 'checkins', 'tasks', 'task_versions')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

alter table public.app_config enable row level security;
alter table public.users enable row level security;
alter table public.checkins enable row level security;
alter table public.tasks enable row level security;
alter table public.task_versions enable row level security;

create policy "wansui app_config all"
on public.app_config
for all
to anon, authenticated
using (true)
with check (true);

create policy "wansui users all"
on public.users
for all
to anon, authenticated
using (true)
with check (true);

create policy "wansui checkins all"
on public.checkins
for all
to anon, authenticated
using (date >= date '2026-06-10')
with check (date >= date '2026-06-10');

create policy "wansui tasks all"
on public.tasks
for all
to anon, authenticated
using (true)
with check (true);

create policy "wansui task_versions all"
on public.task_versions
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update on public.app_config to anon, authenticated;
grant select, insert, update on public.users to anon, authenticated;
grant select, insert, update, delete on public.checkins to anon, authenticated;
grant select, insert, update, delete on public.tasks to anon, authenticated;
grant select, insert, update, delete on public.task_versions to anon, authenticated;
