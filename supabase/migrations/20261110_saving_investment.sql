-- =====================================================================
-- เก็บเงิน/ลงทุน ขั้น 1: เพิ่มประเภทรายการ saving / investment + ค่าตั้งต้นใน financial_profile
-- รันเองใน Supabase SQL Editor (ไฟล์นี้รันซ้ำได้ ไม่พัง ไม่ลบข้อมูล)
-- =====================================================================

-- 1) transactions.kind เพิ่มค่าใหม่
--    'saving'     = เก็บเงิน (type expense = ฝากเข้า, type income = ถอนคืน)
--    'investment' = ลงทุน   (type expense = ลงเงิน, type income = ถอนคืน)
--    ทั้งสองแบบไม่นับเป็นรายรับ/รายจ่ายปกติ และไม่นับเป็น "วันนี้ใช้ไป"
--    drop แล้ว add ใหม่เพื่อรันซ้ำได้ — constraint transactions_envelope_kind_check
--    (envelope_id is null or kind = 'regular') ไม่ถูกแตะ และยังใช้ได้ตามเดิม
alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions add constraint transactions_kind_check
  check (kind in ('regular', 'bill_payment', 'saving', 'investment'));

-- 2) financial_profile: ซ่อนยอด + ยอดตั้งต้นเงินเก็บ/เงินลงทุน (เงินที่มีอยู่ก่อนเริ่มจดในแอป)
alter table public.financial_profile
  add column if not exists hide_savings boolean not null default false;

alter table public.financial_profile
  add column if not exists saving_start numeric not null default 0;
alter table public.financial_profile drop constraint if exists financial_profile_saving_start_check;
alter table public.financial_profile add constraint financial_profile_saving_start_check
  check (saving_start >= 0);

alter table public.financial_profile
  add column if not exists investment_start numeric not null default 0;
alter table public.financial_profile drop constraint if exists financial_profile_investment_start_check;
alter table public.financial_profile add constraint financial_profile_investment_start_check
  check (investment_start >= 0);

-- 3) RLS: ไม่ต้องสร้างตารางหรือ policy ใหม่
--    ไม่มีตารางใหม่ — คอลัมน์ใหม่อยู่ใต้ policy `auth.uid() = user_id`
--    ของ transactions และ financial_profile ที่เปิดอยู่แล้วโดยอัตโนมัติ
