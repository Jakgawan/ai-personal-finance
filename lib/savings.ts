// เก็บเงิน/ลงทุน — pure functions ไม่แตะ Supabase
// รายการที่ kind = 'saving' | 'investment':
//   type = 'expense' -> ฝากเข้า (เงินออกจากยอดใช้ได้)
//   type = 'income'  -> ถอนคืน (เงินกลับเข้ายอดใช้ได้)
// ไม่นับเป็นรายรับ/รายจ่ายในสรุปต่างๆ (ดู summarizePeriod)

export type SavingsTx = {
  type: string
  amount: number | string
  kind?: string | null
}

// รายการนี้เป็นการเก็บเงิน/ลงทุน (ฝากหรือถอน) หรือไม่
export function isSavingKind(kind: string | null | undefined): boolean {
  return kind === "saving" || kind === "investment"
}

// ยอดเก็บเงิน/ลงทุนสะสม = ยอดตั้งต้น + ฝาก − ถอน (ทุกวันที่ ทุกรอบ)
// savingRaw/investmentRaw = ค่าจริงที่อาจติดลบ, saving/investment = ค่าแสดงผล (ไม่ต่ำกว่า 0)
export function computeSavingsTotals(
  transactions: SavingsTx[],
  opts: { savingStart: number; investmentStart: number }
): { saving: number; investment: number; savingRaw: number; investmentRaw: number } {
  const startOf = (v: number): number => (Number.isFinite(v) ? v : 0)
  let savingRaw = startOf(opts.savingStart)
  let investmentRaw = startOf(opts.investmentStart)
  for (const t of transactions) {
    if (!isSavingKind(t.kind)) continue
    const n = Number(t.amount)
    if (!Number.isFinite(n)) continue
    const signed = t.type === "expense" ? n : t.type === "income" ? -n : 0
    if (t.kind === "saving") savingRaw += signed
    else investmentRaw += signed
  }
  return {
    saving: Math.max(0, savingRaw),
    investment: Math.max(0, investmentRaw),
    savingRaw,
    investmentRaw,
  }
}

// ถอนเกินยอดที่มี? (ใช้เตือนก่อนบันทึก) — currentRaw คือค่า raw ปัจจุบัน
export function wouldOverdraw(currentRaw: number, withdrawAmount: number): boolean {
  if (!Number.isFinite(currentRaw) || !Number.isFinite(withdrawAmount)) return false
  return withdrawAmount > Math.max(0, currentRaw)
}
