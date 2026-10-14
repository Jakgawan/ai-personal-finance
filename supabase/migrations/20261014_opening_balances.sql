-- =====================================================================
-- opening_balances (เฟส 1.5 งาน 4) — ยอดเงินตั้งต้นของผู้ใช้
-- รันเองใน Supabase SQL Editor (ไฟล์นี้รันซ้ำได้ ไม่พัง)
-- =====================================================================

-- 1) ตาราง opening_balances
-- ยอดที่ "ใช้งานอยู่" = แถวที่ created_at ล่าสุดของผู้ใช้แต่ละคน
-- แถวเป็นประวัติ ห้ามแก้ไข (ปรับยอดใหม่ = เพิ่มแถวใหม่)
create table if not exists public.opening_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- ไม่ตรวจเครื่องหมาย: ยอดที่ปรับแล้วอาจติดลบได้ (ชดเชยรายการของวันนี้ที่จดไปแล้ว)
  amount numeric not null,
  -- ตัวเลขที่ผู้ใช้พิมพ์จริง (ใช้แสดงผล); amount คือค่าที่ชดเชยรายการวันนี้แล้ว ใช้คำนวณในงาน 5
  entered_amount numeric not null,
  -- ยอด "ตอนต้นวัน" ของวันที่นี้ (เวลาไทย)
  opening_date date not null,
  -- งาน 5 อาจเพิ่ม 'carryover' ภายหลัง
  source text not null check (source in ('onboarding', 'onboarding_backfill', 'adjust')),
  created_at timestamptz not null default now()
);

create index if not exists opening_balances_user_created_idx
  on public.opening_balances (user_id, created_at desc);

-- 2) RLS: ผู้ใช้เห็นและเขียนได้เฉพาะแถวของตัวเอง
alter table public.opening_balances enable row level security;

drop policy if exists "opening_balances_own" on public.opening_balances;
create policy "opening_balances_own" on public.opening_balances
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3) เพิ่มคอลัมน์ท้าย view analytics.user_activation (คอลัมน์เดิมคงลำดับ/ชนิดเดิมทั้งหมด)
--    opening_set_at   = เวลา (ไทย) ที่ตั้งยอดตั้งต้นครั้งแรก, null ถ้ายังไม่เคย
--    minutes_to_opening = นาทีจากสมัครถึงตั้งยอดครั้งแรก
create or replace view analytics.user_activation with (security_invoker = true) as
with tx as (
  -- รายการที่ผู้ใช้จดเอง (ไม่นับรายการที่ระบบสร้างจาก recurring)
  -- "is distinct from" ทำให้ note ที่เป็น null นับเป็นรายการปกติ
  select
    t.user_id,
    t.created_at,
    (t.created_at at time zone 'Asia/Bangkok')::date as tx_date_th  -- วันที่ตามเวลาไทย
  from public.transactions t
  where t.note is distinct from 'สร้างอัตโนมัติจากรายการซ้ำ'
),
-- สรุปต่อผู้ใช้: รายการแรกและจำนวนรายการทั้งหมด
agg as (
  select
    user_id,
    min(created_at) as first_tx_created_at,
    count(*)        as total_tx
  from tx
  group by user_id
),
-- ยอดตั้งต้นครั้งแรกของผู้ใช้
ob as (
  select user_id, min(created_at) as first_opening_created_at
  from public.opening_balances
  group by user_id
)
select
  u.id    as user_id,
  u.email as email,
  -- เวลาสมัครเป็นเวลาไทย (timestamp ไม่มี timezone)
  (u.created_at at time zone 'Asia/Bangkok')                as signed_up_at,
  (u.created_at at time zone 'Asia/Bangkok')::date          as signup_date,
  -- เวลาที่บันทึกรายการแรก (เวลาไทย) เป็น null ถ้ายังไม่เคยจด
  (a.first_tx_created_at at time zone 'Asia/Bangkok')       as first_tx_at,
  -- ชั่วโมงจากสมัครถึงรายการแรก ทศนิยม 1 ตำแหน่ง
  round(extract(epoch from (a.first_tx_created_at - u.created_at)) / 3600, 1) as hours_to_first_tx,
  -- จำนวนวัน (ไม่ซ้ำ) ที่จดรายการ ภายใน 7 วันแรก นับวันสมัครเป็นวันที่ 1
  coalesce((
    select count(distinct x.tx_date_th)
    from tx x
    where x.user_id = u.id
      and x.tx_date_th between (u.created_at at time zone 'Asia/Bangkok')::date
                           and (u.created_at at time zone 'Asia/Bangkok')::date + 6
  ), 0)::int as active_days_first_7,
  -- active = จดอย่างน้อย 3 วันใน 7 วันแรก
  coalesce((
    select count(distinct x.tx_date_th)
    from tx x
    where x.user_id = u.id
      and x.tx_date_th between (u.created_at at time zone 'Asia/Bangkok')::date
                           and (u.created_at at time zone 'Asia/Bangkok')::date + 6
  ), 0) >= 3 as is_active,
  coalesce(a.total_tx, 0)::int as total_tx,
  -- คอลัมน์ใหม่ (ต่อท้าย)
  (ob.first_opening_created_at at time zone 'Asia/Bangkok') as opening_set_at,
  round(extract(epoch from (ob.first_opening_created_at - u.created_at)) / 60, 1) as minutes_to_opening
from auth.users u
left join agg a on a.user_id = u.id   -- left join: ผู้ใช้ที่ไม่มีรายการก็ยังขึ้น
left join ob on ob.user_id = u.id;

-- กัน view ถูกเปิดสิทธิ์โดยอัตโนมัติ: ถอนสิทธิ์ทุกตารางใน schema นี้อีกรอบ
revoke all on all tables in schema analytics from public, anon, authenticated;
