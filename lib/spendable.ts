// สูตรใหม่ "ยอดใช้ได้ / วันนี้ใช้ได้อีกเท่าไหร่" (งาน 5) — pure functions ไม่แตะ Supabase
// ไม่เรียก Date.now เอง: "วันนี้" ต้องส่งเข้ามาเป็นพารามิเตอร์ (ดู todayInBangkok ใน income-schedule.ts)
// วันที่เป็น string 'YYYY-MM-DD' เทียบด้วย string ตรงๆ ได้

import { addDays } from "./income-schedule"
import type { DailyBudget } from "./daily-budget"
import { isSavingKind } from "./savings"

// รายการเงินเข้า-ออก (type เป็น "income" หรือ "expense")
// kind: "bill_payment" = จ่ายบิล/ชำระหนี้ (ไม่ส่ง/null/ค่าอื่น = รายการปกติ)
// kind: "saving" | "investment" = เก็บเงิน/ลงทุน (expense = ฝากเข้า หักจากยอดใช้ได้, income = ถอนคืน เพิ่มยอดใช้ได้)
// envelope_id: รายจ่ายนี้จ่ายจากซองไหน (ว่าง/ไม่ส่ง = ไม่ใช้ซอง)
export type Tx = {
  date: string
  type: string
  amount: number | string
  kind?: string | null
  envelope_id?: string | null
}
// ซองเงินที่ใช้งานอยู่ (ซองที่ลบแล้วไม่ต้องส่ง — รายการของมันจะนับเป็นรายจ่ายปกติ)
// amount = ยอดที่กันไว้ต่อรอบ, carryIn = เงินยกมาจากรอบก่อน (ถ้ามี)
// หมายเหตุ: ถ้าไม่ส่ง periodStart ซองทั้งหมดจะถูกมองเหมือนไม่มีซอง
export type EnvelopeInput = { id: string; name: string; amount: number | string; carryIn?: number | string }
export type EnvelopeStatus = {
  id: string
  name: string
  allocation: number // amount + carryIn
  spent: number // ใช้ไปแล้วในรอบ (รวมส่วนที่เกินซอง)
  remaining: number // max(0, allocation − spent)
  overBy: number // max(0, spent − allocation)
}
// ยอดตั้งต้นที่ผู้ใช้ตั้งไว้ + วันที่ตั้ง (ยอดนี้คือยอด "ต้นวัน" ของ opening_date)
export type Opening = { amount: number; opening_date: string }

export type SpendableState = "ok" | "over" | "negative"

