-- =====================================================================
-- ซองเงิน ขั้น 1: ตาราง envelopes + ยอดยกมารายรอบ + transactions.envelope_id
-- รันเองใน Supabase SQL Editor (ไฟล์นี้รันซ้ำได้ ไม่พัง ไม่ลบข้อมูล)
-- =====================================================================

-- 1) ซองเงิน: ชื่อ + ยอดที่กันไว้ต่อรอบ (เติมซ้ำอัตโนมัติทุกรอบ)
create table if not exists public.envelopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  amount numeric not null check (amount >= 0),       -- ยอดที่กันไว้ต่อรอบ
  carry_over boolean not null default false,         -- true = เงินเหลือยกไปรอบใหม่
  sort_order int not null default 0,
  archived_at timestamptz,                           -- ลบแบบซ่อน (null = ใช้งานอยู่)
  created_at timestamptz not null default now(),
  unique (id, user_id)                               -- ไว้ให้ foreign key แบบคู่อ้างอิง
);

create index if not exists envelopes_user_id_idx on public.envelopes (user_id);

alter table public.envelopes enable row level security;
drop policy if exists envelopes_own on public.envelopes;
create policy envelopes_own on public.envelopes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2) ยอดยกมาของซองแต่ละรอบ (ขั้น 4 จะเริ่มเขียน)
create table if not exists public.envelope_period_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  envelope_id uuid not null,
  period_start date not null,
  carry_in numeric not null default 0 check (carry_in >= 0),
  created_at timestamptz not null default now(),
  unique (envelope_id, period_start),
  constraint envelope_period_balances_envelope_fk
    foreign key (envelope_id, user_id)
    references public.envelopes (id, user_id) on delete cascade
);

alter table public.envelope_period_balances enable row level security;
drop policy if exists envelope_period_balances_own on public.envelope_period_balances;
create policy envelope_period_balances_own on public.envelope_period_balances
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3) transactions.envelope_id = รายการนี้จ่ายจากซองไหน (ว่างได้)
alter table public.transactions
  add column if not exists envelope_id uuid;

-- FK แบบคู่ (envelope_id, user_id): รายการชี้ได้เฉพาะซองของเจ้าของเดียวกัน
-- ไม่ระบุ ON DELETE (= NO ACTION): ซองใช้ซ่อนแทนลบจริง และไม่ล้าง user_id
-- ลบผู้ใช้ยังลบต่อเนื่องได้ทั้งสองตาราง (ตรวจตอนจบคำสั่ง)
alter table public.transactions drop constraint if exists transactions_envelope_fk;
alter table public.transactions add constraint transactions_envelope_fk
  foreign key (envelope_id, user_id)
  references public.envelopes (id, user_id);

-- รายการเป็นได้แค่ "จ่ายจากซอง" หรือ "จ่ายบิล" อย่างใดอย่างหนึ่ง
alter table public.transactions drop constraint if exists transactions_envelope_kind_check;
alter table public.transactions add constraint transactions_envelope_kind_check
  check (envelope_id is null or kind = 'regular');

create index if not exists transactions_envelope_id_idx
  on public.transactions (envelope_id) where envelope_id is not null;

-- RLS ของ transactions ใช้ policy เดิม (auth.uid() = user_id) ไม่ต้องเพิ่ม
