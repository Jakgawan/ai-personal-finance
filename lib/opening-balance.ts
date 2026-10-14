// ฟังก์ชันล้วน (pure) เกี่ยวกับยอดเงินตั้งต้น — ไม่แตะ Supabase

// แปลงข้อความที่ผู้ใช้พิมพ์เป็นตัวเลข: ตัด , และช่องว่าง; ไม่ใช่ตัวเลข -> null
export function parseMoneyInput(s: string): number | null {
  const clean = s.replace(/[,\s]/g, "")
  if (clean === "") return null
  const n = Number(clean)
  return Number.isFinite(n) ? n : null
}

// แถว opening_balances คือ "ยอดตอนต้นวันนี้"
// แต่รายการของวันนี้ที่จดไปแล้ว สูตรงาน 5 จะบวกเพิ่มเข้าไปอีกครั้ง
// จึงต้องชดเชยกลับ เพื่อให้ยอดที่คำนวณได้ = ตัวเลขที่ผู้ใช้พิมพ์
// ค่าติดลบเป็นค่าที่ถูกต้อง (เช่น เงินเดือนเข้าวันนี้เยอะกว่ายอดคงเหลือ)
export function openingAmountForNow(
  currentBalance: number,
  todayIncome: number,
  todayExpense: number
): number {
  return currentBalance + todayExpense - todayIncome
}

// ยอดที่ใช้งานอยู่ = แถวที่ created_at ล่าสุด
export function pickActiveOpening<T extends { created_at: string }>(rows: T[]): T | null {
  let best: T | null = null
  for (const r of rows) {
    if (best === null || new Date(r.created_at).getTime() > new Date(best.created_at).getTime()) best = r
  }
  return best
}