export type Spendable = {
  state: SpendableState
  // ใช้เกินไปเท่าไหร่ (0 ถ้า state = ok) — ความหมายขึ้นกับ state: negative = ยอดคงเหลือติดลบ, over = ใช้เกินส่วนของวันนี้
  overBy: number
  incomeToToday: number
  expenseBeforeToday: number // รายจ่ายก่อนวันนี้ + จ่ายบิลวันนี้ (หักจากยอดต้นวัน)
  todayExpense: number // รายจ่ายปกติของวันนี้ (ไม่รวมจ่ายบิล และไม่รวมส่วนที่จ่ายจากซอง; ส่วนที่เกินซองนับรวม)
  todayBillPayments: number // ยอดจ่ายบิล/ชำระหนี้วันนี้ (UI ไว้แสดง — ถูกหักจากยอดต้นวันแล้ว ไม่นับเป็น "วันนี้ใช้ไป")
  todaySavingDeposits: number // ยอดฝากเก็บเงิน+ลงทุนวันนี้ (หักจากยอดต้นวันแล้ว ไม่นับเป็น "วันนี้ใช้ไป")
  startOfTodayBalance: number // ยอดต้นวันนี้ (ยังไม่หักรายจ่ายวันนี้)
  balanceNow: number // เงินจริงตอนนี้ (หักรายจ่ายวันนี้แล้ว รวมที่จ่ายจากซอง)
  todayEnvelopeSpend: number // วันนี้จ่ายจากซองไปเท่าไหร่ (เฉพาะส่วนที่อยู่ในยอดซอง)
  envelopeReserved: number // เงินที่ยังเหลืออยู่ในซองทุกใบตอนนี้ (กันไว้ ไม่นับเป็นเงินใช้ได้)
  spendableStartOfToday: number // เงินใช้ได้ต้นวัน = ยอดต้นวัน − เงินกันไว้ในซอง ณ ต้นวัน
  freeBalanceNow: number // เงินใช้ได้ตอนนี้ = เงินจริงตอนนี้ − เงินกันไว้ในซอง
  envelopes: EnvelopeStatus[] // สถานะซองแต่ละใบ เรียงตามที่ส่งเข้ามา
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
  envelopes?: EnvelopeInput[] // ซองที่ใช้งานอยู่ (ไม่ส่ง = ไม่มีซอง)
  periodStart?: string // วันเริ่มรอบนี้ (ต้องส่งถ้ามีซอง)
}): Spendable {
  const { today, opening, transactions, nextIncomeDate } = input
  const envList: EnvelopeInput[] = input.envelopes ?? []
  const hasEnvelopes = envList.length > 0 && !!input.periodStart
  // รายจ่ายจากซองนับตั้งแต่ต้นรอบ — รวมก่อนวันตั้งยอดด้วย (ใช้ลดยอดซอง แต่ไม่หักเงินจริงซ้ำ เพราะยอดตั้งต้นรวมไว้แล้ว)
  const envWindowStart = hasEnvelopes ? (input.periodStart as string) : ""
  const envIds = new Set<string>(hasEnvelopes ? envList.map((e) => e.id) : [])
  const envSpends: { index: number; id: string; date: string; amt: number; preOpening: boolean }[] = []

  let incomeToToday = 0
  let expenseBeforeToday = 0
  let todayExpense = 0
  let todayBillPayments = 0
  let todaySavingDeposits = 0
  let excludedBeforeOpening = 0

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i]
    // ก่อนวันตั้งยอด: ยอดตั้งต้นรวมของพวกนี้ไว้แล้ว จึงไม่นับ (แต่นับจำนวนไว้บอกผู้ใช้)
    if (t.date < opening.opening_date) {
      // ซองยังต้องเห็นรายการนี้ (ถ้าอยู่ในรอบ) แต่ไม่กระทบเงินจริง
      if (
        hasEnvelopes &&
        t.type === "expense" &&
        t.kind !== "bill_payment" &&
        t.envelope_id &&
        envIds.has(t.envelope_id) &&
        t.date >= envWindowStart
      ) {
        envSpends.push({ index: i, id: t.envelope_id, date: t.date, amt: safeAmount(t.amount), preOpening: true })
      }
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
      if (
        hasEnvelopes &&
        t.kind !== "bill_payment" &&
        t.envelope_id &&
        envIds.has(t.envelope_id) &&
        t.date >= envWindowStart
      ) {
        // จ่ายจากซอง: เก็บไว้แยกคำนวณทีหลัง (ต้องเรียงตามวันที่เพื่อรู้ว่าส่วนไหนเกินซอง)
        envSpends.push({ index: i, id: t.envelope_id, date: t.date, amt, preOpening: false })
      } else if (t.date < today) {
        expenseBeforeToday += amt
      } else if (t.kind === "bill_payment") {
        // จ่ายบิลวันนี้: หักจากยอดต้นวัน (เหมือนจ่ายไปก่อนเริ่มวัน) ไม่นับเป็น "วันนี้ใช้ไป"
        expenseBeforeToday += amt
        todayBillPayments += amt
      } else if (isSavingKind(t.kind)) {
        // ฝากเก็บเงิน/ลงทุนวันนี้: หักจากยอดต้นวันเหมือนจ่ายบิล ไม่นับเป็น "วันนี้ใช้ไป"
        expenseBeforeToday += amt
        todaySavingDeposits += amt
      } else {
        todayExpense += amt
      }
    }
    // หมายเหตุ: ถอนเงินเก็บ/ลงทุน (type income) ตกที่ incomeToToday ด้านบน = เงินกลับเข้ายอดใช้ได้
  }

  // ---- ซองเงิน: แยกส่วนที่อยู่ในยอดซอง กับส่วนที่เกินซอง ----
  let todayEnvelopeSpend = 0
  const spentByEnv = new Map<string, number>()
  const leftByEnv = new Map<string, number>() // ยอดซองที่ยังไม่ถูกใช้ระหว่างไล่ตามวันที่
  for (const e of envList) leftByEnv.set(e.id, safeAmount(e.amount) + safeAmount(e.carryIn ?? 0))
  envSpends.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.index - b.index))
  for (const sp of envSpends) {
    spentByEnv.set(sp.id, (spentByEnv.get(sp.id) ?? 0) + sp.amt)
    const left = leftByEnv.get(sp.id) ?? 0
    const within = Math.min(sp.amt, left)
    const excess = sp.amt - within
    leftByEnv.set(sp.id, left - within)
    if (sp.preOpening) {
      // ก่อนวันตั้งยอด: ยอดตั้งต้นหักไว้แล้ว ไม่แตะเงินจริง
    } else if (sp.date < today) {
      // ก่อนวันนี้: เงินจริงออกไปทั้งก้อน (ในซอง + เกินซอง)
      expenseBeforeToday += sp.amt
    } else {
      // วันนี้: ส่วนในซองไม่นับ "วันนี้ใช้ไป", ส่วนเกินนับเต็ม
      todayEnvelopeSpend += within
      todayExpense += excess
    }
  }
  const envelopeStatuses: EnvelopeStatus[] = hasEnvelopes
    ? envList.map((e) => {
        const allocation = safeAmount(e.amount) + safeAmount(e.carryIn ?? 0)
        const spent = spentByEnv.get(e.id) ?? 0
        return {
          id: e.id,
          name: e.name,
          allocation,
          spent,
          remaining: Math.max(0, allocation - spent),
          overBy: Math.max(0, spent - allocation),
        }
      })
    : []
  const envelopeReserved = envelopeStatuses.reduce((sum, e) => sum + e.remaining, 0)

  // ยอดต้นวันนี้ = ยอดตั้งต้น + รายรับถึงวันนี้ − รายจ่ายก่อนวันนี้
  const startOfTodayBalance = safeAmount(opening.amount) + incomeToToday - expenseBeforeToday
  // ยอดตอนนี้ = ยอดต้นวัน − รายจ่ายวันนี้
  const balanceNow = startOfTodayBalance - todayExpense - todayEnvelopeSpend

  // เงินใช้ได้ = เงินจริง − เงินที่กันไว้ในซอง (ต้นวัน = กันไว้ตอนนี้ + ที่จ่ายจากซองไปวันนี้)
  // TODO(ฟีเจอร์หนี้): ลบยอดที่หนี้กันไว้ตรงนี้ด้วย (ตอนนี้ = 0)
  const spendableStartOfToday = startOfTodayBalance - (envelopeReserved + todayEnvelopeSpend)
  const freeBalanceNow = balanceNow - envelopeReserved

  // จำนวนวันตั้งแต่วันนี้ ถึงวันก่อนเงินเข้า (นับวันนี้) อย่างน้อย 1 กันหารด้วยศูนย์
  const daysLeftInclToday = Math.max(1, dayDiff(nextIncomeDate, today))

  const todayBudget = spendableStartOfToday / daysLeftInclToday
  const availableToday = todayBudget - todayExpense
  const tomorrowBudget = daysLeftInclToday > 1 ? freeBalanceNow / (daysLeftInclToday - 1) : null

  let state: SpendableState
  let overBy = 0
  if (roundZero(spendableStartOfToday) <= 0 || roundZero(freeBalanceNow) < 0) {
    // เงินต้นวันนี้ไม่เหลือแล้ว หรือรายจ่ายวันนี้ทำให้ยอดรวมทั้งหมดติดลบ -> ติดลบ
    // (ผู้ใช้ควรเห็น "ใช้เกินไปแล้ว ฿ยอดรวม" ไม่ใช่แค่เกินส่วนของวันนี้)
    state = "negative"
    overBy = Math.max(0, -freeBalanceNow)
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
    todaySavingDeposits,
    startOfTodayBalance,
    balanceNow,
    todayEnvelopeSpend,
    envelopeReserved,
    spendableStartOfToday,
    freeBalanceNow,
    envelopes: envelopeStatuses,
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
    startOfTodayBalance: spend.spendableStartOfToday,
    todayBudget: spend.todayBudget,
    availableToday: spend.availableToday,
    state,
    tomorrowBudget: spend.tomorrowBudget,
  }
}
