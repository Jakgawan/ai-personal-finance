"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import ConfirmModal from "@/app/components/ConfirmModal"
import { showToast } from "@/app/components/Toast"
import { MessageCircle } from "lucide-react"
import { pickActiveOpening } from "@/lib/opening-balance"
import { todayInBangkok, getNextIncomeDate, getPreviousIncomeDate } from "@/lib/income-schedule"
import { calcSpendable, getCurrentPeriod } from "@/lib/spendable"
import { summarizePeriod, buildFinancialContext, pickRecent } from "@/lib/period-summary"

type Transaction = {
  name: string
  amount: number
  type: string
  date: string
  kind: string | null
  envelope_id: string | null
  created_at: string
}

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
  const [contextReady, setContextReady] = useState(false)
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null)
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

  const CONTEXT_LOAD_FAILED = "โหลดข้อมูลการเงินของผู้ใช้ไม่สำเร็จ จึงไม่มีตัวเลขการเงิน ห้ามเดาหรือสมมติตัวเลข ให้แจ้งผู้ใช้ว่าดูข้อมูลไม่ได้ในตอนนี้"

  const loadFinancialContext = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setFinancialContext(CONTEXT_LOAD_FAILED)
        return
      }
      const [txRes, srcRes, cycleRes, profRes, openRes, assetRes, liabRes] = await Promise.all([
        supabase.from("transactions").select("name, amount, type, date, kind, envelope_id, created_at").eq("user_id", user.id).order("date", { ascending: false }),
        supabase.from("income_sources").select("schedule_type, monthly_days").eq("user_id", user.id),
        supabase.from("pay_cycles").select("start_day").eq("user_id", user.id),
        supabase.from("financial_profile").select("target_date").eq("user_id", user.id).maybeSingle(),
        supabase.from("opening_balances").select("amount, opening_date, created_at").eq("user_id", user.id),
        supabase.from("assets").select("value").eq("user_id", user.id),
        supabase.from("liabilities_long").select("balance").eq("user_id", user.id),
      ])

      if (txRes.error || srcRes.error || cycleRes.error || profRes.error || openRes.error || assetRes.error || liabRes.error) {
        // โหลดไม่ครบ -> ไม่ส่งตัวเลขศูนย์ให้ AI
        setFinancialContext(CONTEXT_LOAD_FAILED)
        showToast("โหลดข้อมูลการเงินไม่สำเร็จ", "error")
        return
      }

      const tx: Transaction[] = (txRes.data || []) as Transaction[]
      const incomeSources = (srcRes.data || []) as { schedule_type: string; monthly_days: number[] | null }[]
      const cycles = (cycleRes.data || []) as { start_day: number }[]
      const targetDate: string | null = (profRes.data as { target_date: string | null } | null)?.target_date ?? null
      const activeOpening = pickActiveOpening((openRes.data || []) as { amount: number | string; opening_date: string; created_at: string }[])

      // ช่วงรอบและวิธีนับเดียวกับหน้าแรก
      const today = todayInBangkok()
      const next = getNextIncomeDate(today, { incomeSources, payCycles: cycles, targetDate })
      const prev = getPreviousIncomeDate(today, { incomeSources, payCycles: cycles })
      const period = getCurrentPeriod(today, prev?.date ?? null, next.date, activeOpening?.opening_date ?? today)
      const { income, expense } = summarizePeriod(tx, period, today)
      const spend = activeOpening
        ? calcSpendable({
            today,
            opening: { amount: Number(activeOpening.amount), opening_date: activeOpening.opening_date },
            transactions: tx,
            nextIncomeDate: next.date,
          })
        : null

      const totalAssets = (assetRes.data || []).reduce((s, a) => s + Number(a.value), 0)
      const totalLiab = (liabRes.data || []).reduce((s, l) => s + Number(l.balance), 0)

      setFinancialContext(buildFinancialContext({
        period,
        income,
        expense,
        balanceNow: spend ? spend.balanceNow : null,
        daysLeftInclToday: period.daysLeftInclToday,
        totalAssets,
        totalLiabilities: totalLiab,
        recent: pickRecent(tx, today, 20),
      }))
    } catch {
      setFinancialContext(CONTEXT_LOAD_FAILED)
      showToast("โหลดข้อมูลการเงินไม่สำเร็จ", "error")
    } finally {
      setContextReady(true)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading || !contextReady) return

    const userMsg: Message = { role: "user", content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { error: userSaveError } = await supabase.from("chat_history").insert({
      user_id: user?.id,
      role: "user",
      content: userMsg.content,
    })
    // แจ้งเตือนแค่ครั้งเดียวต่อการสนทนา 1 รอบ (กัน toast ซ้ำถ้าบันทึกข้อความ AI พลาดด้วย)
    const saveFailedToastShown: boolean = !!userSaveError
    if (userSaveError) {
      showToast("บันทึกประวัติแชทไม่สำเร็จ", "error")
    }

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

      const { error: assistantSaveError } = await supabase.from("chat_history").insert({
        user_id: user?.id,
        role: "assistant",
        content: data.reply,
      })
      if (assistantSaveError && !saveFailedToastShown) {
        showToast("บันทึกประวัติแชทไม่สำเร็จ", "error")
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "เกิดข้อผิดพลาด กรุณาลองใหม่" }])
    }

    setLoading(false)
  }

  const clearHistory = () => {
    setConfirmState({
      message: "ล้างประวัติการสนทนาทั้งหมด?",
      onConfirm: async () => {
        setConfirmState(null)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { error } = await supabase.from("chat_history").delete().eq("user_id", user.id)
        if (error) {
          showToast("ล้างประวัติไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
          return
        }
        setMessages([])
      },
    })
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
            <MessageCircle size={36} className="text-gray-400 mx-auto mb-3" />
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
                  disabled={!contextReady}
                  className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 hover:border-[#1D9E75] hover:text-[#1D9E75] transition-colors disabled:opacity-50"
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
            disabled={loading || !contextReady || !input.trim()}
            className="bg-[#1D9E75] text-white rounded-xl px-4 py-2.5 text-sm hover:bg-[#178a64] disabled:opacity-50 transition-colors shrink-0"
          >
            ส่ง
          </button>
        </div>
        {!contextReady && (
          <p className="text-xs text-gray-400 text-center mt-2">กำลังโหลดข้อมูลการเงิน...</p>
        )}
        <p className="text-xs text-gray-400 text-center mt-2">Shift+Enter เพื่อขึ้นบรรทัดใหม่</p>
      </div>

      <ConfirmModal
        open={!!confirmState}
        message={confirmState?.message || ""}
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  )
}