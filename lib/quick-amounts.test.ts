import { describe, it, expect } from "vitest"
import { topAmounts } from "./quick-amounts"

const TODAY = "2026-10-18"
const tx = (amount: number | string, date = "2026-10-10", type = "expense") => ({ amount, type, date })

describe("topAmounts", () => {
  it("ไม่มีข้อมูล -> []", () => {
    expect(topAmounts([], "expense", TODAY)).toEqual([])
  })

  it("กรองตาม type", () => {
    const rows = [tx(60), tx(60), tx(500, "2026-10-10", "income"), tx(500, "2026-10-11", "income")]
    expect(topAmounts(rows, "expense", TODAY)).toEqual([60])
    expect(topAmounts(rows, "income", TODAY)).toEqual([500])
  })

  it("ช่วงวัน: วันที่ 60 นับ, วันที่ 61 ก่อนไม่นับ, อนาคตไม่นับ", () => {
    // today - 59 = 2026-08-20 (วันที่ 60 นับรวมวันนี้)
    const rows = [tx(10, "2026-08-20"), tx(10, "2026-08-19"), tx(20, "2026-08-19"), tx(20, "2026-08-18")]
    expect(topAmounts(rows, "expense", TODAY, { minCount: 1 }).sort((a, b) => a - b)).toEqual([10])
    const future = [tx(30, "2026-10-19"), tx(30, "2026-10-20"), tx(40, TODAY), tx(40, TODAY)]
    expect(topAmounts(future, "expense", TODAY)).toEqual([40])
  })

  it("minCount: จดครั้งเดียวไม่นับ", () => {
    const rows = [tx(60), tx(60), tx(99)]
    expect(topAmounts(rows, "expense", TODAY)).toEqual([60])
    expect(topAmounts(rows, "expense", TODAY, { minCount: 1 })).toEqual([60, 99])
  })

  it("limit + เสมอกันเอายอดที่จดล่าสุดก่อน แล้วเรียงน้อย->มาก", () => {
    const rows = [
      tx(100, "2026-10-01"), tx(100, "2026-10-02"),
      tx(50, "2026-10-03"), tx(50, "2026-10-04"),
      tx(70, "2026-10-05"), tx(70, "2026-10-06"),
      tx(30, "2026-10-07"), tx(30, "2026-10-08"),
      tx(20, "2026-10-09"), tx(20, "2026-10-10"),
      tx(200, "2026-10-01"), tx(200, "2026-10-01"), tx(200, "2026-10-01"),
    ]
    // 200 (3 ครั้ง) + เสมอ 2 ครั้ง เอาล่าสุด: 20, 30, 70 -> เรียง 20,30,70,200
    expect(topAmounts(rows, "expense", TODAY)).toEqual([20, 30, 70, 200])
    expect(topAmounts(rows, "expense", TODAY, { limit: 2 })).toEqual([20, 200])
  })

  it("amount เป็น string / NaN / 0 / ติดลบ", () => {
    const rows = [tx("60"), tx(60), tx("abc"), tx("abc"), tx(0), tx(0), tx(-5), tx(-5), tx("60.004")]
    expect(topAmounts(rows, "expense", TODAY)).toEqual([60])
  })

  it("ปัดเป็น 2 ทศนิยมก่อนนับ", () => {
    const rows = [tx("12.5"), tx(12.5), tx("12.499")]
    expect(topAmounts(rows, "expense", TODAY)).toEqual([12.5])
  })
})
