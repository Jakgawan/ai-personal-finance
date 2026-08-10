# AI Personal Finance App ("Finance")

แอปการเงินส่วนตัวภาษาไทย เป้าหมาย: ให้คนใช้ได้จริงต่อเนื่อง ไม่ใช่ลองแล้วเลิก

## Stack
Next.js (App Router), TypeScript, Tailwind CSS v4, Supabase (auth + database), Vercel (deploy), Gemini API (AI features)

## กฎการทำงาน (สำคัญมาก — ทำตามทุกครั้งไม่มีข้อยกเว้น)

- อธิบายไฟล์ที่จะแก้ก่อนเริ่มแก้จริงทุกครั้ง (บอกว่าแก้ไฟล์ไหน บรรทัดไหน ทำไม)
- อธิบายโค้ดทีละบรรทัดเสมอ เพราะผู้ใช้กำลังเรียนรู้ ไม่ใช่โปรแกรมเมอร์ที่เข้าใจโค้ดอยู่แล้ว — ห้าม copy-paste โดยไม่อธิบาย
- ทดสอบให้ผ่าน (`npm run build` + ทดสอบจริงในเบราว์เซอร์) ก่อน commit ทุกครั้ง
- แยก commit เป็นงานย่อยๆ เสมอ ไม่รวมหลายงานเป็น commit ก้อนใหญ่
- ห้าม push ขึ้น origin โดยไม่รอ confirm จากผู้ใช้ก่อนทุกครั้ง
- ถ้าต้องรัน SQL ใน Supabase ให้บอก SQL statement ชัดเจนก่อน รอ confirm ว่ารันแล้วค่อยไปต่อ (ไม่รันเอง)
- ถ้าเจอบั๊ก/ปัญหาที่ไม่คาดคิด ให้หยุดอธิบายก่อน ห้ามแก้แบบเดาเอง
- ถ้าเจองานค้าง (uncommitted changes) จาก session ก่อนหน้า ให้แจ้งผู้ใช้ก่อนตัดสินใจว่าจะเก็บ/ทิ้ง ไม่ตัดสินใจเอง
- สื่อสารเป็นภาษาไทยเสมอ
- Git commit message เป็นภาษาอังกฤษ กระชับ ตรงประเด็น
- ก่อนทดสอบด้วยบัญชีในเบราว์เซอร์ ให้เช็คก่อนว่าเป็นบัญชีทดสอบ ไม่ใช่บัญชีจริงของผู้ใช้ (`toto15405@gmail.com` คือบัญชีจริง ห้ามใช้ทดสอบ — มีบัญชีทดสอบแยกต่างหาก)

## Design System

- สีหลัก: เขียว `#1D9E75` (primary/income), แดง `#D85A30` (expense/negative), น้ำเงิน `#378ADD` (info)
- ใช้ Lucide React icons เท่านั้น ห้ามใช้ emoji ในโค้ด/UI
- Design Token System: CSS custom properties ใน `globals.css` (ไม่ใช้ Tailwind `@theme` เพราะรองรับ breakpoint ไม่ดี) หน่วย font-size ใช้ `rem` (ไม่ใช่ `px`) เพื่อ accessibility, spacing ใช้ `px` ได้ปกติ
  - Desktop: heading 3rem / body 1rem / button 2.75rem / icon 1.5rem / gap-section 80-120px / card padding 24px
  - Mobile: heading 2.25rem / body 1rem / button 3rem / icon 1.375rem / gap-section 40-64px / card padding 16px
  - Track progress ใน `docs/design-tokens-checklist.md` — apply แล้วใน Settings (5 ไฟล์), เหลืออีก ~20 ไฟล์ ทยอย apply ตอนแก้ไฟล์นั้นอยู่แล้ว ไม่ไล่แก้ทุกไฟล์ทันที

## โครงสร้าง Mobile Navigation (สำคัญ อย่าออกแบบขัดกับนี้)

