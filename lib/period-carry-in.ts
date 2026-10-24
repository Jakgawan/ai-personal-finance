// "ยกมา" = เงินตอนเริ่มรอบนี้ ก่อนรายรับของรอบนี้ — pure function ไม่แตะ Supabase
// วันที่เป็น string 'YYYY-MM-DD' เทียบ string ตรงๆ ได้

export type CarryInTx = { date: string; type: string; amount: number | string }
export type CarryInOpening = { amount: number; entered_amount?: number | null; opening_date: string }

function safeAmount(v: number | string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function calcCarryIn(
  opening: CarryInOpening,
  transactions: CarryInTx[],
  periodStart: string
): number {
  // ตั้งยอดในรอบนี้ (หรือหลังเริ่มรอบ) -> ใช้ยอดที่ตั้งเลย
  if (opening.opening_date >= periodStart) {
    const entered = opening.entered_amount
    return entered !== null && entered !== undefined && Number.isFinite(Number(entered)) ? Number(entered) : safeAmount(opening.amount)
  }
  // ตั้งยอดไว้ก่อนรอบนี้ -> ยอดตั้งต้น + รายรับ − รายจ่าย ตั้งแต่วันตั้งยอดถึงวันก่อนเริ่มรอบ
  let sum = safeAmount(opening.amount)
  for (const t of transactions) {
    if (t.date < opening.opening_date || t.date >= periodStart) continue
    if (t.type === "income") sum += safeAmount(t.amount)
    else if (t.type === "expense") sum -= safeAmount(t.amount)
  }
  return sum
}
