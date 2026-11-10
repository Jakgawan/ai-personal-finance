import { describe, it, expect } from "vitest"
import { calcSpendable, getCurrentPeriod, toLegacyBudget } from "./spendable"

const inc = (date: string, amount: number | string) => ({ date, type: "income", amount })
const exp = (date: string, amount: number | string) => ({ date, type: "expense", amount })

describe("calcSpendable", () => {
  it("start today equals backfill", () => {
    // A: 5000 วันที่ 10-14 ถึง 10-20 = 6 วัน -> 5000/6
    const a = calcSpendable({
      today: "2026-10-14",
      opening: { amount: 5000, opening_date: "2026-10-14" },
      transactions: [],
      nextIncomeDate: "2026-10-20",
    })
    // B: ย้อนจด 7000 ที่ 10-09 หักรายจ่าย 2000 -> ต้นวันนี้ 5000 เท่ากัน
    const b = calcSpendable({
      today: "2026-10-14",
      opening: { amount: 7000, opening_date: "2026-10-09" },
      transactions: [exp("2026-10-09", 500), exp("2026-10-10", 500), exp("2026-10-11", 500), exp("2026-10-13", 500)],
      nextIncomeDate: "2026-10-20",
    })
    expect(a.todayBudget).toBeCloseTo(5000 / 6)
    expect(b.todayBudget).toBeCloseTo(a.todayBudget)
    expect(b.balanceNow).toBe(a.balanceNow)
    expect(a.state).toBe("ok")
  })

  it("salary before opening_date is not counted", () => {
    const r = calcSpendable({
      today: "2026-10-14",
      opening: { amount: 3000, opening_date: "2026-10-14" },
      transactions: [inc("2026-10-05", 20000)],
      nextIncomeDate: "2026-10-20",
    })
    expect(r.balanceNow).toBe(3000)
    expect(r.excludedBeforeOpening).toBe(1)
  })

  it("paydays 5 & 20: today 10-22, next 11-05 -> 14 days", () => {
    // 10-22 ถึง 11-04 = 14 วัน
    const r = calcSpendable({
      today: "2026-10-22",
      opening: { amount: 1400, opening_date: "2026-10-22" },
      transactions: [],
      nextIncomeDate: "2026-11-05",
    })
    expect(r.daysLeftInclToday).toBe(14)
    expect(r.todayBudget).toBeCloseTo(100)
  })

  it("payday today: income counted", () => {
    // 1000 + 15000 = 16000, ถึง 11-05 = 16 วัน -> 1000/วัน
    const r = calcSpendable({
      today: "2026-10-20",
      opening: { amount: 1000, opening_date: "2026-10-14" },
      transactions: [inc("2026-10-20", 15000)],
      nextIncomeDate: "2026-11-05",
    })
    expect(r.incomeToToday).toBe(15000)
    expect(r.startOfTodayBalance).toBe(16000)
    expect(r.daysLeftInclToday).toBe(16)
    expect(r.todayBudget).toBeCloseTo(1000)
  })

  it("over today", () => {
    // 1000 / 10 วัน = 100; ใช้ 300 -> เหลือ -200
    const r = calcSpendable({
      today: "2026-10-14",
      opening: { amount: 1000, opening_date: "2026-10-14" },
      transactions: [exp("2026-10-14", 300)],
      nextIncomeDate: "2026-10-24",
    })
    expect(r.todayBudget).toBeCloseTo(100)
    expect(r.availableToday).toBeCloseTo(-200)
    expect(r.state).toBe("over")
    expect(r.overBy).toBeCloseTo(200)
    expect(r.tomorrowBudget).toBeCloseTo(700 / 9)
  })

  it("negative", () => {
    // 500 − 800 = −300
    const r = calcSpendable({
      today: "2026-10-14",
      opening: { amount: 500, opening_date: "2026-10-10" },
      transactions: [exp("2026-10-11", 800)],
      nextIncomeDate: "2026-10-20",
    })
    expect(r.state).toBe("negative")
    expect(r.overBy).toBe(300)
    // รวมรายจ่ายวันนี้ 50 -> ติดลบ 350
    const r2 = calcSpendable({
      today: "2026-10-14",
      opening: { amount: 500, opening_date: "2026-10-10" },
      transactions: [exp("2026-10-11", 800), exp("2026-10-14", 50)],
      nextIncomeDate: "2026-10-20",
    })
    expect(r2.overBy).toBe(350)
  })

  it("today's spending pushing total below zero -> negative", () => {
    // ต้นวัน 100 ใช้ 500 -> ยอดรวม −400
    const r = calcSpendable({
      today: "2026-10-14",
      opening: { amount: 100, opening_date: "2026-10-14" },
      transactions: [exp("2026-10-14", 500)],
      nextIncomeDate: "2026-10-24",
    })
    expect(r.state).toBe("negative")
    expect(r.overBy).toBe(400)
  })

  it("adjust-modal invariant", () => {
    // opening 1800 + รายรับวันนี้ 500 − รายจ่ายวันนี้ 300 = 2000
    const r = calcSpendable({
      today: "2026-10-14",
      opening: { amount: 1800, opening_date: "2026-10-14" },
      transactions: [inc("2026-10-14", 500), exp("2026-10-14", 300)],
      nextIncomeDate: "2026-10-20",
    })
    expect(r.balanceNow).toBe(2000)
  })

  it("future-dated transaction ignored", () => {
    const r = calcSpendable({
      today: "2026-10-14",
      opening: { amount: 1000, opening_date: "2026-10-14" },
      transactions: [exp("2026-10-15", 400), inc("2026-10-16", 999)],
      nextIncomeDate: "2026-10-20",
    })
    expect(r.balanceNow).toBe(1000)
  })

  it("guard: nextIncomeDate == today -> 1 day, no divide by zero", () => {
    const r = calcSpendable({
      today: "2026-10-14",
      opening: { amount: 600, opening_date: "2026-10-14" },
      transactions: [],
      nextIncomeDate: "2026-10-14",
    })
    expect(r.daysLeftInclToday).toBe(1)
    expect(r.todayBudget).toBe(600)
    expect(r.tomorrowBudget).toBeNull()
  })

  it("rounding avoids -0 states", () => {
    // ต้นวัน 0.3 -> ปัดเป็น 0 -> negative
    const a = calcSpendable({
      today: "2026-10-14",
      opening: { amount: 0.3, opening_date: "2026-10-14" },
      transactions: [],
      nextIncomeDate: "2026-10-20",
    })
    expect(a.state).toBe("negative")
    // 100/10 = 10 ใช้ 10.3 -> เหลือ −0.3 ปัดเป็น 0 -> ok
    const b = calcSpendable({
      today: "2026-10-14",
      opening: { amount: 100, opening_date: "2026-10-14" },
      transactions: [exp("2026-10-14", 10.3)],
      nextIncomeDate: "2026-10-24",
    })
    expect(b.availableToday).toBeCloseTo(-0.3)
    expect(b.state).toBe("ok")
  })

  it("non-numeric amount counts as 0", () => {
    const r = calcSpendable({
      today: "2026-10-14",
      opening: { amount: 100, opening_date: "2026-10-14" },
      transactions: [exp("2026-10-14", "abc")],
      nextIncomeDate: "2026-10-20",
    })
    expect(r.todayExpense).toBe(0)
  })
})

