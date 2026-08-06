# Design Token Rollout Checklist

Token ที่มีอยู่ (`app/globals.css`): `.text-heading-token`, `.text-body-token`, `.btn-height-token`, `.icon-token`, `.section-gap-token`, `.card-padding-token`

ค่า (mobile / desktop ≥768px):

| Token | Mobile | Desktop |
|---|---|---|
| heading | 36px | 48px |
| body | 16px | 16px |
| button height | 48px | 44px |
| icon | 22px | 24px |
| section gap | 48px | 96px |
| card padding | 16px | 24px |

อัปเดตไฟล์นี้ทุกครั้งที่ apply token เพิ่ม เพื่อไม่ให้ตกหล่น

## Settings (ทำแล้ว)

- [x] `app/settings/page.tsx` — เช็คแล้ว ไม่ apply (h1 เป็น nav bar title ขนาดเล็ก ไม่ใช่ content heading)
- [x] `app/settings/components/ProfileSection.tsx`
- [x] `app/settings/components/PayCyclesSection.tsx`
- [x] `app/settings/components/CategoriesSection.tsx`
- [x] `app/settings/components/RecurringSection.tsx`
- [x] `app/settings/components/DisplaySection.tsx`

## รอทำ (ตามลำดับ backlog — FAB modal เป็นลำดับถัดไป)

- [ ] `app/components/QuickAddModal.tsx` (FAB modal — ลำดับที่ 3)
- [ ] `app/page.tsx` (Dashboard)
- [ ] `app/transaction/page.tsx`
- [ ] `app/planning/page.tsx`
- [ ] `app/balance-sheet/page.tsx`
- [ ] `app/business/page.tsx`
- [ ] `app/ai/page.tsx`
- [ ] `app/courses/page.tsx`
- [ ] `app/login/page.tsx`
- [ ] `app/register/page.tsx`
- [ ] `app/forgot-password/page.tsx`
- [ ] `app/reset-password/page.tsx`
- [ ] `app/components/Sidebar.tsx`
- [ ] `app/components/BottomNav.tsx`
- [ ] `app/components/MoreMenu.tsx`
- [ ] `app/components/FloatingMenuButton.tsx`
- [ ] `app/components/ConfirmModal.tsx`
- [ ] `app/components/Navbar.tsx`
- [ ] `app/components/ExportPDF.tsx`
- [ ] `app/components/ScanSlip.tsx`
- [ ] `app/layout.tsx` (ไม่มี UI ของตัวเอง — ไม่น่าต้อง apply)