- Bottom nav bar **คงที่ 3 ปุ่มเสมอ**: `[ภาพรวม] [FAB] [รายการ]` ไม่มีเงื่อนไขเปลี่ยนจำนวนปุ่ม
- **FloatingMenuButton**: ปุ่ม pill เล็ก ชิดขอบขวาจอ (`right` คงที่) ลากได้แค่แนวตั้งเท่านั้น (ห้ามลากอิสระทั่วจอ เพื่อไม่ชนกับ AssistiveTouch ของ iOS) เปิด overlay กลางจอ (ไม่ใช่ popup มุมจอ)
- **MoreMenu overlay**: 2 ชั้น (root panel → "เพิ่มเติม"/"ตั้งค่า" sub-panel มีปุ่มย้อนกลับ ←) root panel เริ่มต้นเสมอทุกครั้งที่เปิดใหม่
- Toggle "แสดงปุ่มเมนูลอย" ใน Settings (คอลัมน์ `financial_profile.show_floating_menu`) — ถ้าปิด ไอคอนเมนูเล็กจะโผล่ที่มุมบนขวาของ top bar แทน (bottom bar ไม่เปลี่ยนจำนวนปุ่ม)
- หน้าที่เข้าถึงผ่าน MoreMenu (วางแผน/งบการเงิน/ธุรกิจ/คอร์ส/AI) มีปุ่ม back (←) ที่ header กลับไปหน้า Dashboard ตรงๆ (ไม่ต้องจำ panel ที่มา)
- Settings: **mobile = full-page ทีละหัวข้อ + back button**, **desktop = tab bar แนวนอนเดิม** — ต้องแยก breakpoint ให้ถูก (เคยมี regression ที่ desktop ดันกลายเป็น mobile layout มาแล้ว ระวังซ้ำ)

## Mode ผู้ใช้ (financial_profile.mode)

- `mode = 'simple' | 'full'` (CHECK constraint มีอยู่แล้วใน DB)
- simple → MoreMenu เหลือแค่ "ตั้งค่า" + "ออกจากระบบ"
- full → MoreMenu เห็นครบ: วางแผน/งบการเงิน/ปรึกษาการเงิน/คอร์สการเงิน/เพิ่มเติม/ตั้งค่า/ออกจากระบบ
- **ยังไม่มี UI ให้ user สลับ mode เอง** (ค้างใน backlog — ดูข้อ 7 ด้านล่าง)

## สถานะปัจจุบัน (ทำเสร็จแล้ว — อัปเดตทุกครั้งที่งานใหญ่เสร็จ)

- Auth (Login/Register/Forgot/Reset Password), Password regex validation, session persistence แก้บั๊กมือถือแล้ว
- Transaction: list/calendar view, export (Excel/PDF), OCR slip scan, FAB quick-add, หมวดหมู่เป็น optional (ไม่บังคับ)
- Planning: category dropdown, template, copy เดือน (หลายเดือน+ข้ามปี), reset เดือน+เลือกรายการ
- Balance Sheet: assets/liabilities (short/long term), financial_profile (income/expense/saving/occupation/mode/show_floating_menu), health indicators, saving rate จากค่าออมจริง, occupation-based emergency fund target (salaried 6-10mo, freelance 8-12mo)
- Dashboard: Financial Score (clamped 0-100), debt ratio จาก liabilities
- Business page (businesses, business_transactions tables)
- AI Chat (Gemini พร้อม financial context)
- Mobile navigation redesign เสร็จสมบูรณ์ (ดูหัวข้อด้านบน)
- ConfirmModal แทนที่ native `confirm()` ครบ 13 จุดทั่วแอป
- Toast component (`Toast.tsx`) ใช้ CustomEvent pattern, mount ที่ `app/layout.tsx`
- Design Token System (rem-based) — apply ใน Settings แล้ว
- 3a: Inline validation จำนวนเงิน (FAB modal, กัน 0/ติดลบ)
- 3b: Helper text ใต้ dropdown รอบเงินเดือน (FAB modal)
- 3c: Disabled button ผูก required field ครบ 8 จุด
- 3d: Combobox หมวดหมู่ (พิมพ์ค้นหาแทน `<select>` เต็มรายการ)
- Lucide icons แทน emoji ทุกหน้าแล้ว
- 1: Loading State + Empty State — skeleton ตอนโหลด Dashboard/Transaction list, empty state พร้อมคำแนะนำใน Dashboard/Balance Sheet/Business, loading indicator ตอน AI parse ข้อความ (QuickAddModal) และตอนสแกนสลิป OCR (ScanSlip)

## Backlog — เรียงลำดับที่วางแผนไว้ (ยังไม่เริ่ม เว้นแต่ระบุ)

