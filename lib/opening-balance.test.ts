import { describe, it, expect } from "vitest"
import { parseMoneyInput, openingAmountForNow, pickActiveOpening } from "./opening-balance"

describe("parseMoneyInput", () => {
  it("strips commas and spaces", () => {
    expect(parseMoneyInput("1,234.50")).toBe(1234.5)
    expect(parseMoneyInput(" 5 000 ")).toBe(5000)
  })
  it("returns null for invalid or empty", () => {
    expect(parseMoneyInput("")).toBeNull()
    expect(parseMoneyInput("abc")).toBeNull()
    expect(parseMoneyInput("Infinity")).toBeNull()
  })
  it("keeps negatives and zero", () => {
    expect(parseMoneyInput("-5")).toBe(-5)
    expect(parseMoneyInput("0")).toBe(0)
  })
})

describe("openingAmountForNow", () => {
  it("no transactions today", () => {
    expect(openingAmountForNow(1000, 0, 0)).toBe(1000)
  })
  it("adds back today's expense", () => {
    expect(openingAmountForNow(1000, 0, 200)).toBe(1200)
  })
  it("subtracts today's income", () => {
    expect(openingAmountForNow(1000, 500, 200)).toBe(700)
  })
  it("can be negative (valid)", () => {
    expect(openingAmountForNow(0, 20000, 1000)).toBe(-19000)
  })
})

describe("pickActiveOpening", () => {
  it("returns null for empty", () => {
    expect(pickActiveOpening([])).toBeNull()
  })
  it("picks latest created_at", () => {
    const rows = [
      { id: "a", created_at: "2026-10-01T00:00:00Z" },
      { id: "c", created_at: "2026-10-03T00:00:00Z" },
      { id: "b", created_at: "2026-10-02T00:00:00Z" },
    ]
    expect(pickActiveOpening(rows)?.id).toBe("c")
  })
})
