// สูตรใหม่ "ยอดใช้ได้ / วันนี้ใช้ได้อีกเท่าไหร่" (งาน 5) — pure functions ไม่แตะ Supabase
// ไม่เรียก Date.now เอง: "วันนี้" ต้องส่งเข้ามาเป็นพารามิเตอร์ (ดู todayInBangkok ใน income-schedule.ts)
// วันที่เป็น string 'YYYY-MM-DD' เทียบด้วย string ตรงๆ ได้

import { addDays } from "./income-schedule"
import type { DailyBudget } from "./daily-budget"

// รายการเงินเข้า-ออก (type เป็น "income" หรือ "expense")
// kind: "bill_payment" = จ่ายบิล/ชำระหนี้ (ไม่ส่ง/null/ค่าอื่น = รายการปกติ)
export type Tx = { date: string; type: string; amount: number | string; kind?: string | null }
// ยอดตั้งต้นที่ผู้ใช้ตั้งไว้ + วันที่ตั้ง (ยอดนี้คือยอด "ต้นวัน" ของ opening_date)
export type Opening = { amount: number; opening_date: string }

export type SpendableState = "ok" | "over" | "negative"

export type Spendable = {
  state: SpendableState
  // ใช้เกินไปเท่าไหร่ (0 ถ้า state = ok) — ความหมายขึ้นกับ state: negative = ยอดคงเหลือติดลบ, over = ใช้เกินส่วนของวันนี้
  overBy: number
  incomeToToday: number
  expenseBeforeToday: number // รายจ่ายก่อนวันนี้ + จ่ายบิลวันนี้ (หักจากยอดต้นวัน)
  todayExpense: number // รายจ่ายปกติของวันนี้ (ไม่รวมจ่ายบิล)
  todayBillPayments: number // ยอดจ่ายบิล/ชำระหนี้วันนี้ (UI ไว้แสดง — ถูกหักจากยอดต้นวันแล้ว ไม่นับเป็น "วันนี้ใช้ไป")
  startOfTodayBalance: number // ยอดต้นวันนี้ (ยังไม่หักรายจ่ายวันนี้)
  balanceNow: number // ยอดตอนนี้ (หักรายจ่ายวันนี้แล้ว)
  daysLeftInclToday: number
  todayBudget: number // งบของวันนี้ทั้งก้อน
  availableToday: number // วันนี้ใช้ได้อีก (งบวันนี้ − รายจ่ายวันนี้)
  tomorrowBudget: number | null // งบต่อวันของพรุ่งนี้เป็นต้นไป (null ถ้าวันนี้คือวันสุดท้ายก่อนเงินเข้า)
  excludedBeforeOpening: number // จำนวนรายการที่วันที่ก่อนวันตั้งยอด (ไม่นับ — UI ไว้บอกผู้ใช้)
  nextIncomeDate: string
}

// แปลงจำนวนเงินเป็นตัวเลขอย่างปลอดภัย (ค่าแปลก/NaN นับเป็น 0)
function safeAmount(v: number | string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// ปัดค่าที่ใกล้ 0 (ไม่ถึง 0.5 บาท) ให้เป็น 0 กันขึ้น "-฿0"
function roundZero(x: number): number {
  return Math.abs(x) < 0.5 ? 0 : x
}

// จำนวนวันจาก b ถึง a (a − b) คำนวณผ่าน Date.UTC กัน timezone ทำวันเลื่อน
export function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number)
  const [by, bm, bd] = b.split("-").map(Number)
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000)
}

