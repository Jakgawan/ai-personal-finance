import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
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
ถ้าหาข้อมูลไม่เจอให้ใส่ค่าว่างหรือ null`
              }
            ]
          }]
        }),
      }
    )

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}"

    try {
      const parsed = JSON.parse(text)
      return NextResponse.json({ success: true, data: parsed })
    } catch {
      return NextResponse.json({ success: false, error: "Parse failed", raw: text })
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}