1. ~~**Loading State + Empty State**~~ — เสร็จแล้ว ดูหัวข้อ "สถานะปัจจุบัน" ด้านบน
2. **Sticky Action Button** — ปุ่ม "บันทึก" ใน FAB Modal sticky อยู่ล่างสุดของ modal เสมอ
3. **UX Writing Guideline** — ทบทวนข้อความทั้งแอปให้เป็น active voice บอกผลลัพธ์ตรงๆ
4. **Onboarding + mode toggle ใน Settings** — เพิ่ม toggle สลับ mode (simple/full) ใน Settings + หน้า Onboarding ถามตอนสมัครครั้งแรก (ถ้าเคยเลือกแล้วไม่ถามซ้ำ)
5. **AI Chat แบบ Conversational Data Entry** — คุยประโยคยาวกับ AI Chat (เช่น "มีหนี้บัตรเครดิต 50000 รายได้เดือนละ 30000") ให้ AI แยกแยะไปกรอก `financial_profile`/`liabilities_long`/`assets` พร้อมขึ้นการ์ด preview ให้กดยืนยันก่อนบันทึกจริง (ไม่บันทึกอัตโนมัติ) เริ่ม scope เล็ก (2 table หลัก) ก่อนขยาย
6. **แจ้งเตือน recurring bills ผ่าน Web Push** — เพิ่ม tables `notification_settings`, `custom_reminders`, ตั้งเวลาแจ้งเตือนประจำวันได้เอง + custom reminder เอง, backend ใช้ Vercel Cron/Supabase Edge Function เช็คทุกชั่วโมง, กดแจ้งเตือนเปิดตรงไปที่ FAB บันทึกด่วนทันที
7. **ดึงยอดจริงจาก Transaction มาเทียบใน Planning** — match ตาม category+เดือน แสดงแผน vs จริง
8. **Google/Facebook Login** — เปิดผ่าน Supabase Dashboard > Authentication > Providers (built-in ไม่ต้องเขียนโค้ดเยอะ) — ต้องเช็ค Secure Email Change เปิดใช้งานจริงก่อนด้วย
9. **Export ข้อมูลเป็น JSON** — safety net ให้ผู้ใช้อุ่นใจเรื่องความเป็นเจ้าของข้อมูล
10. **Core loop redesign บน Dashboard** — ยอดคงเหลือใช้ได้จริงวันนี้ใหญ่สุดชัดสุดอยู่บนสุด, ปุ่มเพิ่มรายการใกล้ตัวเลขนี้ที่สุด, ปุ่มจำนวนเงินด่วน (50/100/200) กดแทนพิมพ์, AI insight แบบ scripted ผูกข้อมูลจริงเท่านั้น (ห้ามชมลอยๆ ไม่มีข้อมูลรองรับ)
11. **Error tracking (Sentry)** — ติดตั้งเพื่อจับบั๊กที่เกิดจริงบน production โดยอัตโนมัติ โดยเฉพาะบั๊กที่เกิดเฉพาะบางเครื่อง/เบราว์เซอร์ที่ทดสอบเองไม่เจอ (มีประวัติเจอบั๊กแบบนี้มาแล้วหลายครั้ง เช่น ปุ่มลอยพังเฉพาะมือถือ, session ไม่ sync บน Safari)

## Backlog ใหญ่ — โหมดธุรกิจแบบสลับได้ (ทำหลังทุกอย่างข้างบนเสร็จ)

**หลักการ:** ไม่แยกเป็นแอปใหม่ ใช้ core เดียวกัน (auth, database, UI shell) — เพิ่ม toggle สลับ "ส่วนบุคคล/ธุรกิจ" อยู่บนสุดของ MoreMenu root panel (สลับได้ในบัญชีเดียว ไม่ใช่เลือกครั้งเดียวจบ) เมนู "ธุรกิจ" แบบเดิมที่เคยอยู่ใน MoreMenu list ตัดออกแล้ว (ซ้ำกับ toggle นี้)

**โครงสร้าง mode 3 ชั้น:**
```
ผู้ใช้เลือก: ส่วนบุคคล | ธุรกิจ (toggle บนสุดของ MoreMenu)
  └─ ถ้าเลือกส่วนบุคคล → ยังมี mode ย่อย simple | full เหมือนเดิม
  └─ ถ้าเลือกธุรกิจ → แสดง Dashboard/รายการของธุรกิจที่เลือกอยู่
```

**ทางเทคนิค:** ไม่ต้องสร้างตารางใหม่ทั้งหมด ใช้ตาราง `businesses`/`business_transactions` ที่มีอยู่แล้วเป็นฐาน