const bill = (date: string, amount: number) => ({ date, type: "expense", amount, kind: "bill_payment" })
const base = {
  today: "2026-10-10",
  opening: { amount: 6000, opening_date: "2026-10-10" },
  nextIncomeDate: "2026-10-20",
}

describe("calcSpendable bill_payment", () => {
  it("bill today deducts from start-of-day, not counted as today spend", () => {
    const r = calcSpendable({ ...base, transactions: [bill("2026-10-10", 3751)] })
    expect(r.state).not.toBe("over")
    expect(r.state).toBe("ok")
    expect(r.todayExpense).toBe(0)
    expect(r.todayBillPayments).toBe(3751)
    expect(r.todayBudget).toBeCloseTo(224.9)
    expect(r.availableToday).toBeCloseTo(224.9)
    expect(r.balanceNow).toBe(2249)
    expect(r.tomorrowBudget).toBeCloseTo(2249 / 9)
  })

  it("bill + regular expense today", () => {
    const r = calcSpendable({ ...base, transactions: [bill("2026-10-10", 3751), exp("2026-10-10", 300)] })
    expect(r.todayExpense).toBe(300)
    expect(r.availableToday).toBeCloseTo(r.todayBudget - 300)
    expect(r.balanceNow).toBe(6000 - 3751 - 300)
  })

  it("bill yesterday behaves like regular expense yesterday", () => {
    const o = { amount: 6000, opening_date: "2026-10-01" }
    const a = calcSpendable({ ...base, opening: o, transactions: [bill("2026-10-09", 1000)] })
    const b = calcSpendable({ ...base, opening: o, transactions: [exp("2026-10-09", 1000)] })
    expect(a).toEqual({ ...b, todayBillPayments: 0 })
    expect(a.todayBillPayments).toBe(0)
  })

  it("bill that exhausts balance -> negative", () => {
    const r = calcSpendable({ ...base, transactions: [bill("2026-10-10", 7000)] })
    expect(r.state).toBe("negative")
    expect(r.overBy).toBe(1000)
    expect(r.todayExpense).toBe(0)
  })

  it("missing / null / unknown kind counts as regular", () => {
    const r = calcSpendable({
      ...base,
      transactions: [
        exp("2026-10-10", 100),
        { date: "2026-10-10", type: "expense", amount: 100, kind: null },
        { date: "2026-10-10", type: "expense", amount: 100, kind: "regular" },
        { date: "2026-10-10", type: "expense", amount: 100, kind: "weird" },
      ],
    })
    expect(r.todayExpense).toBe(400)
    expect(r.todayBillPayments).toBe(0)
  })

  it("future / before-opening bill is ignored", () => {
    const r = calcSpendable({
      ...base,
      transactions: [bill("2026-10-11", 500), bill("2026-10-09", 500)],
    })
    expect(r.todayBillPayments).toBe(0)
    expect(r.balanceNow).toBe(6000)
    expect(r.excludedBeforeOpening).toBe(1)
  })
})

