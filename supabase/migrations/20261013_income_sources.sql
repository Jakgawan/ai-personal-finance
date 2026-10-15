-- งาน 3: รายได้ประจำ (income_sources) + วันที่เงินก้อนถัดไปเข้า (target_date)
-- รันเองใน Supabase SQL Editor

create table if not exists public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'เงินเดือน' check (char_length(name) between 1 and 50),
  amount numeric null check (amount is null or amount > 0),
  -- ตอนนี้รองรับแค่ monthly_days; weekly/every_n_days/daily จะเพิ่มทีหลังโดยแก้ check นี้
  schedule_type text not null default 'monthly_days' check (schedule_type in ('monthly_days')),
  -- วันที่ของเดือนที่เงินเข้า เช่น {5,20}
  monthly_days smallint[] not null check (
    cardinality(monthly_days) between 1 and 31
    and 1 <= all(monthly_days)
    and 31 >= all(monthly_days)
    and array_position(monthly_days, null) is null
  ),
  created_at timestamptz not null default now()
);

create index if not exists income_sources_user_id_idx on public.income_sources (user_id);

alter table public.income_sources enable row level security;

-- ถ้ารันซ้ำ ให้ drop policy เดิมก่อน
drop policy if exists "income_sources_own" on public.income_sources;
create policy "income_sources_own" on public.income_sources
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- วันที่เงินก้อนถัดไปเข้า สำหรับคนที่ไม่มีรายได้ประจำ
alter table public.financial_profile add column if not exists target_date date;
