import { isValidDateString } from "./date-valid"

export type OcrData = {
  name: string
  amount: number | null
  date: string | null
  type: "expense" | "income"
  category: string
}

export type OcrDiag = {
  stage: "gemini_http" | "blocked" | "no_candidate" | "empty_text" | "json_parse" | "invalid_shape"
  httpStatus: number
  finishReason: string | null
  blockReason: string | null
  textLength: number
  hadFence: boolean
}

export type OcrResult = { ok: true; data: OcrData } | { ok: false; diag: OcrDiag }

type GeminiPart = { text?: unknown; thought?: unknown }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function cleanString(v: unknown): string {
  if (typeof v !== "string") return ""
  return v.trim().slice(0, 100)
}

function normalizeAmount(v: unknown): number | null {
  let n: number
  if (typeof v === "number") n = v
  else if (typeof v === "string") n = Number(v.replace(/,/g, "").trim())
  else return null
  if (!Number.isFinite(n) || n <= 0) return null
  const rounded = Math.round(n * 100) / 100
  return rounded > 0 ? rounded : null
}

// วันที่ต้องเป็นวันจริง และปีต้องไม่เกินปีนี้ +1 (กัน พ.ศ. ที่ยังไม่แปลงเป็น ค.ศ.)
function normalizeDate(v: unknown): string | null {
  if (!isValidDateString(v)) return null
  const year = Number(v.slice(0, 4))
  if (year > new Date().getFullYear() + 1) return null
  return v
}

export function parseOcrGeminiResponse(httpStatus: number, body: unknown): OcrResult {
  const diag = (
    stage: OcrDiag["stage"],
    extra: Partial<Pick<OcrDiag, "finishReason" | "blockReason" | "textLength" | "hadFence">> = {}
  ): OcrResult => ({
    ok: false,
    diag: {
      stage,
      httpStatus,
      finishReason: extra.finishReason ?? null,
      blockReason: extra.blockReason ?? null,
      textLength: extra.textLength ?? 0,
      hadFence: extra.hadFence ?? false,
    },
  })

  if (httpStatus < 200 || httpStatus > 299) return diag("gemini_http")

  const root = isRecord(body) ? body : {}
  const feedback = isRecord(root.promptFeedback) ? root.promptFeedback : null
  const blockReason = feedback && typeof feedback.blockReason === "string" ? feedback.blockReason : null
  if (blockReason) return diag("blocked", { blockReason })

  const candidates = Array.isArray(root.candidates) ? root.candidates : []
  const candidate = candidates[0]
  if (!isRecord(candidate)) return diag("no_candidate")
  const finishReason = typeof candidate.finishReason === "string" ? candidate.finishReason : null

  const content = isRecord(candidate.content) ? candidate.content : null
  const parts: unknown[] = content && Array.isArray(content.parts) ? content.parts : []
  let text = parts
    .filter((p): p is GeminiPart => isRecord(p) && p.thought !== true)
    .map(p => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim()
  if (!text) return diag("empty_text", { finishReason })

  let hadFence = false
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text)
  if (fence) {
    hadFence = true
    text = fence[1].trim()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return diag("json_parse", { finishReason, textLength: text.length, hadFence })
  }
  if (!isRecord(parsed)) return diag("invalid_shape", { finishReason, textLength: text.length, hadFence })

  return {
    ok: true,
    data: {
      name: cleanString(parsed.name),
      amount: normalizeAmount(parsed.amount),
      date: normalizeDate(parsed.date),
      type: parsed.type === "income" ? "income" : "expense",
      category: cleanString(parsed.category),
    },
  }
}
