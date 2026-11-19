import { describe, it, expect } from "vitest"
import { parseTyphoonOcrResponse, parseTyphoonChatJson, matchCategory, buildSlipExtractPrompt } from "./typhoon-ocr"

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
  it("มีกติกาผู้รับ (ฝ่ายที่สอง) และรายชื่อหมวด", () => {
    const p = buildSlipExtractPrompt("ไปยัง นาย ก", [{ name: "อาหาร", type: "expense" }])
    expect(p.system).toContain("ผู้รับเงิน")
    expect(p.system).toContain("ห้ามใช้ชื่อผู้โอน")
    expect(p.system).toContain("ฝ่ายที่สอง")
    expect(p.system).toContain("- อาหาร (expense)")
    expect(p.user).toContain("ไปยัง นาย ก")
  })
  it("ค่าแปลก ไม่ throw", () => {
    expect(() => buildSlipExtractPrompt(undefined, null as never)).not.toThrow()
    expect(() => buildSlipExtractPrompt(123, [{ name: "" }, null as never])).not.toThrow()
  })
})

describe("parseTyphoonChatJson", () => {
  const json = '{"name":"นาย ก","amount":95,"date":"2026-11-07","type":"expense","category":"อาหาร"}'
  const expected = { name: "นาย ก", amount: 95, date: "2026-11-07", type: "expense", category: "อาหาร" }
  it("JSON ล้วน", () => {
    expect(parseTyphoonChatJson(200, ok(json))).toEqual({ ok: true, data: expected })
  })
  it("มี fence", () => {
    expect(parseTyphoonChatJson(200, ok("```json\n" + json + "\n```"))).toEqual({ ok: true, data: expected })
  })
  it("มีข้อความรอบ JSON", () => {
    expect(parseTyphoonChatJson(200, ok("นี่คือผลลัพธ์: " + json + " เรียบร้อย"))).toEqual({ ok: true, data: expected })
  })
  it("content เป็น array ของ parts", () => {
    expect(parseTyphoonChatJson(200, ok([{ text: json }]))).toEqual({ ok: true, data: expected })
  })
  it("non-2xx", () => {
    expect(parseTyphoonChatJson(429, {})).toEqual({
      ok: false,
      diag: { stage: "typhoon_chat_http", httpStatus: 429, textLength: 0, hadFence: false },
    })
  })
  it("ว่าง", () => {
    const r = parseTyphoonChatJson(200, ok("  "))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.diag.stage).toBe("typhoon_chat_empty")
  })
  it("ขยะ = json_parse", () => {
    const r = parseTyphoonChatJson(200, ok("ขออภัย ไม่สามารถอ่านได้"))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.diag.stage).toBe("json_parse")
  })
  it("array JSON = invalid_shape", () => {
    const r = parseTyphoonChatJson(200, ok("[1,2]"))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.diag.stage).toBe("invalid_shape")
  })
  it("normalize: amount string และวันที่ พ.ศ.", () => {
    const r = parseTyphoonChatJson(200, ok('{"name":" x ","amount":"95.00","date":"2569-11-07","type":"income"}'))
    expect(r).toEqual({ ok: true, data: { name: "x", amount: 95, date: null, type: "income", category: "" } })
  })
  it("diag ไม่มีเนื้อหา", () => {
    const r = parseTyphoonChatJson(200, ok("SECRET-CONTENT ไม่ใช่ json"))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(Object.keys(r.diag).sort()).toEqual(["hadFence", "httpStatus", "stage", "textLength"])
      expect(JSON.stringify(r.diag)).not.toContain("SECRET")
    }
  })
})
