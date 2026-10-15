import { describe, it, expect } from "vitest"
import {
  getNextIncomeDate,
  getPreviousIncomeDate,
  nextMonthlyDate,
  prevMonthlyDate,
  todayInBangkok,
} from "./income-schedule"

const src = (days: number[]) => ({ schedule_type: "monthly_days", monthly_days: days })

describe("nextMonthlyDate", () => {
  it("[25]", () => {
    expect(nextMonthlyDate([25], "2026-10-12")).toBe("2026-10-25")
    expect(nextMonthlyDate([25], "2026-10-25")).toBe("2026-11-25")
    expect(nextMonthlyDate([25], "2026-10-26")).toBe("2026-11-25")
  })
  it("[5,20]", () => {
    expect(nextMonthlyDate([5, 20], "2026-10-12")).toBe("2026-10-20")
    expect(nextMonthlyDate([5, 20], "2026-10-20")).toBe("2026-11-05")
    expect(nextMonthlyDate([5, 20], "2026-10-03")).toBe("2026-10-05")
  })
  it("[31] clamps to month length", () => {
    expect(nextMonthlyDate([31], "2026-02-10")).toBe("2026-02-28")
    expect(nextMonthlyDate([31], "2028-02-10")).toBe("2028-02-29")
    expect(nextMonthlyDate([31], "2026-04-10")).toBe("2026-04-30")
    expect(nextMonthlyDate([31], "2026-04-30")).toBe("2026-05-31")
  })
  it("[30] on Feb 28 clamps to today so goes to next month", () => {
    expect(nextMonthlyDate([30], "2026-02-28")).toBe("2026-03-30")
  })
  it("December rollover", () => {
    expect(nextMonthlyDate([5], "2026-12-20")).toBe("2027-01-05")
  })
  it("ignores invalid days", () => {
    expect(nextMonthlyDate([0, 32, 2.5, 10], "2026-10-12")).toBe(nextMonthlyDate([10], "2026-10-12"))
    expect(nextMonthlyDate([0, 32, 2.5], "2026-10-12")).toBeNull()
    expect(nextMonthlyDate([], "2026-10-12")).toBeNull()
  })
})

describe("getNextIncomeDate", () => {
  it("takes the earliest across multiple sources", () => {
    const r = getNextIncomeDate("2026-10-12", { incomeSources: [src([25]), src([10])] })
    expect(r).toEqual({ date: "2026-10-25", source: "income_sources" })
  })
  it("income_sources beats pay_cycles", () => {
    const r = getNextIncomeDate("2026-10-12", { incomeSources: [src([28])], payCycles: [{ start_day: 15 }] })
    expect(r).toEqual({ date: "2026-10-28", source: "income_sources" })
  })
  it("falls through when sources are all invalid", () => {
    const r = getNextIncomeDate("2026-10-12", { incomeSources: [src([0, 40])], payCycles: [{ start_day: 25 }] })
    expect(r).toEqual({ date: "2026-10-25", source: "pay_cycles" })
  })
  it("uses pay_cycles when no income sources", () => {
    expect(getNextIncomeDate("2026-10-12", { incomeSources: [], payCycles: [{ start_day: 25 }] })).toEqual({
      date: "2026-10-25",
      source: "pay_cycles",
    })
  })
  it("uses target_date when neither", () => {
    expect(getNextIncomeDate("2026-10-12", { targetDate: "2026-10-20" })).toEqual({
      date: "2026-10-20",
      source: "target_date",
    })
  })
  it("stale target_date falls to month_end", () => {
    expect(getNextIncomeDate("2026-10-12", { targetDate: "2026-10-12" }).source).toBe("month_end")
    expect(getNextIncomeDate("2026-10-12", { targetDate: "2026-10-01" }).source).toBe("month_end")
  })
  it("month_end", () => {
    expect(getNextIncomeDate("2026-10-12", {})).toEqual({ date: "2026-11-01", source: "month_end" })
    expect(getNextIncomeDate("2026-12-31", {})).toEqual({ date: "2027-01-01", source: "month_end" })
  })
})

describe("prevMonthlyDate", () => {
  it("[5,20] picks latest <= today", () => {
    expect(prevMonthlyDate([5, 20], "2026-10-22")).toBe("2026-10-20")
    expect(prevMonthlyDate([5, 20], "2026-10-20")).toBe("2026-10-20") // วันนี้เงินเข้า
    expect(prevMonthlyDate([5, 20], "2026-10-03")).toBe("2026-09-20")
  })
  it("[31] clamps to month length", () => {
    expect(prevMonthlyDate([31], "2026-03-10")).toBe("2026-02-28")
  })
  it("clamps [30]/[29] into February", () => {
    expect(prevMonthlyDate([30], "2026-03-01")).toBe("2026-02-28")
    expect(prevMonthlyDate([29], "2028-03-01")).toBe("2028-02-29")
  })
  it("year rollover", () => {
    expect(prevMonthlyDate([25], "2026-01-10")).toBe("2025-12-25")
  })
  it("no valid days -> null", () => {
    expect(prevMonthlyDate([], "2026-10-10")).toBeNull()
    expect(prevMonthlyDate([0, 32], "2026-10-10")).toBeNull()
  })
})

describe("getPreviousIncomeDate", () => {
  it("income_sources: max across sources", () => {
    expect(getPreviousIncomeDate("2026-10-22", { incomeSources: [src([5]), src([20])] })).toEqual({
      date: "2026-10-20",
      source: "income_sources",
    })
  })
  it("falls back to pay_cycles", () => {
    expect(getPreviousIncomeDate("2026-10-22", { incomeSources: [], payCycles: [{ start_day: 25 }] })).toEqual({
      date: "2026-09-25",
      source: "pay_cycles",
    })
  })
  it("none -> null", () => {
    expect(getPreviousIncomeDate("2026-10-22", {})).toBeNull()
  })
})

describe("todayInBangkok", () => {
  it("converts UTC to Bangkok date", () => {
    expect(todayInBangkok(new Date("2026-10-12T17:30:00Z"))).toBe("2026-10-13")
    expect(todayInBangkok(new Date("2026-10-12T16:59:00Z"))).toBe("2026-10-12")
  })
})
