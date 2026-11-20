import { describe, it, expect } from "vitest"
import { formatAmount, formatMoney } from "./daily-budget"

describe("formatAmount", () => {
  it("มีเศษ 2 ตำแหน่ง", () => {
    expect(formatAmount(15112.5)).toBe("15,112.50")
    expect(formatAmount(1234567.891)).toBe("1,234,567.89")
    expect(formatAmount(99.994)).toBe("99.99")
    expect(formatAmount(0.1 + 0.2)).toBe("0.30")
  })
  it("จำนวนเต็มไม่มีทศนิยม", () => {
    expect(formatAmount(60)).toBe("60")
    expect(formatAmount(99.999)).toBe("100")
  })
  it("ติดลบ/ศูนย์/ไม่ใช่ตัวเลข", () => {
    expect(formatAmount(-12.5)).toBe("-12.50")
    expect(formatAmount(-0.001)).toBe("0")
    expect(formatAmount(NaN)).toBe("0")
  })
})

describe("formatMoney", () => {
  it("ยังปัดเป็นจำนวนเต็มเหมือนเดิม", () => {
    expect(formatMoney(15112.5)).toBe("15,113")
  })
})
