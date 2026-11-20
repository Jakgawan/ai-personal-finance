// ฟังก์ชันล้วน (pure) สรุปรายรับ/รายจ่ายของ "รอบนี้" และสร้างข้อความบริบทการเงินให้ AI

import { isSavingKind } from "./savings"
import { kindLabel } from "./kind-label"

export type SummaryTx = {
  date: string
  type: string
  amount: number | string
  kind?: string | null
}

export type RecentTx = SummaryTx & { name: string }

// กติกาเดียวกับหน้าแรก: อยู่ในช่วงรอบ และไม่เกินวันนี้ — รายจ่ายนับรวมจ่ายบิลด้วย
// เก็บเงิน/ลงทุน (ฝากหรือถอน) ไม่นับทั้งรายรับและรายจ่าย
export function summarizePeriod(
  transactions: SummaryTx[],
  period: { start: string; end: string },
  today: string
): { income: number; expense: number } {
  let income = 0
  let expense = 0
  for (const t of transactions) {
    if (!(t.date >= period.start && t.date <= period.end && t.date <= today)) continue
    if (isSavingKind(t.kind)) continue
    if (t.type === "income") income += Number(t.amount)
    else if (t.type === "expense") expense += Number(t.amount)
  }
  return { income, expense }
}

// รายจ่ายรอบนี้แยกตามหมวด — กติกานับเดียวกับ summarizePeriod (รวมจ่ายบิล ไม่นับเก็บเงิน/ลงทุน)
export function summarizeExpenseByCategory(
  transactions: (SummaryTx & { category?: string | null })[],
  period: { start: string; end: string },
  today: string,
  limit = 10
): { category: string; amount: number }[] {
  const totals = new Map<string, number>()
  for (const t of transactions) {
    if (!(t.date >= period.start && t.date <= period.end && t.date <= today)) continue
    if (isSavingKind(t.kind)) continue
    if (t.type !== "expense") continue
    const name = (t.category ?? "").trim() || "ไม่ระบุหมวด"
    totals.set(name, (totals.get(name) ?? 0) + Number(t.amount))
  }
  return Array.from(totals, ([category, amount]) => ({ category, amount }))
    .sort((a, b) => (b.amount !== a.amount ? b.amount - a.amount : a.category < b.category ? -1 : a.category > b.category ? 1 : 0))
    .slice(0, limit)
}

// ป้ายท้ายบรรทัดรายการล่าสุด (ว่างถ้าเป็นรายการปกติ)
function kindSuffix(t: SummaryTx): string {
  const label = kindLabel(t.kind, t.type)
  return label ? ` (${label})` : ""
}

export function buildFinancialContext(input: {
  period: { start: string; end: string }
  income: number
  expense: number
  balanceNow: number | null
  daysLeftInclToday: number
  totalAssets: number
  totalLiabilities: number
  recent: RecentTx[]
  byCategory?: { category: string; amount: number }[]
}): string {
  const money = (n: number): string => `฿${n.toLocaleString()}`
  const recent = input.recent.slice(0, 20)
  const lines: string[] = [
    `รอบนี้ (วันที่ ${input.period.start} – ${input.period.end}) เหลืออีก ${input.daysLeftInclToday} วัน (รวมวันนี้)`,
    `รายรับรอบนี้: ${money(input.income)}`,
    `รายจ่ายรอบนี้ (รวมจ่ายบิล): ${money(input.expense)}`,
    input.balanceNow === null
      ? "เงินคงเหลือตอนนี้: ยังไม่ได้ตั้งยอดเงิน"
      : `เงินคงเหลือตอนนี้: ${money(input.balanceNow)}`,
    `สินทรัพย์รวม: ${money(input.totalAssets)}`,
    `หนี้สินรวม (ระยะสั้นและระยะยาว): ${money(input.totalLiabilities)}`,
    `ความมั่งคั่งสุทธิ: ${money(input.totalAssets - input.totalLiabilities)}`,
  ]
  if (input.byCategory) {
    lines.push("รายจ่ายรอบนี้แยกตามหมวด (มากไปน้อย, รวมจ่ายบิล):")
    if (input.byCategory.length === 0) {
      lines.push("- (ยังไม่มีรายจ่ายในรอบนี้)")
    } else {
      for (const c of input.byCategory) lines.push(`- ${c.category}: ${money(c.amount)}`)
    }
  }
  lines.push("รายการล่าสุด 20 รายการ:")
  if (recent.length === 0) {
    lines.push("(ยังไม่มีรายการ)")
  } else {
    for (const t of recent) {
      const sign = t.type === "income" ? "+" : "-"
      lines.push(`${t.date} ${t.name} ${sign}${money(Number(t.amount))}${kindSuffix(t)}`)
    }
  }
  return lines.join("\n")
}

// รายการล่าสุด: ไม่เอารายการวันอนาคต เรียงวันที่ใหม่สุดก่อน แล้วตาม created_at ใหม่สุดก่อน
export function pickRecent<T extends SummaryTx & { created_at?: string | null }>(
  transactions: T[],
  today: string,
  limit: number
): T[] {
  return transactions
    .filter(t => t.date <= today)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1
      const ca = a.created_at ?? ""
      const cb = b.created_at ?? ""
      return ca < cb ? 1 : ca > cb ? -1 : 0
    })
    .slice(0, limit)
}
