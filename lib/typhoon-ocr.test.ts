import { describe, it, expect } from "vitest"
import { parseTyphoonOcrResponse, matchCategory, buildSlipExtractPrompt } from "./typhoon-ocr"

const ok = (content: unknown) => ({ choices: [{ message: { content } }] })

describe("parseTyphoonOcrResponse", () => {
  it("200 พร้อมข้อความ", () => {
    expect(parseTyphoonOcrResponse(200, ok("  hello  "))).toEqual({ ok: true, text: "hello" })
  })
  it("429 = typhoon_http", () => {
    expect(parseTyphoonOcrResponse(429, {})).toEqual({ ok: false, stage: "typhoon_http", httpStatus: 429 })
  })
  it("500 = typhoon_http", () => {
    expect(parseTyphoonOcrResponse(500, ok("x"))).toEqual({ ok: false, stage: "typhoon_http", httpStatus: 500 })
  })
  it("ไม่มี choices = typhoon_empty", () => {
    expect(parseTyphoonOcrResponse(200, {})).toEqual({ ok: false, stage: "typhoon_empty", httpStatus: 200 })
    expect(parseTyphoonOcrResponse(200, null)).toEqual({ ok: false, stage: "typhoon_empty", httpStatus: 200 })
  })
  it("content ว่าง = typhoon_empty", () => {
    expect(parseTyphoonOcrResponse(200, ok("   "))).toEqual({ ok: false, stage: "typhoon_empty", httpStatus: 200 })
  })
  it("content เป็น array ของ parts", () => {
    expect(parseTyphoonOcrResponse(200, ok([{ type: "text", text: "a" }, { text: "b" }, 5]))).toEqual({ ok: true, text: "ab" })
  })
})

describe("matchCategory", () => {
  const cats = [{ name: "อาหาร", type: "expense" }, { name: "Salary", type: "income" }]
  it("ตรงเป๊ะ", () => expect(matchCategory("อาหาร", cats)).toBe("อาหาร"))
  it("ไม่สนตัวพิมพ์/ช่องว่าง และคืนชื่อที่เก็บไว้", () => expect(matchCategory("  salary ", cats)).toBe("Salary"))
  it("ไม่อยู่ในรายการ = ว่าง", () => expect(matchCategory("Food & Beverage", cats)).toBe(""))
  it("รายการว่าง = ว่าง", () => expect(matchCategory("อาหาร", [])).toBe(""))
  it("ชื่อเดียวกันแต่คนละประเภท = ว่าง", () => {
    expect(matchCategory("อาหาร", cats, "income")).toBe("")
    expect(matchCategory("อาหาร", cats, "expense")).toBe("อาหาร")
  })
  it("หมวดไม่ระบุประเภทยังตรงได้", () => {
    expect(matchCategory("อื่นๆ", [{ name: "อื่นๆ", type: null }], "income")).toBe("อื่นๆ")
    expect(matchCategory("อื่นๆ", [{ name: "อื่นๆ" }], "expense")).toBe("อื่นๆ")
    expect(matchCategory("อื่นๆ", [{ name: "อื่นๆ", type: "" }], "expense")).toBe("อื่นๆ")
  })
  it("ค่าแปลก ไม่ throw", () => {
    expect(matchCategory(null, cats)).toBe("")
    expect(matchCategory(undefined, cats)).toBe("")
    expect(matchCategory(5, cats)).toBe("")
  })
})

describe("buildSlipExtractPrompt", () => {
  it("มีกติกาผู้รับและรายชื่อหมวด", () => {
    const p = buildSlipExtractPrompt("ไปยัง นาย ก", [{ name: "อาหาร", type: "expense" }])
    expect(p).toContain("ผู้รับเงิน")
    expect(p).toContain("ห้ามใช้ชื่อผู้โอน")
    expect(p).toContain("- อาหาร (expense)")
    expect(p).toContain("ไปยัง นาย ก")
  })
  it("ค่าแปลก ไม่ throw", () => {
    expect(() => buildSlipExtractPrompt(undefined, null as never)).not.toThrow()
    expect(() => buildSlipExtractPrompt(123, [{ name: "" }, null as never])).not.toThrow()
  })
})
