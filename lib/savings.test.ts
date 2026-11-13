import { describe, it, expect } from "vitest"
import { computeSavingsTotals, wouldOverdraw, isSavingKind, netSavedInRange } from "./savings"

const dep = (kind: string, amount: number | string) => ({ type: "expense", amount, kind })
const wd = (kind: string, amount: number | string) => ({ type: "income", amount, kind })
const zero = { savingStart: 0, investmentStart: 0 }

describe("isSavingKind", () => {
  it("true เฉพาะ saving / investment", () => {
    expect(isSavingKind("saving")).toBe(true)
    expect(isSavingKind("investment")).toBe(true)
    expect(isSavingKind("regular")).toBe(false)
    expect(isSavingKind("bill_payment")).toBe(false)
    expect(isSavingKind(null)).toBe(false)
    expect(isSavingKind(undefined)).toBe(false)
  })
})

describe("computeSavingsTotals", () => {
  it("ไม่มีรายการ -> เท่ากับยอดตั้งต้น", () => {
    expect(computeSavingsTotals([], { savingStart: 500, investmentStart: 200 })).toEqual({
      saving: 500, investment: 200, savingRaw: 500, investmentRaw: 200,
    })
    expect(computeSavingsTotals([], zero)).toEqual({ saving: 0, investment: 0, savingRaw: 0, investmentRaw: 0 })
  })

  it("ฝากบวก ถอนลบ แยกเก็บเงินกับลงทุน", () => {
    const r = computeSavingsTotals(
      [dep("saving", 1000), dep("saving", 500), wd("saving", 300), dep("investment", 2000), wd("investment", 500)],
      { savingStart: 100, investmentStart: 50 }
    )
    expect(r).toEqual({ saving: 1300, investment: 1550, savingRaw: 1300, investmentRaw: 1550 })
  })

  it("ถอนเกินยอด -> ค่าแสดงเป็น 0 แต่ raw ติดลบ", () => {
    const r = computeSavingsTotals([dep("saving", 100), wd("saving", 250)], zero)
    expect(r.saving).toBe(0)
    expect(r.savingRaw).toBe(-150)
  })

  it("รายการปกติ/จ่ายบิลไม่นับ และจำนวนเงินแปลกถูกข้าม", () => {
    const r = computeSavingsTotals(
      [
        { type: "expense", amount: 999, kind: "regular" },
        { type: "expense", amount: 999, kind: "bill_payment" },
        { type: "expense", amount: 999, kind: null },
        dep("saving", "abc"),
        dep("saving", Infinity),
        dep("saving", "50.5"),
      ],
      zero
    )
    expect(r).toEqual({ saving: 50.5, investment: 0, savingRaw: 50.5, investmentRaw: 0 })
  })

  it("ยอดตั้งต้นที่ไม่ใช่ตัวเลข นับเป็น 0", () => {
    expect(computeSavingsTotals([], { savingStart: NaN, investmentStart: 10 }).savingRaw).toBe(0)
  })
})

describe("wouldOverdraw", () => {
  it("ถอนไม่เกินยอด -> false, เกิน -> true", () => {
    expect(wouldOverdraw(1000, 1000)).toBe(false)
    expect(wouldOverdraw(1000, 1000.01)).toBe(true)
    expect(wouldOverdraw(1000, 200)).toBe(false)
  })
  it("ยอด raw ติดลบ/0 -> ถอนอะไรก็เกิน", () => {
    expect(wouldOverdraw(-50, 1)).toBe(true)
    expect(wouldOverdraw(0, 1)).toBe(true)
    expect(wouldOverdraw(0, 0)).toBe(false)
  })
  it("ค่าแปลก -> false", () => {
    expect(wouldOverdraw(NaN, 10)).toBe(false)
    expect(wouldOverdraw(10, NaN)).toBe(false)
  })
})

describe("netSavedInRange", () => {
  const row = (type: string, kind: string | null, amount: number | string, date: string) => ({ type, kind, amount, date })
  it("ฝากบวก ถอนลบ รวม saving + investment", () => {
    const txs = [
      row("expense", "saving", 1000, "2026-11-02"),
      row("expense", "investment", 500, "2026-11-10"),
      row("income", "saving", 300, "2026-11-15"),
    ]
    expect(netSavedInRange(txs, "2026-11-01", "2026-11-30")).toBe(1200)
  })
  it("ถอนมากกว่าฝาก -> ติดลบ", () => {
    expect(netSavedInRange([row("income", "investment", 800, "2026-11-03")], "2026-11-01", "2026-11-30")).toBe(-800)
  })
  it("รวมวันต้น/วันท้าย และไม่นับนอกช่วง", () => {
    const txs = [
      row("expense", "saving", 100, "2026-11-01"),
      row("expense", "saving", 200, "2026-11-30"),
      row("expense", "saving", 400, "2026-10-31"),
      row("expense", "saving", 800, "2026-12-01"),
    ]
    expect(netSavedInRange(txs, "2026-11-01", "2026-11-30")).toBe(300)
  })
  it("ไม่นับรายการปกติ/จ่ายบิล และข้ามจำนวนที่ไม่ใช่ตัวเลข", () => {
    const txs = [
      row("expense", "regular", 999, "2026-11-05"),
      row("expense", null, 999, "2026-11-05"),
      row("expense", "bill_payment", 999, "2026-11-05"),
      row("expense", "saving", "abc", "2026-11-05"),
      row("expense", "saving", "50.5", "2026-11-05"),
    ]
    expect(netSavedInRange(txs, "2026-11-01", "2026-11-30")).toBe(50.5)
  })
  it("ไม่มีรายการ -> 0", () => {
    expect(netSavedInRange([], "2026-11-01", "2026-11-30")).toBe(0)
  })
})