describe("getCurrentPeriod", () => {
  it("uses previous income date as start", () => {
    expect(getCurrentPeriod("2026-10-22", "2026-10-20", "2026-11-05", "2026-10-14")).toEqual({
      start: "2026-10-20",
      end: "2026-11-04",
      daysLeftInclToday: 14,
    })
  })
  it("no previous income -> first of month", () => {
    expect(getCurrentPeriod("2026-10-22", null, "2026-11-01", "2026-10-14")).toEqual({
      start: "2026-10-01",
      end: "2026-10-31",
      daysLeftInclToday: 10,
    })
  })
})

describe("toLegacyBudget", () => {
  it("maps negative state and fields", () => {
    const spend = calcSpendable({
      today: "2026-10-14",
      opening: { amount: 100, opening_date: "2026-10-14" },
      transactions: [exp("2026-10-14", 300)],
      nextIncomeDate: "2026-10-20",
    })
    const b = toLegacyBudget(spend, { start: "2026-10-05", end: "2026-10-19" }, { income: 0, expense: 300, balance: -300 })
    expect(b.state).toBe("cycle-negative")
    expect(b.cycleStart).toBe("2026-10-05")
    expect(b.cycleEnd).toBe("2026-10-19")
    expect(b.cycleExpense).toBe(300)
    expect(b.daysLeftInclToday).toBe(spend.daysLeftInclToday)
    expect(b.tomorrowBudget).toBe(spend.tomorrowBudget)
  })
})

