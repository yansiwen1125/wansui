-- 万岁 V2.1：账号密码与安全问题凭证
-- 可重复执行：只给 users 表新增凭证字段，不删除、不覆盖业务数据。

alter table public.users
  add column if not exists password_hash text,
  add column if not exists password_salt text,
  add column if not exists password_updated_at timestamptz,
  add column if not exists security_question text,
  add column if not exists security_answer_hash text,
  add column if not exists security_answer_salt text,
  add column if not exists security_answer_updated_at timestamptz;

update public.app_config
set schema_version = greatest(schema_version, 13)
where id = 1;
