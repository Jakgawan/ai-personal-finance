-- =====================================================================
-- งาน C: จ่ายบิล/ชำระหนี้ — แยกประเภทรายการใน transactions
-- รันเองใน Supabase SQL Editor (ไฟล์นี้รันซ้ำได้ ไม่พัง ไม่ลบข้อมูล)
-- =====================================================================

-- 1) คอลัมน์ kind = ประเภทของรายการ
--    'regular'      = รายการปกติ (ค่าเริ่มต้น)
--    'bill_payment' = จ่ายบิล/ชำระหนี้ (เช่น จ่ายบิลบัตรเครดิต) หักจากยอดต้นวัน
--                     ไม่นับเป็น "วันนี้ใช้ไป"
--    แถวเดิมทั้งหมดได้ 'regular' อัตโนมัติจาก default (ไม่ต้อง update เอง)
alter table public.transactions
  add column if not exists kind text not null default 'regular';

-- 2) จำกัดค่าที่ใส่ได้ — เขียนแบบ drop แล้ว add ใหม่ เพื่อรันซ้ำได้
--    ฟีเจอร์หนี้ในอนาคต (เช่น 'borrow_in', 'lend_out') เพิ่มค่าได้โดยแก้ constraint นี้
--    และเพิ่มคอลัมน์ debt_id ผูกกับตารางหนี้ได้ภายหลัง
alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions add constraint transactions_kind_check
  check (kind in ('regular', 'bill_payment'));

-- 3) RLS: ไม่ต้องสร้าง policy ใหม่
--    ตาราง transactions เปิด RLS + policy `auth.uid() = user_id` อยู่แล้ว
--    คอลัมน์ใหม่อยู่ใต้ policy เดิมโดยอัตโนมัติ (policy ใช้กับทั้งแถว ไม่แยกตามคอลัมน์)
