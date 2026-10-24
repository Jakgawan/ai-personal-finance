import { describe, it, expect } from "vitest"
import { topItems } from "./quick-amounts"

const TODAY = "2026-10-18"
type Row = { name: string | null; amount: number | string; type: string; date: string; category: string | null; kind?: string | null }
const tx = (
  amount: number | string,
  date = "2026-10-10",
  type = "expense",
  name: string | null = "ข้าว",
  category: string | null = "อาหาร",
  kind?: string | null
): Row => ({ name, amount, type, date, category, kind })

describe("topItems", () => {
  it("ไม่มีข้อมูล -> []", () => {
    expect(topItems([], "expense", TODAY)).toEqual([])
  })

  it("กรองตาม type", () => {
    const rows = [tx(60), tx(60), tx(500, "2026-10-10", "income", "เงินเดือน", null), tx(500, "2026-10-11", "income", "เงินเดือน", null)]
    expect(topItems(rows, "expense", TODAY)).toEqual([{ name: "ข้าว", amount: 60, category: "อาหาร", count: 2 }])
    expect(topItems(rows, "income", TODAY)).toEqual([{ name: "เงินเดือน", amount: 500, category: null, count: 2 }])
  })

  it("ไม่นับ kind = bill_payment", () => {
    const rows = [tx(60, "2026-10-10", "expense", "ข้าว", "อาหาร", "bill_payment"), tx(60, "2026-10-11", "expense", "ข้าว", "อาหาร", "bill_payment")]
    expect(topItems(rows, "expense", TODAY)).toEqual([])
    const mixed = [tx(60, "2026-10-10", "expense", "ข้าว", "อาหาร", "regular"), tx(60, "2026-10-11", "expense", "ข้าว", "อาหาร", null), tx(60, "2026-10-12", "expense", "ข้าว", "อาหาร", "bill_payment")]
    expect(topItems(mixed, "expense", TODAY)[0].count).toBe(2)
  })

  it("ช่วง 30 วัน: วันที่ 30 นับ, วันที่ 31 ไม่นับ, อนาคตไม่นับ", () => {
    // today - 29 = 2026-09-19
    const edge = [tx(10, "2026-09-19"), tx(10, "2026-09-19")]
    expect(topItems(edge, "expense", TODAY)).toHaveLength(1)
    const out = [tx(10, "2026-09-18"), tx(10, "2026-09-18"), tx(10, "2026-09-19")]
    expect(topItems(out, "expense", TODAY)).toEqual([])
    const future = [tx(30, "2026-10-19"), tx(30, "2026-10-20"), tx(40, TODAY), tx(40, TODAY)]
    expect(topItems(future, "expense", TODAY).map(i => i.amount)).toEqual([40])
  })

  it("ชื่อเดียวยอดต่างกัน แยกกลุ่ม", () => {
    const rows = [tx(60), tx(60), tx(80), tx(80), tx(80)]
    const r = topItems(rows, "expense", TODAY)
    expect(r.map(i => [i.amount, i.count])).toEqual([[80, 3], [60, 2]])
  })

  it("หมวดต่างกัน แยกกลุ่ม, null กับ '' เป็นกลุ่มเดียวกัน", () => {
    const rows = [tx(60, "2026-10-10", "expense", "ข้าว", "อาหาร"), tx(60, "2026-10-11", "expense", "ข้าว", "เดินทาง")]
    expect(topItems(rows, "expense", TODAY)).toEqual([])
    const nulls = [tx(60, "2026-10-10", "expense", "ข้าว", null), tx(60, "2026-10-11", "expense", "ข้าว", "")]
    expect(topItems(nulls, "expense", TODAY)).toHaveLength(1)
  })

  it("ชื่อมีช่องว่างหัวท้าย / null / ว่าง รวมเป็นชื่อ ''", () => {
    const rows = [tx(60, "2026-10-10", "expense", " ข้าว "), tx(60, "2026-10-11", "expense", "ข้าว")]
    expect(topItems(rows, "expense", TODAY)).toEqual([{ name: "ข้าว", amount: 60, category: "อาหาร", count: 2 }])
    const blanks = [tx(60, "2026-10-10", "expense", null), tx(60, "2026-10-11", "expense", "   "), tx(60, "2026-10-12", "expense", "")]
    expect(topItems(blanks, "expense", TODAY)).toEqual([{ name: "", amount: 60, category: "อาหาร", count: 3 }])
  })

  it("minCount: จดครั้งเดียวไม่นับ", () => {
    const rows = [tx(60), tx(60), tx(99)]
    expect(topItems(rows, "expense", TODAY).map(i => i.amount)).toEqual([60])
    expect(topItems(rows, "expense", TODAY, { minCount: 1 }).map(i => i.amount).sort((a, b) => a - b)).toEqual([60, 99])
  })

  it("limit 6 + เสมอกันเอาล่าสุดก่อน, เรียงถี่สุดก่อน", () => {
    const rows: Row[] = []
    // 7 กลุ่ม ยอด 1..7 กลุ่มละ 2 ครั้ง วันล่าสุดต่างกัน (ยอดมาก = ล่าสุดมาก)
    for (let i = 1; i <= 7; i++) {
      const d = `2026-10-${String(i).padStart(2, "0")}`
      rows.push(tx(i, d), tx(i, d))
    }
    rows.push(tx(500, "2026-10-01"), tx(500, "2026-10-01"), tx(500, "2026-10-01"))
    const r = topItems(rows, "expense", TODAY)
    expect(r).toHaveLength(6)
    expect(r.map(i => i.amount)).toEqual([500, 7, 6, 5, 4, 3])
    expect(topItems(rows, "expense", TODAY, { limit: 2 }).map(i => i.amount)).toEqual([500, 7])
  })

  it("ข้อมูลเสีย: amount string / NaN / 0 / ติดลบ, date ไม่ใช่ string", () => {
    const bad = { name: "ข้าว", amount: 60, type: "expense", date: undefined as unknown as string, category: "อาหาร" }
    const rows = [tx("60"), tx(60), tx("abc"), tx("abc"), tx(0), tx(0), tx(-5), tx(-5), tx("60.004"), bad, bad]
    expect(topItems(rows, "expense", TODAY)).toEqual([{ name: "ข้าว", amount: 60, category: "อาหาร", count: 3 }])
  })

  it("ปัดเป็น 2 ทศนิยมก่อนนับ", () => {
    const rows = [tx("12.5"), tx(12.5), tx("12.499")]
    expect(topItems(rows, "expense", TODAY)).toEqual([{ name: "ข้าว", amount: 12.5, category: "อาหาร", count: 3 }])
  })
})