describe("calcSpendable with envelopes", () => {
  const base = {
    today: "2026-10-14",
    opening: { amount: 6000, opening_date: "2026-10-01" },
    nextIncomeDate: "2026-10-20", // 6 วัน (14..19)
  }
  const envTx = (date: string, amount: number, envelope_id: string | null) => ({
    date,
    type: "expense",
    amount,
    envelope_id,
  })
  const env = { id: "e1", name: "ค่ากิน", amount: 1200 }
  const withEnv = { ...base, periodStart: "2026-10-05", envelopes: [env] }

  it("no envelopes: identical old fields and neutral new fields", () => {
    const txs = [inc("2026-10-02", 500), exp("2026-10-10", 200), exp("2026-10-14", 100)]
    const a = calcSpendable({ ...base, transactions: txs })
    const b = calcSpendable({ ...base, transactions: txs, envelopes: [], periodStart: "2026-10-05" })
    expect(b).toEqual(a)
    expect(a.spendableStartOfToday).toBe(a.startOfTodayBalance)
    expect(a.freeBalanceNow).toBe(a.balanceNow)
    expect(a.envelopeReserved).toBe(0)
    expect(a.todayEnvelopeSpend).toBe(0)
    expect(a.envelopes).toEqual([])
    expect(a.startOfTodayBalance).toBe(6000 + 500 - 200)
    expect(a.todayBudget).toBeCloseTo(6300 / 6)
    expect(a.availableToday).toBeCloseTo(6300 / 6 - 100)
  })

  it("untouched envelope reduces todayBudget, real balance unchanged", () => {
    const a = calcSpendable({ ...base, transactions: [] })
    const r = calcSpendable({ ...withEnv, transactions: [] })
    expect(r.envelopeReserved).toBe(1200)
    expect(r.todayBudget).toBeCloseTo(a.todayBudget - 1200 / 6)
    expect(r.startOfTodayBalance).toBe(a.startOfTodayBalance)
    expect(r.balanceNow).toBe(a.balanceNow)
    expect(r.freeBalanceNow).toBe(4800)
    expect(r.envelopes).toEqual([{ id: "e1", name: "ค่ากิน", allocation: 1200, spent: 0, remaining: 1200, overBy: 0 }])
  })

  it("spend within envelope today: todayExpense and availableToday unchanged", () => {
    const before = calcSpendable({ ...withEnv, transactions: [] })
    const r = calcSpendable({ ...withEnv, transactions: [envTx("2026-10-14", 300, "e1")] })
    expect(r.todayExpense).toBe(0)
    expect(r.todayEnvelopeSpend).toBe(300)
    expect(r.availableToday).toBeCloseTo(before.availableToday)
    expect(r.balanceNow).toBe(5700)
    expect(r.envelopeReserved).toBe(900)
    expect(r.freeBalanceNow).toBeCloseTo(before.freeBalanceNow)
  })

  it("overspend today: excess goes to todayExpense", () => {
    const before = calcSpendable({ ...withEnv, transactions: [] })
    const r = calcSpendable({ ...withEnv, transactions: [envTx("2026-10-14", 1500, "e1")] })
    expect(r.todayEnvelopeSpend).toBe(1200)
    expect(r.todayExpense).toBe(300)
    expect(r.envelopeReserved).toBe(0)
    expect(r.availableToday).toBeCloseTo(before.availableToday - 300)
    expect(r.envelopes[0].overBy).toBe(300)
    expect(r.envelopes[0].remaining).toBe(0)
  })

  it("overspend yesterday: excess lands in expenseBeforeToday", () => {
    const r = calcSpendable({ ...withEnv, transactions: [envTx("2026-10-13", 1500, "e1")] })
    expect(r.expenseBeforeToday).toBe(1500)
    expect(r.todayExpense).toBe(0)
    expect(r.envelopeReserved).toBe(0)
    // เงินต้นวัน 4500 ไม่มีซองเหลือให้กัน
    expect(r.spendableStartOfToday).toBe(4500)
    expect(r.todayBudget).toBeCloseTo(4500 / 6)
  })

  it("carryIn adds to allocation", () => {
    const r = calcSpendable({
      ...withEnv,
      envelopes: [{ ...env, carryIn: 300 }],
      transactions: [envTx("2026-10-13", 1400, "e1")],
    })
    expect(r.envelopes[0].allocation).toBe(1500)
    expect(r.envelopes[0].remaining).toBe(100)
    expect(r.envelopeReserved).toBe(100)
  })

  it("envelope tx before periodStart is regular", () => {
    const r = calcSpendable({ ...withEnv, transactions: [envTx("2026-10-03", 400, "e1")] })
    expect(r.envelopes[0].spent).toBe(0)
    expect(r.envelopeReserved).toBe(1200)
    expect(r.expenseBeforeToday).toBe(400)
  })

  it("envelope tx with unknown envelope_id is regular", () => {
    const r = calcSpendable({ ...withEnv, transactions: [envTx("2026-10-14", 400, "gone")] })
    expect(r.todayExpense).toBe(400)
    expect(r.todayEnvelopeSpend).toBe(0)
    expect(r.envelopeReserved).toBe(1200)
  })

  it("envelope tx before opening_date: money ignored, envelope consumed", () => {
    const r = calcSpendable({
      ...withEnv,
      opening: { amount: 6000, opening_date: "2026-10-10" },
      transactions: [envTx("2026-10-08", 400, "e1")],
    })
    expect(r.excludedBeforeOpening).toBe(1)
    // เงินจริงไม่หักซ้ำ แต่ซองถูกใช้ไปแล้ว (อยู่ในรอบ)
    expect(r.expenseBeforeToday).toBe(0)
    expect(r.envelopes[0].spent).toBe(400)
  })

  it("envelopes bigger than balance -> negative", () => {
    const r = calcSpendable({
      ...base,
      opening: { amount: 1000, opening_date: "2026-10-01" },
      periodStart: "2026-10-05",
      envelopes: [{ id: "e1", name: "ก", amount: 800 }, { id: "e2", name: "ข", amount: 700 }],
      transactions: [],
    })
    expect(r.state).toBe("negative")
    expect(r.overBy).toBe(500)
  })

  it("last day: tomorrowBudget null", () => {
    const r = calcSpendable({ ...withEnv, nextIncomeDate: "2026-10-15", transactions: [] })
    expect(r.daysLeftInclToday).toBe(1)
    expect(r.tomorrowBudget).toBeNull()
  })
})

