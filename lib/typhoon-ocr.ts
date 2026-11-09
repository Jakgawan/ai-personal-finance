import { normalizeOcrFields, type OcrData } from "./ocr-parse"

// ตัวช่วยล้วน (pure) สำหรับอ่านสลิปด้วย Typhoon OCR แล้วให้ Typhoon chat แยกข้อมูลจากข้อความ
// ห้าม log หรือส่งคืนข้อความที่อ่านได้จากสลิป

export const TYPHOON_OCR_PROMPT =
  "Extract all text from the image.\n\nInstructions:\n- Only return the clean Markdown.\n- Do not include any explanation or extra text.\n- You must include all information on the page.\n\nFormatting Rules:\n- Tables: Render tables using <table>...</table> in clean HTML format."

export type TyphoonParseResult =
  | { ok: true; text: string }
  | { ok: false; stage: "typhoon_http" | "typhoon_empty"; httpStatus: number }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

export function parseTyphoonOcrResponse(httpStatus: number, body: unknown): TyphoonParseResult {
  if (httpStatus < 200 || httpStatus > 299) {
    return { ok: false, stage: "typhoon_http", httpStatus }
  }
  const root = isRecord(body) ? body : {}
  const choices = Array.isArray(root.choices) ? root.choices : []
  const first = choices[0]
  const message = isRecord(first) && isRecord(first.message) ? first.message : null
  const content = message ? message.content : null

  let text = ""
  if (typeof content === "string") {
    text = content
  } else if (Array.isArray(content)) {
    text = content
      .map(p => {
        if (typeof p === "string") return p
        if (isRecord(p) && typeof p.text === "string") return p.text
        return ""
      })
      .join("")
  }
  text = text.trim()
  if (!text) return { ok: false, stage: "typhoon_empty", httpStatus }
  return { ok: true, text }
}

export type SlipCategory = { name: string; type?: string | null }

// คืนชื่อหมวดที่ตรงกับหมวดของผู้ใช้เป๊ะๆ (ไม่สนตัวพิมพ์/ช่องว่างหัวท้าย) ไม่ตรง = ""
// ถ้าส่ง type มา จะเทียบเฉพาะหมวดที่ type ตรงกัน หรือหมวดที่ไม่ระบุ type
export function matchCategory(name: unknown, categories: SlipCategory[], type?: string): string {
  if (typeof name !== "string") return ""
  const wanted = name.trim().toLowerCase()
  if (!wanted || !Array.isArray(categories)) return ""
  for (const c of categories) {
    if (!c || typeof c.name !== "string") continue
    if (type && c.type && c.type !== type) continue
    if (c.name.trim().toLowerCase() === wanted) return c.name
  }
  return ""
}

export function buildSlipExtractPrompt(ocrText: unknown, categories: SlipCategory[]): { system: string; user: string } {
  const text = typeof ocrText === "string" ? ocrText : ""
  const list = (Array.isArray(categories) ? categories : [])
    .filter(c => c && typeof c.name === "string" && c.name.trim() !== "")
    .map(c => `- ${c.name.trim()}${c.type ? ` (${c.type})` : ""}`)
    .join("\n")

  const system = `คุณคือตัวช่วยดึงข้อมูลจากข้อความ OCR ของสลิปโอนเงินธนาคารหรือใบเสร็จภาษาไทย ตอบเป็น JSON object เท่านั้น ห้ามมี markdown หรือข้อความอื่น โดยมี key: name, amount, date, type, category

กติกา:
- name: ถ้าเป็นสลิปโอนเงิน ให้ใช้ชื่อ "ผู้รับเงิน" (ฝั่งหลังคำว่า "ไปยัง" / "ถึง" / "ผู้รับ" / "To") ห้ามใช้ชื่อผู้โอน สลิปบางแบบแสดงผู้โอนก่อน แล้วมีแค่ลูกศรคั่นระหว่างผู้โอนกับผู้รับ ให้ถือว่าผู้รับคือฝ่ายที่สอง (ฝ่ายหลัง) ถ้าเป็นใบเสร็จจากร้านค้า ให้ใช้ชื่อร้าน คัดลอกตัวสะกดภาษาไทยตามข้อความ OCR เดิมทุกตัวอักษรรวมถึงวรรณยุกต์ ห้ามแปลหรือแก้คำ
- amount: ยอดที่โอนหรือจ่ายเป็นตัวเลข ไม่ใช่ค่าธรรมเนียม (ไม่มีสัญลักษณ์สกุลเงิน)
- date: รูปแบบ YYYY-MM-DD ปีคริสต์ศักราช (ค.ศ.) ถ้าเป็นปีพุทธศักราช (พ.ศ.) ให้ลบ 543 ปี 2 หลักเช่น "69" หมายถึง 2569 (ค.ศ. 2026) เดือนย่อภาษาไทย: ม.ค. ก.พ. มี.ค. เม.ย. พ.ค. มิ.ย. ก.ค. ส.ค. ก.ย. ต.ค. พ.ย. ธ.ค.
- type: "expense" เว้นแต่ข้อความระบุชัดว่าเป็นการรับเงินเข้า จึงใช้ "income"
- category: เลือกชื่อหมวดจากรายการนี้ให้ตรงตัวอักษรเป๊ะเพียงหนึ่งหมวด ถ้าไม่มีหมวดที่เหมาะสมให้ใส่ "" (ว่าง)
หมวดที่มี:
${list || "(ไม่มี)"}
ถ้าหาข้อมูลไม่เจอให้ใส่ค่าว่างหรือ null`

  const user = `ข้อความ OCR:
"""
${text}
"""

ตอบเป็น JSON object เท่านั้น`
  return { system, user }
}

export type TyphoonChatDiag = {
  stage: "typhoon_chat_http" | "typhoon_chat_empty" | "json_parse" | "invalid_shape"
  httpStatus: number
  textLength: number
  hadFence: boolean
}

export type TyphoonChatResult = { ok: true; data: OcrData } | { ok: false; diag: TyphoonChatDiag }

export function parseTyphoonChatJson(httpStatus: number, body: unknown): TyphoonChatResult {
  const fail = (stage: TyphoonChatDiag["stage"], textLength = 0, hadFence = false): TyphoonChatResult => ({
    ok: false,
    diag: { stage, httpStatus, textLength, hadFence },
  })
  if (httpStatus < 200 || httpStatus > 299) return fail("typhoon_chat_http")

  const root = isRecord(body) ? body : {}
  const choices = Array.isArray(root.choices) ? root.choices : []
  const first = choices[0]
  const message = isRecord(first) && isRecord(first.message) ? first.message : null
  const content = message ? message.content : null
  let text = ""
  if (typeof content === "string") {
    text = content
  } else if (Array.isArray(content)) {
    text = content
      .map(p => {
        if (typeof p === "string") return p
        if (isRecord(p) && typeof p.text === "string") return p.text
        return ""
      })
      .join("")
  }
  text = text.trim()
  if (!text) return fail("typhoon_chat_empty")

  let hadFence = false
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text)
  if (fence) {
    hadFence = true
    text = fence[1].trim()
  } else {
    const start = text.indexOf("{")
    const end = text.lastIndexOf("}")
    if (start !== -1 && end > start) text = text.slice(start, end + 1)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return fail("json_parse", text.length, hadFence)
  }
  if (!isRecord(parsed)) return fail("invalid_shape", text.length, hadFence)
  return { ok: true, data: normalizeOcrFields(parsed) }
}
