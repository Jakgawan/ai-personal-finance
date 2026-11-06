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

  it("นับวันแรกและวันสุดท้ายของรอบ ตัดวันก่อนรอบ", () => {
    const txs = [
      { date: "2026-10-19", type: "income", amount: 1 }, // start - 1
      { date: "2026-10-20", type: "income", amount: 10 }, // start
      { date: "2026-11-04", type: "income", amount: 100 }, // end
    ]
    expect(summarizePeriod(txs, period, "2026-11-04")).toEqual({ income: 110, expense: 0 })
  })

  it("รายการวันสิ้นสุดรอบที่ยังไม่ถึงวันนี้ไม่นับ แต่ของวันนี้นับ", () => {
    const txs = [
      { date: "2026-11-04", type: "expense", amount: 40 }, // = end, > today
      { date: "2026-11-03", type: "expense", amount: 7 }, // = today
    ]
    expect(summarizePeriod(txs, period, "2026-11-03")).toEqual({ income: 0, expense: 7 })
  })

  it("จ่ายบิลนับในรายจ่าย และรายรับที่ kind เป็น bill_payment (ข้อมูลแปลก) ยังนับเป็นรายรับ", () => {
    const txs = [
      { date: "2026-10-25", type: "expense", amount: 300, kind: "bill_payment" },
      { date: "2026-10-26", type: "income", amount: 500, kind: "bill_payment" },
    ]
    expect(summarizePeriod(txs, period, "2026-11-04")).toEqual({ income: 500, expense: 300 })
  })

  it("จำนวนเงินเป็น string ตัวเลขรวมได้ถูก", () => {
    const txs = [
      { date: "2026-10-25", type: "income", amount: "1200.50" },
      { date: "2026-10-26", type: "income", amount: "0.25" },
      { date: "2026-10-27", type: "expense", amount: "99.75" },
    ]
    expect(summarizePeriod(txs, period, "2026-11-04")).toEqual({ income: 1200.75, expense: 99.75 })
  })

  it("ไม่มีรายการ -> 0", () => {
    expect(summarizePeriod([], period, "2026-11-04")).toEqual({ income: 0, expense: 0 })
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

  it("เงินคงเหลือติดลบแสดงเครื่องหมายลบ", () => {
    const out = buildFinancialContext({ ...base, balanceNow: -850 })
    const line = out.split("\n").find(l => l.startsWith("เงินคงเหลือตอนนี้"))
    expect(line).toBeDefined()
    expect(line).toContain("-")
    expect(line).toContain((850).toLocaleString())
  })

  it("ป้ายจ่ายบิลอยู่เฉพาะแถวที่เป็นจ่ายบิล", () => {
    const recent: RecentTx[] = [
      { date: "2026-11-02", name: "bill", type: "expense", amount: 500, kind: "bill_payment" },
      { date: "2026-11-02", name: "food", type: "expense", amount: 60, kind: "regular" },
      { date: "2026-11-01", name: "pay", type: "income", amount: 900 },
    ]
    const lines = buildFinancialContext({ ...base, recent }).split("\n")
    expect(lines.find(l => l.includes(" bill "))).toContain("(จ่ายบิล)")
    expect(lines.find(l => l.includes(" food "))).not.toContain("(จ่ายบิล)")
    expect(lines.find(l => l.includes(" pay "))).not.toContain("(จ่ายบิล)")
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
