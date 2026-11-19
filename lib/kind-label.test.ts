import { describe, it, expect } from "vitest"
import { kindLabel } from "./kind-label"

describe("kindLabel", () => {
  it("รายการปกติ/ไม่มี kind = ว่าง", () => {
    expect(kindLabel("regular", "expense")).toBe("")
    expect(kindLabel(null, "income")).toBe("")
    expect(kindLabel(undefined, "expense")).toBe("")
  })
  it("จ่ายบิล", () => {
    expect(kindLabel("bill_payment", "expense")).toBe("จ่ายบิล")
  })
  it("เก็บเงิน/ถอนเงินเก็บ", () => {
    expect(kindLabel("saving", "expense")).toBe("เก็บเงิน")
    expect(kindLabel("saving", "income")).toBe("ถอนเงินเก็บ")
  })
  it("ลงทุน/ถอนเงินลงทุน", () => {
    expect(kindLabel("investment", "expense")).toBe("ลงทุน")
    expect(kindLabel("investment", "income")).toBe("ถอนเงินลงทุน")
  })
})
