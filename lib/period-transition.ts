// ตัดสินว่าตอนขึ้นรอบใหม่ (งาน 5c) หน้าแรกต้องทำอะไร — pure function ไม่แตะ Supabase
// วันที่เป็น string 'YYYY-MM-DD' เทียบด้วย string ตรงๆ ได้
import type { Tx, Opening } from "./spendable"
import { addDays } from "./income-schedule"

export type CarryoverPref = "ask" | "carry" | "reset"
export type CarryAction = "ask" | "auto-carry" | "auto-reset" | "negative" | "zero"

export type PeriodTransition =
  | { kind: "none" }
  | { kind: "income-check"; payday: string }
  | { kind: "carry"; payday: string; leftover: number; prevStart: string; prevEnd: string; action: CarryAction }

function safeAmount(v: number | string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// ปัดค่าที่ใกล้ 0 (ไม่ถึง 0.5 บาท) ให้เป็น 0
function roundZero(x: number): number {
  return Math.abs(x) < 0.5 ? 0 : x
}

export function getPeriodTransition(input: {
  today: string
  prevIncomeDate: string | null // วันเงินเข้าล่าสุดที่ไม่เกินวันนี้ (P)
  prevPeriodStart: string | null // วันเงินเข้าก่อนหน้า P (ผู้เรียกคำนวณ) — ใช้เป็นต้นรอบก่อน
  opening: Opening | null
  transactions: Tx[]
  lastPeriodDecided: string | null
  incomePromptDismissed: string | null
  pref: CarryoverPref | null
}): PeriodTransition {
  const { prevIncomeDate: payday, opening } = input
  if (!payday || !opening) return { kind: "none" }
  // ผู้ใช้ตั้งยอด/เริ่มใช้ตั้งแต่วันเงินเข้าเป็นต้นมา -> ไม่มีรอบใหม่ให้จัดการ
  if (payday <= opening.opening_date) return { kind: "none" }
  if (input.lastPeriodDecided === payday) return { kind: "none" }

  // ขั้น 1: เงินเข้าแล้วหรือยัง (มีรายรับวันที่ >= payday แล้วหรือไม่)
  const hasIncome = input.transactions.some(
    (t) => t.type === "income" && t.date >= payday && t.date >= opening.opening_date && t.date <= input.today
  )
  if (!hasIncome && input.incomePromptDismissed !== payday) {
    return { kind: "income-check", payday }
  }

  // ขั้น 2: ยอดเหลือของรอบก่อน (opening_date ถึงวันก่อน payday)
  const prevEnd = addDays(payday, -1)
  let leftover = safeAmount(opening.amount)
  for (const t of input.transactions) {
    if (t.date < opening.opening_date || t.date > prevEnd) continue
    const amt = safeAmount(t.amount)
    if (t.type === "income") leftover += amt
    else if (t.type === "expense") leftover -= amt
  }
  leftover = roundZero(leftover)

  const prevStart =
    input.prevPeriodStart && input.prevPeriodStart > opening.opening_date ? input.prevPeriodStart : opening.opening_date

  let action: CarryAction
  if (leftover < 0) action = "negative"
  else if (leftover === 0) action = "zero"
  else if (input.pref === "carry") action = "auto-carry"
  else if (input.pref === "reset") action = "auto-reset"
  else action = "ask"

  return { kind: "carry", payday, leftover, prevStart, prevEnd, action }
}
