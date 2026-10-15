import { describe, it, expect } from "vitest"
import { getPeriodTransition } from "./period-transition"

const base = {
  today: "2026-10-20",
  prevIncomeDate: "2026-10-20",
  prevPeriodStart: "2026-10-05",
  opening: { amount: 1000, opening_date: "2026-10-05" },
  transactions: [
    { date: "2026-10-10", type: "expense", amount: 300 },
    { date: "2026-10-20", type: "income", amount: 15000 },
  ],
  lastPeriodDecided: null,
  incomePromptDismissed: null,
  pref: null,
}

describe("getPeriodTransition", () => {
  it("ไม่มีตารางรายได้ -> none", () => {
    expect(getPeriodTransition({ ...base, prevIncomeDate: null }).kind).toBe("none")
  })
  it("ไม่มียอดตั้งต้น -> none", () => {
    expect(getPeriodTransition({ ...base, opening: null }).kind).toBe("none")
  })
  it("ตั้งยอดหลัง/วันเดียวกับวันเงินเข้า -> none", () => {
    expect(getPeriodTransition({ ...base, opening: { amount: 0, opening_date: "2026-10-20" } }).kind).toBe("none")
    expect(getPeriodTransition({ ...base, opening: { amount: 0, opening_date: "2026-10-21" } }).kind).toBe("none")
  })
  it("ตัดสินใจไปแล้ว -> none", () => {
    expect(getPeriodTransition({ ...base, lastPeriodDecided: "2026-10-20" }).kind).toBe("none")
  })
  it("ยังไม่มีรายรับ -> income-check", () => {
    const r = getPeriodTransition({ ...base, transactions: [base.transactions[0]] })
    expect(r).toEqual({ kind: "income-check", payday: "2026-10-20" })
  })
  it("กด ยังไม่เข้า แล้ว -> carry", () => {
    const r = getPeriodTransition({ ...base, transactions: [base.transactions[0]], incomePromptDismissed: "2026-10-20" })
    expect(r.kind).toBe("carry")
  })
  it("กด ยังไม่เข้า ของ payday เก่า ไม่มีผล", () => {
    const r = getPeriodTransition({ ...base, transactions: [base.transactions[0]], incomePromptDismissed: "2026-09-20" })
    expect(r.kind).toBe("income-check")
  })
  it("เหลือเงิน + ถามทุกครั้ง -> ask", () => {
    expect(getPeriodTransition(base)).toEqual({
      kind: "carry", payday: "2026-10-20", leftover: 700, prevStart: "2026-10-05", prevEnd: "2026-10-19", action: "ask",
    })
  })
  it("pref carry/reset", () => {
    expect((getPeriodTransition({ ...base, pref: "carry" }) as { action: string }).action).toBe("auto-carry")
    expect((getPeriodTransition({ ...base, pref: "reset" }) as { action: string }).action).toBe("auto-reset")
    expect((getPeriodTransition({ ...base, pref: "ask" }) as { action: string }).action).toBe("ask")
  })
  it("ติดลบ -> negative (ไม่สนใจ pref)", () => {
    const r = getPeriodTransition({
      ...base,
      pref: "carry",
      transactions: [{ date: "2026-10-10", type: "expense", amount: 1850 }, base.transactions[1]],
    })
    expect(r).toMatchObject({ kind: "carry", leftover: -850, action: "negative" })
  })
  it("ศูนย์ (และใกล้ศูนย์) -> zero", () => {
    const r = getPeriodTransition({
      ...base,
      transactions: [{ date: "2026-10-10", type: "expense", amount: 1000 }, base.transactions[1]],
    })
    expect(r).toMatchObject({ leftover: 0, action: "zero" })
    const r2 = getPeriodTransition({
      ...base,
      transactions: [{ date: "2026-10-10", type: "expense", amount: 999.8 }, base.transactions[1]],
    })
    expect(r2).toMatchObject({ leftover: 0, action: "zero" })
  })
  it("ไม่นับรายการก่อนวันตั้งยอด และตั้งแต่วัน payday เป็นต้นไป", () => {
    const r = getPeriodTransition({
      ...base,
      transactions: [
        { date: "2026-10-04", type: "expense", amount: 500 },
        { date: "2026-10-19", type: "expense", amount: 100 },
        { date: "2026-10-20", type: "expense", amount: 400 },
        { date: "2026-10-20", type: "income", amount: 15000 },
      ],
    })
    expect(r).toMatchObject({ leftover: 900 })
  })
  it("prevStart ไม่ก่อนวันตั้งยอด / ไม่มี prevPeriodStart ใช้วันตั้งยอด", () => {
    expect(getPeriodTransition({ ...base, prevPeriodStart: "2026-09-20" })).toMatchObject({ prevStart: "2026-10-05" })
    expect(getPeriodTransition({ ...base, prevPeriodStart: null })).toMatchObject({ prevStart: "2026-10-05" })
  })
})
