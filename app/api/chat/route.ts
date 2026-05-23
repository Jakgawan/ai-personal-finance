import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { messages, financialContext } = await req.json()

const systemPrompt = `คุณคือที่ปรึกษาการเงินส่วนตัว ชื่อว่า ผู้ช่วยการเงิน
ข้อมูลการเงินของผู้ใช้:
${financialContext}

กฎการตอบ:
- ตอบด้วยภาษาเดียวกับที่ผู้ใช้ถาม ถ้าไม่แน่ใจให้ตอบเป็นภาษาไทยก่อน
- ตอบกระชับ ชัดเจน ให้คำแนะนำที่นำไปใช้ได้จริง
- ถามนอกเรื่องการเงิน ให้บอกว่าช่วยได้เฉพาะเรื่องการเงิน
- ผู้ใช้เป็นคนไทย ถ้าไม่แน่ใจให้ตอบเป็นภาษาไทยก่อน`
   
const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: messages.map((m: { role: string; content: string }) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        }),
      }
    )

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "ไม่สามารถตอบได้ในขณะนี้"
    return NextResponse.json({ reply: text })
  } catch (error) {
    return NextResponse.json({ reply: "เกิดข้อผิดพลาด กรุณาลองใหม่" }, { status: 500 })
  }
}