describe("calcSpendable envelopes: edge cases", () => {
  const etx = (date: string, amount: number | string, id: string) => ({
    date,
    type: "expense",
    amount,
    envelope_id: id,
  })
  const base = {
    today: "2026-10-14",
    nextIncomeDate: "2026-10-20",
    periodStart: "2026-10-05",
  }

  it("mid-period balance reset keeps envelope consumption", () => {
    // ตั้งยอดใหม่ 10-12 (3000) แต่ 10-08 เคยจ่ายจากซอง 500 -> ซองเหลือ 700
    const r = calcSpendable({
      ...base,
      opening: { amount: 3000, opening_date: "2026-10-12" },
      envelopes: [{ id: "e1", name: "ก", amount: 1200 }],
      transactions: [etx("2026-10-08", 500, "e1")],
    })
    expect(r.excludedBeforeOpening).toBe(1)
    expect(r.expenseBeforeToday).toBe(0)
    expect(r.envelopes[0].spent).toBe(500)
    expect(r.envelopes[0].remaining).toBe(700)
    expect(r.envelopeReserved).toBe(700)
    expect(r.startOfTodayBalance).toBe(3000)
    expect(r.todayBudget).toBeCloseTo((3000 - 700) / 6)
  })

  it("pre-opening overspend only affects envelope status", () => {
    const r = calcSpendable({
      ...base,
      opening: { amount: 3000, opening_date: "2026-10-12" },
      envelopes: [{ id: "e1", name: "ก", amount: 1200 }],
      transactions: [etx("2026-10-08", 1500, "e1")],
    })
    expect(r.envelopes[0].overBy).toBe(300)
    expect(r.envelopeReserved).toBe(0)
    expect(r.expenseBeforeToday).toBe(0)
    expect(r.todayBudget).toBeCloseTo(3000 / 6)
  })

  it("unsorted input: yesterday within-envelope spend listed after today's overspend", () => {
    const r = calcSpendable({
      ...base,
      opening: { amount: 6000, opening_date: "2026-10-01" },
      envelopes: [{ id: "e1", name: "ก", amount: 1000 }],
      transactions: [etx("2026-10-14", 600, "e1"), etx("2026-10-13", 700, "e1")],
    })
    // เมื่อวาน 700 อยู่ในซอง เหลือ 300 -> วันนี้ 600 ในซอง 300 เกิน 300
    expect(r.todayEnvelopeSpend).toBe(300)
    expect(r.todayExpense).toBe(300)
    expect(r.expenseBeforeToday).toBe(700)
  })

  it("numeric strings for amount and carryIn", () => {
    const r = calcSpendable({
      ...base,
      opening: { amount: 6000, opening_date: "2026-10-01" },
      envelopes: [{ id: "e1", name: "ก", amount: "1000", carryIn: "200" }],
      transactions: [etx("2026-10-13", "300", "e1")],
    })
    expect(r.envelopes[0].allocation).toBe(1200)
    expect(r.envelopes[0].remaining).toBe(900)
  })

  it("two envelopes spent the same day", () => {
    const r = calcSpendable({
      ...base,
      opening: { amount: 6000, opening_date: "2026-10-01" },
      envelopes: [
        { id: "e1", name: "ก", amount: 500 },
        { id: "e2", name: "ข", amount: 400 },
      ],
      transactions: [etx("2026-10-14", 200, "e1"), etx("2026-10-14", 450, "e2")],
    })
    expect(r.todayEnvelopeSpend).toBe(200 + 400)
    expect(r.todayExpense).toBe(50)
    expect(r.envelopes.map((e) => e.remaining)).toEqual([300, 0])
    expect(r.envelopeReserved).toBe(300)
  })

  it("future-dated envelope spend is ignored", () => {
    const r = calcSpendable({
      ...base,
      opening: { amount: 6000, opening_date: "2026-10-01" },
      envelopes: [{ id: "e1", name: "ก", amount: 500 }],
      transactions: [etx("2026-10-16", 300, "e1")],
    })
    expect(r.envelopes[0].remaining).toBe(500)
    expect(r.expenseBeforeToday).toBe(0)
    expect(r.todayEnvelopeSpend).toBe(0)
  })

  it("envelopes without periodStart behave as no envelopes", () => {
    const r = calcSpendable({
      today: "2026-10-14",
      nextIncomeDate: "2026-10-20",
      opening: { amount: 6000, opening_date: "2026-10-01" },
      envelopes: [{ id: "e1", name: "ก", amount: 500 }],
      transactions: [etx("2026-10-14", 100, "e1")],
    })
    expect(r.envelopes).toEqual([])
    expect(r.envelopeReserved).toBe(0)
    expect(r.todayExpense).toBe(100)
  })
})

