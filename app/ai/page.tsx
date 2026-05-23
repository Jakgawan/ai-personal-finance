"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import ReactMarkdown from "react-markdown"

type Message = {
  id?: string
  role: "user" | "assistant"
  content: string
  created_at?: string
}

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [financialContext, setFinancialContext] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadHistory()
    loadFinancialContext()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const loadHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("chat_history")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(50)
    setMessages((data || []) as Message[])
  }

  const loadFinancialContext = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: tx }, { data: assets }, { data: liab }] = await Promise.all([
      supabase.from("transactions").select("name, amount, type, category, date").eq("user_id", user.id).order("date", { ascending: false }).limit(20),
      supabase.from("assets").select("name, value, asset_group").eq("user_id", user.id),
      supabase.from("liabilities_long").select("name, balance").eq("user_id", user.id),
    ])

    const income = tx?.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0) || 0
    const expense = tx?.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0) || 0
    const totalAssets = assets?.reduce((s, a) => s + Number(a.value), 0) || 0
    const totalLiab = liab?.reduce((s, l) => s + Number(l.balance), 0) || 0

    const context = `
รายรับรวม: ฿${income.toLocaleString()}
รายจ่ายรวม: ฿${expense.toLocaleString()}
คงเหลือ: ฿${(income - expense).toLocaleString()}
สินทรัพย์รวม: ฿${totalAssets.toLocaleString()}
หนี้สินระยะยาว: ฿${totalLiab.toLocaleString()}
ความมั่งคั่งสุทธิ: ฿${(totalAssets - totalLiab).toLocaleString()}
รายการล่าสุด: ${tx?.slice(0, 5).map(t => `${t.name} ${t.type === "income" ? "+" : "-"}฿${t.amount}`).join(", ")}
    `.trim()

    setFinancialContext(context)
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMsg: Message = { role: "user", content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from("chat_history").insert({
      user_id: user?.id,
      role: "user",
      content: userMsg.content,
    })

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.slice(-10),
          financialContext,
        }),
      })

      const data = await res.json()
      const assistantMsg: Message = { role: "assistant", content: data.reply }

      setMessages(prev => [...prev, assistantMsg])

      await supabase.from("chat_history").insert({
        user_id: user?.id,
        role: "assistant",
        content: data.reply,
      })
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "เกิดข้อผิดพลาด กรุณาลองใหม่" }])
    }

    setLoading(false)
  }

  const clearHistory = async () => {
    if (!confirm("ล้างประวัติการสนทนาทั้งหมด?")) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from("chat_history").delete().eq("user_id", user.id)
    setMessages([])
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">ปรึกษาการเงิน</h1>
          <p className="text-xs text-gray-400">AI รู้ข้อมูลการเงินของคุณ ถามได้เลย</p>
        </div>
        <button onClick={clearHistory} className="text-xs text-gray-400 hover:text-[#D85A30]">
          ล้างประวัติ
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-gray-500 text-sm font-medium">ถามเรื่องการเงินได้เลย</p>
            <p className="text-gray-400 text-xs mt-1">AI รู้ข้อมูลรายรับ รายจ่าย และสินทรัพย์ของคุณ</p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {[
                "เดือนนี้ใช้เงินเยอะไปไหม?",
                "หมวดไหนใช้เงินเยอะสุด?",
                "แนะนำวิธีออมเงิน",
                "ควรลดค่าใช้จ่ายตรงไหน?",
              ].map(q => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 hover:border-[#1D9E75] hover:text-[#1D9E75] transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-[#1D9E75] text-white text-xs flex items-center justify-center mr-2 mt-1 shrink-0">
                AI
              </div>
            )}
            <div
              className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-[#1D9E75] text-white rounded-tr-sm"
                  : "bg-white text-gray-800 shadow-sm rounded-tl-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                    <ReactMarkdown>
                    {msg.content}
                    </ReactMarkdown>
                    ) : msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-[#1D9E75] text-white text-xs flex items-center justify-center mr-2 shrink-0">
              AI
            </div>
            <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex gap-2 items-end max-w-3xl mx-auto">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="ถามเรื่องการเงิน... (Enter เพื่อส่ง)"
            rows={1}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-[#1D9E75] text-white rounded-xl px-4 py-2.5 text-sm hover:bg-[#178a64] disabled:opacity-50 transition-colors shrink-0"
          >
            ส่ง
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">Shift+Enter เพื่อขึ้นบรรทัดใหม่</p>
      </div>
    </div>
  )
}