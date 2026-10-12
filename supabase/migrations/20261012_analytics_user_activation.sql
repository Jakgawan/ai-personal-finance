-- =====================================================================
-- Analytics: view user_activation (เฟส 1.5 งาน 1 - วัดผลพื้นฐาน)
-- รันเองใน Supabase SQL Editor (ไฟล์นี้รันซ้ำได้ ไม่พัง)
-- =====================================================================

-- 1) สร้าง schema แยกชื่อ analytics (เก็บ view วิเคราะห์ แยกจากข้อมูลแอป)
create schema if not exists analytics;

-- ปิดสิทธิ์ทุกบทบาทที่ API ใช้ (public/anon/authenticated)
-- สำคัญ: ห้ามเพิ่ม "analytics" ใน Supabase > Settings > API > "Exposed schemas"
--        ไม่งั้นอีเมลผู้ใช้ทุกคนจะอ่านผ่าน API ได้
-- ผู้ใช้เปิดดูได้ผ่าน SQL Editor (ใช้บทบาท postgres) เท่านั้น
revoke all on schema analytics from public, anon, authenticated;

-- 2) view: 1 แถวต่อผู้ใช้ 1 คน (รวมคนที่ยังไม่เคยบันทึกรายการด้วย)
-- security_invoker = true: view ทำงานด้วยสิทธิ์ของผู้เรียก ไม่ใช่เจ้าของ view
-- ดังนั้นต่อให้มีใครเผลอให้สิทธิ์ view นี้ภายหลัง บทบาทที่ไม่มีสิทธิ์อ่าน auth.users ก็อ่านอีเมลไม่ได้
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
  coalesce(a.total_tx, 0)::int as total_tx
from auth.users u
left join agg a on a.user_id = u.id;  -- left join: ผู้ใช้ที่ไม่มีรายการก็ยังขึ้น

-- กัน view ใหม่ถูกเปิดสิทธิ์โดยอัตโนมัติ: ถอนสิทธิ์ทุกตารางใน schema นี้อีกรอบ
revoke all on all tables in schema analytics from public, anon, authenticated;

-- =====================================================================
-- ตัวอย่าง query (ปิดคอมเมนต์ไว้ ลบ -- ออกแล้วรันใน SQL Editor ทีละอัน)
-- =====================================================================

-- (ก) สรุปภาพรวม: ผู้ใช้ทั้งหมด / เคยจดอย่างน้อย 1 รายการ / จดรายการแรกภายใน 7 วัน / active
-- select
--   count(*)                                                        as total_users,
--   count(*) filter (where total_tx >= 1)                           as users_with_tx,
--   -- นับ 7 วันปฏิทินแบบเวลาไทย (signup_date ถึง +6) เหมือนที่ใช้กับ active_days_first_7
--   count(*) filter (where first_tx_at::date between signup_date and signup_date + 6) as first_tx_within_7d,
--   count(*) filter (where is_active)                               as active_users,
--   round(100.0 * count(*) filter (where is_active) / nullif(count(*), 0), 1) as active_pct
-- from analytics.user_activation;

-- (ข) ตรวจมือผู้ใช้ 1 คน: ดูรายการที่ไม่ใช่ recurring อัตโนมัติ พร้อมวันที่ (เวลาไทย)
--     แล้วนับจำนวนวันที่ไม่ซ้ำภายใน signup_date ถึง signup_date + 6 เทียบกับ active_days_first_7
-- select
--   t.id,
--   t.name,
--   t.amount,
--   t.created_at at time zone 'Asia/Bangkok'           as created_at_th,
--   (t.created_at at time zone 'Asia/Bangkok')::date   as created_date_th
-- from public.transactions t
-- join auth.users u on u.id = t.user_id
-- where u.email = 'ใส่อีเมลที่ต้องการตรวจ'
--   and t.note is distinct from 'สร้างอัตโนมัติจากรายการซ้ำ'
-- order by t.created_at;
--
-- select signup_date, active_days_first_7, is_active, total_tx
-- from analytics.user_activation
-- where email = 'ใส่อีเมลที่ต้องการตรวจ';
