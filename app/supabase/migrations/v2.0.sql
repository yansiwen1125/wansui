-- 万岁 V2.0：出生信息与每日运势/塔罗结果
-- 只新增表和权限，不删除、不覆盖 V1.x 的打卡数据。

create table if not exists public.user_profiles (
  username text primary key references public.users(username) on delete cascade,
  birth_date date not null,
  birth_time time,
  birth_time_unknown boolean not null default false,
  birth_city text,
  birth_timezone text,
  reading_start_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_readings (
  username text not null references public.users(username) on delete cascade,
  reading_date date not null,
  fortune_score integer not null check (fortune_score >= 0 and fortune_score <= 100),
  good_tags text[] not null default '{}',
  caution_tags text[] not null default '{}',
  lucky_number integer,
  lucky_color text,
  astrology_key text,
  tarot_card_id text,
  tarot_orientation text check (tarot_orientation in ('upright', 'reversed')),
  content jsonb not null default '{}'::jsonb,
  algorithm_version text not null default 'v2.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (username, reading_date)
);

create index if not exists daily_readings_username_date_idx
on public.daily_readings (username, reading_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_updated_at on public.user_profiles;
create trigger user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists daily_readings_updated_at on public.daily_readings;
create trigger daily_readings_updated_at
before update on public.daily_readings
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.daily_readings enable row level security;

drop policy if exists "wansui user_profiles all" on public.user_profiles;
create policy "wansui user_profiles all"
on public.user_profiles
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "wansui daily_readings all" on public.daily_readings;
create policy "wansui daily_readings all"
on public.daily_readings
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.user_profiles to anon, authenticated;
grant select, insert, update, delete on public.daily_readings to anon, authenticated;
