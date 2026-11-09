import { NextRequest, NextResponse } from "next/server"
import { getAuthUser, createUserClient } from "@/lib/supabase-server"
import { parseOcrGeminiResponse, type OcrData, type OcrDiag } from "@/lib/ocr-parse"
import {
  TYPHOON_OCR_PROMPT,
  parseTyphoonOcrResponse,
  buildSlipExtractPrompt,
  matchCategory,
  type SlipCategory,
} from "@/lib/typhoon-ocr"

type TyphoonStage = null | "typhoon_http" | "typhoon_empty" | "typhoon_timeout" | "skipped_no_key" | "skipped_mime"
type Provider = "typhoon+gemini" | "gemini"
type RouteDiag = OcrDiag & { provider: Provider; typhoonStage: TyphoonStage; typhoonStatus: number | null }

export const maxDuration = 60

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING", nullable: true },
    amount: { type: "NUMBER", nullable: true },
    date: { type: "STRING", nullable: true, description: "YYYY-MM-DD, Gregorian (convert Buddhist Era year −543)" },
    type: { type: "STRING", enum: ["expense", "income"] },
    category: { type: "STRING", nullable: true },
  },
  required: ["type"],
}

const VISION_PROMPT = `ดูรูปสลิปหรือใบเสร็จนี้แล้วดึงข้อมูลออกมา ตอบเป็น JSON เท่านั้น ห้ามมี markdown หรือข้อความอื่น:
{
  "name": "ชื่อรายการหรือร้านค้า",
  "amount": ตัวเลขจำนวนเงิน (ไม่มีสัญลักษณ์),
  "date": "YYYY-MM-DD",
  "type": "expense หรือ income",
  "category": "หมวดหมู่ที่เหมาะสม"
}
ถ้าหาข้อมูลไม่เจอให้ใส่ค่าว่างหรือ null
ถ้าวันที่บนสลิปเป็นปีพุทธศักราช (พ.ศ.) ให้แปลงเป็นคริสต์ศักราช (ค.ศ.) โดยลบ 543`

async function callGemini(parts: unknown[]): Promise<{ status: number; body: unknown }> {
  try {
    const response = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
      }),
      signal: AbortSignal.timeout(25000),
    })
    // ถ้า body ไม่ใช่ JSON ให้ถือเป็นความผิดพลาดจาก Gemini (ไม่เก็บเนื้อหา)
    try {
      return { status: response.status, body: await response.json() }
    } catch {
      return { status: 502, body: null }
    }
  } catch {
    return { status: 502, body: null }
  }
}

type TyphoonOutcome = { ok: true; text: string } | { ok: false; stage: Exclude<TyphoonStage, null>; status: number | null }

async function callTyphoon(apiKey: string, imageBase64: string, mime: string): Promise<TyphoonOutcome> {
  try {
    const res = await fetch("https://api.opentyphoon.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "typhoon-ocr",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: TYPHOON_OCR_PROMPT },
            { type: "image_url", image_url: { url: `data:${mime};base64,${imageBase64}` } },
          ],
        }],
        max_tokens: 2048,
        temperature: 0.1,
        top_p: 0.6,
        repetition_penalty: 1.1,
      }),
      signal: AbortSignal.timeout(25000),
    })
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    const parsed = parseTyphoonOcrResponse(res.status, body)
    if (parsed.ok) return { ok: true, text: parsed.text }
    return { ok: false, stage: parsed.stage, status: parsed.httpStatus }
  } catch (err) {
    if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return { ok: false, stage: "typhoon_timeout", status: null }
    }
    return { ok: false, stage: "typhoon_http", status: null }
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    let payload: unknown = null
    try {
      payload = await req.json()
    } catch {
      payload = null
    }
    const p = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>
    const imageBase64 = p.imageBase64
    const mimeType = p.mimeType
    if (typeof imageBase64 !== "string" || imageBase64 === "" || typeof mimeType !== "string" || !mimeType.startsWith("image/")) {
      return NextResponse.json({ success: false, error: "Bad request" })
    }

    if (imageBase64.length > 6_000_000) {
      return NextResponse.json({ success: false, error: "Image too large" })
    }

    const typhoonKey = process.env.TYPHOON_API_KEY
    const typhoonMime = mimeType === "image/png" ? "image/png" : mimeType === "image/jpeg" || mimeType === "image/jpg" ? "image/jpeg" : null

    let typhoonStage: TyphoonStage = null
    let typhoonStatus: number | null = null
    let ocrText: string | null = null

    if (!typhoonKey) {
      typhoonStage = "skipped_no_key"
    } else if (!typhoonMime) {
      typhoonStage = "skipped_mime"
    } else {
      const t = await callTyphoon(typhoonKey, imageBase64, typhoonMime)
      if (t.ok) {
        ocrText = t.text
      } else {
        typhoonStage = t.stage
        typhoonStatus = t.status
      }
    }

    // หมวดของผู้ใช้ (RLS คัดเฉพาะของตัวเอง) — error = ไม่มีหมวด
    let categories: SlipCategory[] = []
    {
      const { data, error } = await createUserClient(req).from("categories").select("name, type")
      if (!error && Array.isArray(data)) categories = data as SlipCategory[]
    }

    const useTyphoon = ocrText !== null
    const provider: Provider = useTyphoon ? "typhoon+gemini" : "gemini"

    const gemini = useTyphoon
      ? await callGemini([{ text: buildSlipExtractPrompt(ocrText, categories) }])
      : await callGemini([
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: VISION_PROMPT },
        ])

    const result = parseOcrGeminiResponse(gemini.status, gemini.body)
    if (result.ok) {
      const data: OcrData = { ...result.data, category: matchCategory(result.data.category, categories, result.data.type) }
      return NextResponse.json({ success: true, data, meta: { provider, typhoonStage } })
    }
    const diag: RouteDiag = { ...result.diag, provider, typhoonStage, typhoonStatus }
    console.warn("ocr parse failed", diag)
    return NextResponse.json({ success: false, error: "Parse failed", diag })
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