export function calcSpendable(input: {
  today: string
  opening: Opening
  transactions: Tx[]
  nextIncomeDate: string
}): Spendable {
  const { today, opening, transactions, nextIncomeDate } = input

  let incomeToToday = 0
  let expenseBeforeToday = 0
  let todayExpense = 0
  let todayBillPayments = 0
  let excludedBeforeOpening = 0

  for (const t of transactions) {
    // ก่อนวันตั้งยอด: ยอดตั้งต้นรวมของพวกนี้ไว้แล้ว จึงไม่นับ (แต่นับจำนวนไว้บอกผู้ใช้)
    if (t.date < opening.opening_date) {
      excludedBeforeOpening++
      continue
    }
    // วันที่ในอนาคต: ยังไม่เกิดขึ้น ไม่นับ
    if (t.date > today) continue

    const amt = safeAmount(t.amount)
    if (t.type === "income") {
      // รวมรายรับของวันนี้ด้วย — เงินที่เข้าวันนี้ใช้ได้วันนี้
      incomeToToday += amt
    } else if (t.type === "expense") {
      if (t.date < today) {
        expenseBeforeToday += amt
      } else if (t.kind === "bill_payment") {
        // จ่ายบิลวันนี้: หักจากยอดต้นวัน (เหมือนจ่ายไปก่อนเริ่มวัน) ไม่นับเป็น "วันนี้ใช้ไป"
        expenseBeforeToday += amt
        todayBillPayments += amt
      } else {
        todayExpense += amt
      }
    }
  }

  // ยอดต้นวันนี้ = ยอดตั้งต้น + รายรับถึงวันนี้ − รายจ่ายก่อนวันนี้
  const startOfTodayBalance = safeAmount(opening.amount) + incomeToToday - expenseBeforeToday
  // ยอดตอนนี้ = ยอดต้นวัน − รายจ่ายวันนี้
  const balanceNow = startOfTodayBalance - todayExpense

  // จำนวนวันตั้งแต่วันนี้ ถึงวันก่อนเงินเข้า (นับวันนี้) อย่างน้อย 1 กันหารด้วยศูนย์
  const daysLeftInclToday = Math.max(1, dayDiff(nextIncomeDate, today))

  const todayBudget = startOfTodayBalance / daysLeftInclToday
  const availableToday = todayBudget - todayExpense
  const tomorrowBudget = daysLeftInclToday > 1 ? balanceNow / (daysLeftInclToday - 1) : null

  let state: SpendableState
  let overBy = 0
  if (roundZero(startOfTodayBalance) <= 0 || roundZero(balanceNow) < 0) {
    // เงินต้นวันนี้ไม่เหลือแล้ว หรือรายจ่ายวันนี้ทำให้ยอดรวมทั้งหมดติดลบ -> ติดลบ
    // (ผู้ใช้ควรเห็น "ใช้เกินไปแล้ว ฿ยอดรวม" ไม่ใช่แค่เกินส่วนของวันนี้)
    state = "negative"
    overBy = Math.max(0, -balanceNow)
  } else if (roundZero(availableToday) < 0) {
    // ยังมีเงิน แต่วันนี้ใช้เกินส่วนของวันนี้
    state = "over"
    overBy = -availableToday
  } else {
    state = "ok"
  }

  return {
    state,
    overBy,
    incomeToToday,
    expenseBeforeToday,
    todayExpense,
    todayBillPayments,
    startOfTodayBalance,
    balanceNow,
    daysLeftInclToday,
    todayBudget,
    availableToday,
    tomorrowBudget,
    excludedBeforeOpening,
    nextIncomeDate,
  }
}

// ช่วงของ "รอบนี้" ที่แสดงบนหน้าแรก
// end = วันก่อนเงินเข้าครั้งถัดไป
// start = วันเงินเข้าครั้งก่อน ถ้าไม่มี (ไม่ได้ตั้งรายได้ประจำ) ใช้วันแรกของเดือนปฏิทิน
// ไม่บีบ start ให้ไม่ก่อน openingDate — รอบคือปฏิทินวันเงินเข้า ไม่เกี่ยวกับวันที่ผู้ใช้ตั้งยอด
// (openingDate รับไว้ตามสัญญา เผื่อ UI ใช้ภายหลัง)
export function getCurrentPeriod(
  today: string,
  prevIncome: string | null,
  nextIncomeDate: string,
  openingDate: string
): { start: string; end: string; daysLeftInclToday: number } {
  void openingDate
  const start = prevIncome ?? `${today.slice(0, 7)}-01`
  return {
    start,
    end: addDays(nextIncomeDate, -1),
    daysLeftInclToday: Math.max(1, dayDiff(nextIncomeDate, today)),
  }
}

// แปลงผลสูตรใหม่ให้เป็นรูปแบบ DailyBudget เดิม เพื่อใช้กับ pickInsight (ไม่ต้องแก้ฟังก์ชันนั้น)
export function toLegacyBudget(
  spend: Spendable,
  period: { start: string; end: string },
  cycle: { income: number; expense: number; balance: number }
): DailyBudget {
  const state = spend.state === "negative" ? "cycle-negative" : spend.state
  return {
    cycleStart: period.start,
    cycleEnd: period.end,
    daysLeftInclToday: spend.daysLeftInclToday,
    cycleIncome: cycle.income,
    cycleExpense: cycle.expense,
    cycleBalance: cycle.balance,
    todayExpense: spend.todayExpense,
    expenseBeforeToday: spend.expenseBeforeToday,
    startOfTodayBalance: spend.startOfTodayBalance,
    todayBudget: spend.todayBudget,
    availableToday: spend.availableToday,
    state,
    tomorrowBudget: spend.tomorrowBudget,
  }
}
