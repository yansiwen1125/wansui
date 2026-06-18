-- 万岁 V1.2 云端写入诊断
-- 只使用 __wansui_diag__ 临时用户，不影响真实用户数据。
-- 如果这里报错，把 Supabase 显示的红色错误发给 Codex。

begin;

set local role anon;

insert into public.users (username)
values ('__wansui_diag__')
on conflict (username) do nothing;

insert into public.tasks (
  username,
  id,
  name,
  color,
  sort_order,
  created_date,
  hidden_periods
)
values (
  '__wansui_diag__',
  'diag_task',
  '诊断任务',
  '#A9795B',
  1,
  date '2026-06-18',
  '[]'::jsonb
)
on conflict (username, id) do update
set
  name = excluded.name,
  color = excluded.color,
  sort_order = excluded.sort_order,
  created_date = excluded.created_date,
  hidden_periods = excluded.hidden_periods;

insert into public.task_versions (
  username,
  effective_date,
  tasks
)
values (
  '__wansui_diag__',
  date '2026-06-18',
  '[{"id":"diag_task","name":"诊断任务","color":"#A9795B","sortOrder":1,"createdDate":"2026-06-18","hiddenPeriods":[]}]'::jsonb
)
on conflict (username, effective_date) do update
set tasks = excluded.tasks;

insert into public.checkins (
  username,
  task_id,
  date,
  completed
)
values (
  '__wansui_diag__',
  'diag_task',
  date '2026-06-18',
  false
)
on conflict (username, task_id, date) do update
set completed = excluded.completed;

delete from public.checkins
where username = '__wansui_diag__'
  and task_id = 'diag_task'
  and completed = false;

delete from public.tasks
where username = '__wansui_diag__'
  and id = 'diag_task';

delete from public.task_versions
where username = '__wansui_diag__';

rollback;

select 'V1.2 cloud write diagnostics passed' as result;