**เป้าหมายกลุ่มผู้ใช้:** คนขายเสริม/แม่ค้าออนไลน์รายเล็ก ไม่ใช่ร้านอาหารเต็มระบบ — **ห้ามแข่งกับ POS ที่ตลาดอิ่มตัวแล้ว** (FoodStory, Wongnai POS, POSPOS, FlowAccount, PEAK)

**Must-have เวอร์ชันแรก:**
1. บันทึกรายรับ-รายจ่ายธุรกิจแยกจากส่วนตัว (มีอยู่แล้ว)
2. กำไรขั้นต้นง่ายๆ ต่อวัน/สัปดาห์ — สูตร: ยอดขาย − ต้นทุนรวม = กำไร ตัวเลขเดียวชัดเจน ไม่ต้องมีงบดุล/งบกำไรขาดทุนเต็มรูป
3. รายการค้างจ่าย/ค้างรับ (ลูกหนี้-เจ้าหนี้แบบง่าย) — สำคัญมากสำหรับคนขาย LINE/Shopee ที่มีลูกค้าโอนทีหลัง หรือซื้อวัตถุดิบเชื่อไว้ก่อน — ต้องมี table ใหม่เก็บสถานะ ผูกกับ `business_transactions`

**Nice-to-have (ทำทีหลังถ้ามีคนขอจริง):** ต้นทุนต่อชิ้น/ออเดอร์แบบง่าย (กรอกแค่ "ต้นทุนรวมชุดนี้ ÷ จำนวนที่ทำได้"), สรุปแยกช่องทางขาย (หน้าร้าน/LINE/Shopee), ใบเสร็จอย่างง่ายให้กดสร้างส่งลูกค้า

**ไม่ทำเลย (นอก scope ถาวร ไม่ใช่แค่พักไว้):** คำนวณต้นทุนวัตถุดิบละเอียดแบบผูกสูตร+ตัดสต๊อกอัตโนมัติ, OCR สแกนใบเสร็จ/บิล, ใบกำกับภาษีเต็มรูปแบบตามกรมสรรพากร — เป็นพื้นที่ของผู้เล่นเฉพาะทางที่ลงทุนมาเป็นปี ไม่ควรแข่งด้วย

## Testing Strategy

- ยังไม่ใช้ automated test (unit/E2E) เพราะโครงสร้างแอปยังเปลี่ยนบ่อย — พึ่งการทดสอบมือ (Claude Code ทดสอบผ่าน browser tool + ผู้ใช้ทดสอบเองบนมือถือก่อน confirm push) เพียงพอสำหรับตอนนี้
- ควรเริ่มเขียน automated test เมื่อ core loop นิ่งแล้วและมี user จริงใช้งาน โฟกัสฟีเจอร์ที่ "ห้ามพังเด็ดขาด" ก่อน (บันทึกรายการ, คำนวณยอดเงิน)
- Error tracking (Sentry) อยู่ใน backlog ข้อ 11 ด้านบน — ควรทำก่อน automated test เพราะ setup เร็วกว่าและช่วยจับบั๊กจริงบน production ได้ทันที

## Key Learnings (บทเรียนสำคัญที่ห้ามพลาดซ้ำ)

- `alert()`/`confirm()` ของเบราว์เซอร์ **ไม่ทำงานแน่นอนบน PWA/มือถือบางเครื่อง** ต้องใช้ custom Modal/Toast component เสมอ ห้ามใช้ native dialog
- Touch event บน React ต้องผูกผ่าน `addEventListener(..., { passive: false })` ด้วย `ref`+`useEffect` ไม่ใช่ JSX prop ธรรมดา ถ้าต้องการ `preventDefault()` ทำงานจริง (React 17+ ผูก touch listener แบบ passive by default)
- Mobile session sync ช้ากว่า desktop — ต้อง retry/verify การเช็ค auth ไม่เชื่อผลลัพธ์ครั้งแรกทันที
- ตรวจ syntax ให้ครบก่อนส่งโค้ดเสมอ (ปิด `</div>` ครบ, ไม่มี `useEffect` ซ้ำ, มี TypeScript type annotation ชัดเจน)
- แยก breakpoint mobile/desktop ให้ชัดเจนทุกครั้งที่ redesign — เคยมี regression ที่ mobile-only design หลุดไปกระทบ desktop มาแล้ว
- Tailwind v4 ไม่เหมาะกับ CSS variable ที่ต้องเปลี่ยนค่าตาม breakpoint (ใช้ `@theme` ไม่ได้ ต้องใช้ CSS custom properties + media query แทน)
