import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/supabase-server"
import { parseOcrGeminiResponse } from "@/lib/ocr-parse"

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { imageBase64, mimeType } = await req.json()

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64,
                }
              },
              {
                text: `ดูรูปสลิปหรือใบเสร็จนี้แล้วดึงข้อมูลออกมา ตอบเป็น JSON เท่านั้น ห้ามมี markdown หรือข้อความอื่น:
{
  "name": "ชื่อรายการหรือร้านค้า",
  "amount": ตัวเลขจำนวนเงิน (ไม่มีสัญลักษณ์),
  "date": "YYYY-MM-DD",
  "type": "expense หรือ income",
  "category": "หมวดหมู่ที่เหมาะสม"
}
ถ้าหาข้อมูลไม่เจอให้ใส่ค่าว่างหรือ null
ถ้าวันที่บนสลิปเป็นปีพุทธศักราช (พ.ศ.) ให้แปลงเป็นคริสต์ศักราช (ค.ศ.) โดยลบ 543`
              }
            ]
          }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING", nullable: true },
                amount: { type: "NUMBER", nullable: true },
                date: { type: "STRING", nullable: true, description: "YYYY-MM-DD, Gregorian (convert Buddhist Era year −543)" },
                type: { type: "STRING", enum: ["expense", "income"] },
                category: { type: "STRING", nullable: true },
              },
              required: ["type"],
            },
          },
        }),
      }
    )

    // ถ้า body ไม่ใช่ JSON ให้ถือเป็นความผิดพลาดจาก Gemini (ไม่เก็บเนื้อหา)
    let body: unknown = null
    let status = response.status
    try {
      body = await response.json()
    } catch {
      status = 502
    }

    const result = parseOcrGeminiResponse(status, body)
    if (result.ok) {
      return NextResponse.json({ success: true, data: result.data })
    }
    console.warn("ocr parse failed", result.diag)
    return NextResponse.json({ success: false, error: "Parse failed", diag: result.diag })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}