const sav = (date: string, amount: number, kind: "saving" | "investment" = "saving") => ({ date, type: "expense", amount, kind })
const wdr = (date: string, amount: number, kind: "saving" | "investment" = "saving") => ({ date, type: "income", amount, kind })

describe("calcSpendable saving / investment", () => {
  it("ไม่มีรายการเก็บเงิน -> ตัวเลขเท่ากับก่อนเพิ่มฟีเจอร์ (todaySavingDeposits = 0)", () => {
    const o = { amount: 6000, opening_date: "2026-10-01" }
    const txs: { date: string; type: string; amount: number | string; kind?: string | null }[] = [exp("2026-10-05", 400), inc("2026-10-06", 100), exp("2026-10-10", 120), bill("2026-10-10", 300)]
    const r = calcSpendable({ ...base, opening: o, transactions: txs })
    expect(r.todaySavingDeposits).toBe(0)
    expect(r.startOfTodayBalance).toBe(6000 + 100 - 400 - 300)
    expect(r.balanceNow).toBe(6000 + 100 - 400 - 300 - 120)
    expect(r.todayExpense).toBe(120)
    // กำกับ kind regular ให้ผลเท่ากับไม่กำกับ
    const same = calcSpendable({ ...base, opening: o, transactions: txs.map((t) => ({ ...t, kind: t.kind ?? "regular" })) })
    expect(same).toEqual(r)
  })

  it("ฝากวันนี้ -> ยอดลด แต่ไม่นับเป็นวันนี้ใช้ไป และแสดงใน todaySavingDeposits", () => {
    const r = calcSpendable({ ...base, transactions: [sav("2026-10-10", 1000), sav("2026-10-10", 500, "investment")] })
    expect(r.todaySavingDeposits).toBe(1500)
    expect(r.todayExpense).toBe(0)
    expect(r.todayBillPayments).toBe(0)
    expect(r.startOfTodayBalance).toBe(4500)
    expect(r.balanceNow).toBe(4500)
    expect(r.todayBudget).toBeCloseTo(450)
    expect(r.availableToday).toBeCloseTo(450)
    expect(r.state).toBe("ok")
  })

  it("ฝากวันนี้ให้ผลเท่าจ่ายบิลยอดเดียวกัน", () => {
    const a = calcSpendable({ ...base, transactions: [sav("2026-10-10", 1000)] })
    const b = calcSpendable({ ...base, transactions: [bill("2026-10-10", 1000)] })
    expect({ ...a, todaySavingDeposits: 0 }).toEqual({ ...b, todayBillPayments: 0 })
  })

  it("ฝากเมื่อวาน = หักเหมือนรายจ่ายเมื่อวาน ไม่เข้า todaySavingDeposits", () => {
    const o = { amount: 6000, opening_date: "2026-10-01" }
    const a = calcSpendable({ ...base, opening: o, transactions: [sav("2026-10-09", 1000)] })
    const b = calcSpendable({ ...base, opening: o, transactions: [exp("2026-10-09", 1000)] })
    expect(a).toEqual(b)
    expect(a.todaySavingDeposits).toBe(0)
  })

  it("ถอนเงินเก็บ/ลงทุน -> ยอดใช้ได้เพิ่มเหมือนรายรับ", () => {
    const r = calcSpendable({ ...base, transactions: [wdr("2026-10-10", 2000), wdr("2026-10-10", 1000, "investment")] })
    const asIncome = calcSpendable({ ...base, transactions: [inc("2026-10-10", 3000)] })
    expect(r.incomeToToday).toBe(3000)
    expect(r.balanceNow).toBe(9000)
    expect(r.todaySavingDeposits).toBe(0)
    expect(r).toEqual(asIncome)
  })

  it("ฝากเกินเงินที่มี -> ติดลบ แต่ todayExpense ยังเป็น 0", () => {
    const r = calcSpendable({ ...base, transactions: [sav("2026-10-10", 7000)] })
    expect(r.state).toBe("negative")
    expect(r.overBy).toBe(1000)
    expect(r.todayExpense).toBe(0)
  })

  it("ฝากในอนาคต/ก่อนวันตั้งยอดไม่นับ", () => {
    const r = calcSpendable({ ...base, transactions: [sav("2026-10-11", 500), sav("2026-10-09", 500)] })
    expect(r.todaySavingDeposits).toBe(0)
    expect(r.balanceNow).toBe(6000)
    expect(r.excludedBeforeOpening).toBe(1)
  })
})
