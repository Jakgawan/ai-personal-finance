import { describe, it, expect } from "vitest"
import { parseOcrGeminiResponse } from "./ocr-parse"

const body = (...texts: string[]) => ({
  candidates: [{ finishReason: "STOP", content: { parts: texts.map(text => ({ text })) } }],
})
const okData = (b: unknown) => {
  const r = parseOcrGeminiResponse(200, b)
  if (!r.ok) throw new Error("expected ok, got " + r.diag.stage)
  return r.data
}
const failDiag = (status: number, b: unknown) => {
  const r = parseOcrGeminiResponse(status, b)
  if (r.ok) throw new Error("expected failure")
  return r.diag
}
const json = (o: object) => JSON.stringify(o)
const thisYear = new Date().getFullYear()

describe("parseOcrGeminiResponse", () => {
  it("plain JSON ok", () => {
    const d = okData(body(json({ name: "ร้าน A", amount: 120, date: `${thisYear}-01-05`, type: "expense", category: "อาหาร" })))
    expect(d).toEqual({ name: "ร้าน A", amount: 120, date: `${thisYear}-01-05`, type: "expense", category: "อาหาร" })
  })

  it("fenced ```json ok", () => {
    const d = okData(body("```json\n" + json({ name: "x", amount: 5, type: "income" }) + "\n```"))
    expect(d.amount).toBe(5)
    expect(d.type).toBe("income")
  })

  it("text split across 2 parts", () => {
    const t = json({ name: "x", amount: 9, type: "expense" })
    expect(okData(body(t.slice(0, 10), t.slice(10))).amount).toBe(9)
  })

  it("thought part skipped", () => {
    const b = {
      candidates: [{ content: { parts: [{ text: "thinking {{{", thought: true }, { text: json({ amount: 7, type: "expense" }) }] } }],
    }
    expect(okData(b).amount).toBe(7)
  })

  it("amount string with commas", () => {
    expect(okData(body(json({ amount: "1,280.50", type: "expense" }))).amount).toBe(1280.5)
  })

  it("amount 0 / -5 / abc -> null", () => {
    for (const a of [0, -5, "abc"]) {
      expect(okData(body(json({ amount: a, type: "expense" }))).amount).toBeNull()
    }
  })

  it("amount rounded to 2 decimals", () => {
    expect(okData(body(json({ amount: 10.456, type: "expense" }))).amount).toBe(10.46)
  })

  it("impossible date -> null", () => {
    expect(okData(body(json({ date: "2026-02-30", type: "expense" }))).date).toBeNull()
  })

  it("un-converted Buddhist year -> null (year > current+1)", () => {
    expect(okData(body(json({ date: "2569-11-03", type: "expense" }))).date).toBeNull()
  })

  it("valid date kept", () => {
    expect(okData(body(json({ date: `${thisYear}-03-04`, type: "expense" }))).date).toBe(`${thisYear}-03-04`)
  })

  it("type INCOME / missing -> expense", () => {
    expect(okData(body(json({ type: "INCOME" }))).type).toBe("expense")
    expect(okData(body(json({ amount: 1 }))).type).toBe("expense")
  })

  it("name/category trimmed and capped", () => {
    const d = okData(body(json({ name: "  " + "a".repeat(150) + " ", category: 5, type: "expense" })))
    expect(d.name.length).toBe(100)
    expect(d.category).toBe("")
  })

  it("HTTP 429 -> gemini_http", () => {
    expect(failDiag(429, { error: { message: "SECRET quota" } }).stage).toBe("gemini_http")
  })

  it("blockReason -> blocked", () => {
    const d = failDiag(200, { promptFeedback: { blockReason: "SAFETY" } })
    expect(d.stage).toBe("blocked")
    expect(d.blockReason).toBe("SAFETY")
  })

  it("no candidates", () => {
    expect(failDiag(200, {}).stage).toBe("no_candidate")
    expect(failDiag(200, { candidates: [] }).stage).toBe("no_candidate")
  })

  it("empty text", () => {
    const d = failDiag(200, { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "  " }] } }] })
    expect(d.stage).toBe("empty_text")
    expect(d.finishReason).toBe("MAX_TOKENS")
  })

  it("garbage text -> json_parse", () => {
    const d = failDiag(200, body("not json at all"))
    expect(d.stage).toBe("json_parse")
    expect(d.textLength).toBeGreaterThan(0)
  })

  it("array JSON -> invalid_shape", () => {
    expect(failDiag(200, body("[1,2]")).stage).toBe("invalid_shape")
  })

  it("diag never contains slip content", () => {
    const secret = "SECRET-SLIP-NAME-9999"
    for (const text of [secret + " garbage", "```json\n[\"" + secret + "\"]\n```"]) {
      const s = JSON.stringify(failDiag(200, body(text)))
      expect(s).not.toContain(secret)
    }
    expect(JSON.stringify(failDiag(500, { error: { message: secret } }))).not.toContain(secret)
  })
})
