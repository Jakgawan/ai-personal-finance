import { describe, it, expect } from "vitest"
import { calcCarryIn } from "./period-carry-in"

describe("calcCarryIn", () => {
  it("ตั้งยอดในรอบนี้ ใช้ entered_amount", () => {
    expect(calcCarryIn({ amount: 400, entered_amount: 500, opening_date: "2026-10-20" }, [], "2026-10-20")).toBe(500)
  })
  it("ไม่มี entered_amount ใช้ amount", () => {
    expect(calcCarryIn({ amount: 400, entered_amount: null, opening_date: "2026-10-22" }, [], "2026-10-20")).toBe(400)
  })
  it("ตั้งยอดก่อนรอบ: รวมรายรับ-รายจ่ายถึงวันก่อนเริ่มรอบ", () => {
    const txs = [
      { date: "2026-10-05", type: "income", amount: 1000 },
      { date: "2026-10-10", type: "expense", amount: "300" },
      { date: "2026-10-19", type: "expense", amount: 100 },
      { date: "2026-10-20", type: "expense", amount: 999 }, // วันเริ่มรอบ ไม่นับ
      { date: "2026-09-30", type: "income", amount: 5000 }, // ก่อนวันตั้งยอด ไม่นับ
    ]
    expect(calcCarryIn({ amount: 200, opening_date: "2026-10-01" }, txs, "2026-10-20")).toBe(800)
  })
  it("ยกมาติดลบได้", () => {
    expect(calcCarryIn({ amount: 0, opening_date: "2026-10-01" }, [{ date: "2026-10-02", type: "expense", amount: 50 }], "2026-10-20")).toBe(-50)
  })
})
