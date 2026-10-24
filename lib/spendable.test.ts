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
