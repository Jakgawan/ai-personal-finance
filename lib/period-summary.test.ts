import { describe, it, expect } from "vitest"
import { summarizePeriod, buildFinancialContext, pickRecent, type RecentTx } from "./period-summary"

const period = { start: "2026-10-20", end: "2026-11-04" }

describe("summarizePeriod", () => {
  it("นับเฉพาะรายการในช่วงรอบและไม่เกินวันนี้ รวมจ่ายบิลในรายจ่าย", () => {
    const txs = [
      { date: "2026-10-19", type: "income", amount: 999 }, // ก่อนรอบ
      { date: "2026-10-20", type: "income", amount: 1000 },
      { date: "2026-10-25", type: "expense", amount: "200" },
      { date: "2026-10-26", type: "expense", amount: 300, kind: "bill_payment" },
      { date: "2026-11-02", type: "expense", amount: 50 }, // เกินวันนี้
      { date: "2026-11-05", type: "expense", amount: 77 }, // เกินรอบ
    ]
    expect(summarizePeriod(txs, period, "2026-10-30")).toEqual({ income: 1000, expense: 500 })
    expect(summarizePeriod(txs, period, "2026-11-04")).toEqual({ income: 1000, expense: 550 })
  })
})

describe("buildFinancialContext", () => {
  const base = {
    period,
    income: 12345,
    expense: 6789,
    balanceNow: 4321 as number | null,
    daysLeftInclToday: 3,
    totalAssets: 1000,
    totalLiabilities: 400,
    recent: [] as RecentTx[],
  }

  it("มีวันที่รอบและยอดตรงตัว และไม่ใช้คำว่ารายรับรวม", () => {
    const out = buildFinancialContext(base)
    expect(out).toContain("2026-10-20")
    expect(out).toContain("2026-11-04")
    expect(out).toContain(`รายรับรอบนี้: ฿${(12345).toLocaleString()}`)
    expect(out).toContain(`รายจ่ายรอบนี้ (รวมจ่ายบิล): ฿${(6789).toLocaleString()}`)
    expect(out).toContain(`เงินคงเหลือตอนนี้: ฿${(4321).toLocaleString()}`)
    expect(out).toContain(`ความมั่งคั่งสุทธิ: ฿${(600).toLocaleString()}`)
    expect(out).not.toContain("รายรับรวม")
  })

  it("ไม่มียอดตั้งต้น -> บอกว่ายังไม่ได้ตั้งยอดเงิน", () => {
    const out = buildFinancialContext({ ...base, balanceNow: null })
    expect(out).toContain("ยังไม่ได้ตั้งยอดเงิน")
  })

  it("รายการล่าสุดไม่เกิน 20 และมีป้ายจ่ายบิล", () => {
    const recent: RecentTx[] = Array.from({ length: 25 }, (_, i) => ({
      date: "2026-11-01",
      name: `item${i}`,
      type: i === 0 ? "income" : "expense",
      amount: 10,
      kind: i === 1 ? "bill_payment" : null,
    }))
    const out = buildFinancialContext({ ...base, recent })
    expect(out).toContain("item19")
    expect(out).not.toContain("item20")
    expect(out).toContain("+฿10")
    expect(out.split("\n").filter(l => l.includes("(จ่ายบิล)")).length).toBe(1)
  })
})

describe("pickRecent", () => {
  it("ตัดรายการอนาคต เรียงวันที่แล้ว created_at ใหม่สุดก่อน และจำกัดจำนวน", () => {
    const txs = [
      { date: "2026-11-10", type: "expense", amount: 1, created_at: "2026-11-01T00:00:00Z", name: "future" },
      { date: "2026-11-03", type: "expense", amount: 1, created_at: "2026-11-03T01:00:00Z", name: "a" },
      { date: "2026-11-04", type: "expense", amount: 1, created_at: "2026-11-04T01:00:00Z", name: "b" },
      { date: "2026-11-04", type: "expense", amount: 1, created_at: "2026-11-04T05:00:00Z", name: "c" },
    ]
    expect(pickRecent(txs, "2026-11-04", 10).map(t => t.name)).toEqual(["c", "b", "a"])
    expect(pickRecent(txs, "2026-11-04", 2).map(t => t.name)).toEqual(["c", "b"])
  })
})
