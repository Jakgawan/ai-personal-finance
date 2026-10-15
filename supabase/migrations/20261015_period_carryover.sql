-- =====================================================================
-- งาน 5c: ขึ้นรอบใหม่ — ยกยอด / ไม่ยกยอด
-- รันเองใน Supabase SQL Editor (ไฟล์นี้รันซ้ำได้ ไม่พัง)
-- =====================================================================

-- 1) เพิ่ม 'carryover' ใน source ของ opening_balances
--    constraint ที่สร้างจาก check ในคอลัมน์ตั้งชื่ออัตโนมัติเป็น <table>_<column>_check
alter table public.opening_balances drop constraint if exists opening_balances_source_check;
alter table public.opening_balances add constraint opening_balances_source_check
  check (source in ('onboarding', 'onboarding_backfill', 'adjust', 'carryover'));

-- 2) เงินที่เหลือจากรอบก่อน (ใช้แสดงผลเท่านั้น) — มีค่าเฉพาะแถว source = 'carryover'
alter table public.opening_balances add column if not exists leftover numeric;

-- 3) ค่าที่ผู้ใช้เลือกไว้: null = ถามทุกครั้ง, 'carry' = ยกยอดเสมอ, 'reset' = ไม่ยกยอดเสมอ
alter table public.financial_profile
  add column if not exists carryover_pref text check (carryover_pref in ('ask', 'carry', 'reset'));

-- 4) วันเงินเข้า (payday) ล่าสุดที่จัดการเรื่องยกยอดไปแล้ว
alter table public.financial_profile add column if not exists last_period_decided date;

-- 5) วันเงินเข้าที่ผู้ใช้กด "ยังไม่เข้า" (ไม่ถามซ้ำสำหรับวันนั้น)
alter table public.financial_profile add column if not exists income_prompt_dismissed date;

-- 6) วันเริ่มของรอบก่อน (ตัดตามวันตั้งยอดเดิมแล้ว) ใช้แสดงช่วงวันที่ "เหลือจากรอบที่แล้ว"
alter table public.opening_balances add column if not exists leftover_from date;
