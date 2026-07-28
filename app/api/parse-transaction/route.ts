import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { text, mode, categories } = await req.json()

    const categoryNames: string[] = Array.isArray(categories)
      ? categories.map((c: { name: string }) => c.name)
      : []

    const systemPrompt = `คุณคือระบบแปลงข้อความภาษาไทยเป็นรายการธุรกรรมการเงิน ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON

รูปแบบ JSON ที่ต้องตอบ:
{"name": string, "amount": number, "type": "income" หรือ "expense", "category": string หรือ null}

กฎ:
- amount เป็นตัวเลขบวกเสมอ (ห้ามติดลบ) ถ้าหาตัวเลขไม่ได้ให้ใส่ 0
- type: ถ้าข้อความสื่อถึงการได้รับเงิน/รายได้ ให้เป็น "income" ถ้าเป็นการจ่ายเงิน/ซื้อของ/ค่าใช้จ่าย ให้เป็น "expense" ถ้าไม่ชัดเจนให้เดาเป็น "expense"
- name: สรุปชื่อรายการสั้นๆ จากข้อความ
${categoryNames.length > 0
        ? `- category: เลือกจากรายการนี้เท่านั้น [${categoryNames.join(", ")}] ถ้าไม่มีหมวดที่เข้ากันให้ใส่ null`
        : `- category: ใส่ null เสมอ ไม่ต้องเดา`}`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    )

    const data = await response.json()
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) return NextResponse.json({ error: "no response" }, { status: 500 })

    const parsed = JSON.parse(raw)
    return NextResponse.json({
      name: typeof parsed.name === "string" ? parsed.name : "",
      amount: Number(parsed.amount) || 0,
      type: parsed.type === "income" ? "income" : "expense",
      category: mode === "full" && typeof parsed.category === "string" ? parsed.category : null,
    })
  } catch {
    return NextResponse.json({ error: "parse failed" }, { status: 500 })
  }
}
