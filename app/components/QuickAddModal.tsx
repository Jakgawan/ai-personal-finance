"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Plus, Loader2, X, ChevronDown, ChevronUp } from "lucide-react"
import { showToast } from "./Toast"
import CategoryIcon from "./CategoryIcon"
import { todayLocal } from "@/lib/recurring"
import { topAmounts } from "@/lib/quick-amounts"

type Category = { id: string; name: string; type: string; icon: string; color?: string }
type Cycle = { id: string; name: string }

type Props = {
  open: boolean
  onClose: () => void
  mode: "simple" | "full"
  categories: Category[]
  cycles: Cycle[]
  // ค่าเริ่มต้นจากปุ่มบันทึกด่วน (ไม่ส่ง = เปิดจาก FAB แบบปกติ)
  initialAmount?: number | null
  initialType?: "expense" | "income"
  initialDate?: string | null
}

// รับเฉพาะตัวเลขกับจุดทศนิยม 1 จุด, ทศนิยมไม่เกิน 2 ตำแหน่ง
function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "")
  const firstDot = cleaned.indexOf(".")
  if (firstDot === -1) return cleaned
  const intPart = cleaned.slice(0, firstDot)
  const decPart = cleaned.slice(firstDot + 1).replace(/\./g, "").slice(0, 2)
  return `${intPart}.${decPart}`
}

export default function QuickAddModal({ open, onClose, mode, categories, cycles, initialAmount, initialType, initialDate }: Props) {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayLocal())
  const [type, setType] = useState<"expense" | "income">("expense")
  const [category, setCategory] = useState("")
  const [cycleId, setCycleId] = useState("")
  const [loading, setLoading] = useState(false)

  const [inputMode, setInputMode] = useState<"form" | "ai">("form")
  const [aiText, setAiText] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState("")

  const [showDetails, setShowDetails] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [categorySearch, setCategorySearch] = useState("")
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [categoryUsage, setCategoryUsage] = useState<{ category: string; type: string }[]>([])

  const [recentTx, setRecentTx] = useState<{ amount: number | string; type: string; date: string }[]>([])

  useEffect(() => {
    if (!open || mode !== "full") return
    const loadUsage = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from("transactions")
        .select("category, type")
        .eq("user_id", user.id)
        .not("category", "is", null)
        .order("date", { ascending: false })
        .limit(200)
      setCategoryUsage((data || []) as { category: string; type: string }[])
    }
    loadUsage()
  }, [open, mode])

  // ตัวเลขแนะนำ: โหลดรายการ 60 วันล่าสุด (ทุก mode) ถ้า error ก็แค่ไม่แสดงปุ่ม
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const loadRecent = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const d = new Date()
      d.setDate(d.getDate() - 59)
      const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, type, date")
        .eq("user_id", user.id)
        .gte("date", from)
        .order("date", { ascending: false })
        .limit(500)
      if (cancelled) return
      if (error) {
        setRecentTx([])
        return
      }
      setRecentTx((data || []) as { amount: number | string; type: string; date: string }[])
    }
    loadRecent()
    return () => { cancelled = true }
  }, [open])

  // เปิดพร้อมค่าเริ่มต้น -> ไปแท็บฟอร์ม ใส่ประเภท/จำนวนให้ (ไม่ focus อะไร)
  useEffect(() => {
    if (!open) return
    if (initialType === undefined && (initialAmount === undefined || initialAmount === null) && !initialDate) return
    setInputMode("form")
    if (initialType) setType(initialType)
    if (initialDate) {
      setDate(initialDate)
      if (initialDate !== todayLocal()) setShowDetails(true)
    }
    if (initialAmount !== undefined && initialAmount !== null) setAmount(sanitizeAmount(String(initialAmount)))
  }, [open, initialAmount, initialType, initialDate])

  useEffect(() => {
    if (open) return
    setName(""); setAmount(""); setDate(todayLocal())
    setType("expense"); setCategory(""); setCycleId("")
    setInputMode("form"); setAiText(""); setAiError(""); setShowAllCategories(false)
    setShowDetails(false)
    setRecentTx([])
    setCategorySearch(""); setCategoryDropdownOpen(false)
  }, [open])

  if (!open) return null

  const amountNum = Number(amount)
  const amountInvalid = !Number.isFinite(amountNum) || amountNum <= 0
  // "." อย่างเดียวไม่ขึ้นข้อความแดง แค่ปิดปุ่ม
  const amountError = amount !== "" && amount !== "." && amountInvalid ? "จำนวนเงินต้องมากกว่า 0" : ""
  const canSave = !loading && !amountInvalid && !!date

  const dateSummary = (() => {
    if (!date) return "ยังไม่ได้เลือกวันที่"
    if (date === todayLocal()) return "วันนี้"
    const [y, m, d] = date.split("-").map(Number)
    if (!y || !m || !d) return date
    return new Date(y, m - 1, d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
  })()
  const detailsSummary = [dateSummary, mode === "full" && category ? category : ""].filter(Boolean).join(" · ")

  const suggestedAmounts = topAmounts(recentTx, type, todayLocal())
  const typeColor = type === "expense" ? "#D85A30" : "#1D9E75"

  const categoriesForType = categories.filter(c => !c.type || c.type === type)

  const topCategories = (() => {
    const counts = new Map<string, number>()
    categoryUsage.filter(u => u.type === type).forEach(u => {
      counts.set(u.category, (counts.get(u.category) || 0) + 1)
    })
    const used = categoriesForType.filter(c => counts.has(c.name)).sort((a, b) => (counts.get(b.name) || 0) - (counts.get(a.name) || 0))
    const unused = categoriesForType.filter(c => !counts.has(c.name))
    return [...used, ...unused].slice(0, 4)
  })()

  const filteredCategories = categoriesForType.filter(c =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  )

  const handleParseAI = async () => {
    if (!aiText.trim()) return
    setAiLoading(true)
    setAiError("")
    try {
      const res = await fetch("/api/parse-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: aiText,
          mode,
          categories: mode === "full" ? categories.map(c => ({ name: c.name, type: c.type })) : [],
        }),
      })
      const data = await res.json()
      if (data.error) {
        setAiError("แปลงข้อความไม่สำเร็จ กรุณาลองใหม่")
        return
      }
      setName(data.name || "")
      setAmount(data.amount ? sanitizeAmount(String(data.amount)) : "")
      setType(data.type === "income" ? "income" : "expense")
      setCategory(mode === "full" ? (data.category || "") : "")
      setInputMode("form")
      if (data.name || (mode === "full" && data.category)) setShowDetails(true)
    } catch {
      setAiError("แปลงข้อความไม่สำเร็จ กรุณาลองใหม่")
    }
    setAiLoading(false)
  }

  const handleSave = async () => {
    if (!Number.isFinite(amountNum) || amountNum <= 0 || !date) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      name,
      amount: amountNum,
      date,
      type,
      category: category || null,
      cycle_id: cycleId || null,
    })
    if (error) {
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      setLoading(false)
      return
    }
    window.dispatchEvent(new CustomEvent("transactionAdded"))
    setLoading(false)
    onClose()
    showToast("บันทึกสำเร็จ")
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-lg font-semibold text-gray-800">บันทึกรายการ</h2>
          <button onClick={onClose} aria-label="ปิด" className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="px-6 flex gap-2 mb-3">
          <button onClick={() => setInputMode("form")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${inputMode === "form" ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-600"}`}>
            กรอกฟอร์ม
          </button>
          <button onClick={() => setInputMode("ai")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${inputMode === "ai" ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-600"}`}>
            พิมพ์บอก AI
          </button>
        </div>

        {inputMode === "ai" && (
          <div className="px-6 pb-4 flex flex-col gap-2">
            <textarea
              value={aiText}
              onChange={e => setAiText(e.target.value)}
              placeholder="เช่น ค่าข้าวเที่ยง 60 บาท"
              rows={2}
              disabled={aiLoading}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800 disabled:bg-gray-50 disabled:text-gray-400"
            />
            {aiError && <p className="text-xs text-[#D85A30]">{aiError}</p>}
            <button
              onClick={handleParseAI}
              disabled={aiLoading || !aiText.trim()}
              className="w-full bg-gray-800 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {aiLoading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" />
                  กำลังแปล...
                </span>
              ) : "แปลงข้อความ"}
            </button>
            <p className="text-xs text-gray-400">กด &quot;แปลงข้อความ&quot; แล้วตรวจสอบผลลัพธ์ก่อนบันทึก</p>
          </div>
        )}

        {inputMode === "form" && (
          <div className="px-6 pb-6 flex flex-col gap-3">
            <div className="flex gap-3">
              <button onClick={() => setType("expense")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${type === "expense" ? "bg-[#D85A30] text-white border-[#D85A30]" : "border-gray-200 text-gray-600"}`}>
                รายจ่าย
              </button>
              <button onClick={() => setType("income")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${type === "income" ? "bg-[#1D9E75] text-white border-[#1D9E75]" : "border-gray-200 text-gray-600"}`}>
                รายรับ
              </button>
            </div>
            <div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[1.5rem] font-semibold text-gray-400 pointer-events-none">฿</span>
                <input
                  placeholder="0"
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={amount}
                  onChange={e => setAmount(sanitizeAmount(e.target.value))}
                  onKeyDown={e => {
                    if (e.key === "Enter" && canSave) handleSave()
                  }}
                  className={`w-full border rounded-lg pl-10 pr-3 py-2.5 text-[1.5rem] font-semibold focus:outline-none focus:ring-2 text-gray-800 ${amountError ? "border-[#D85A30] focus:ring-[#D85A30]" : "border-gray-200 focus:ring-[#1D9E75]"}`}
                />
              </div>
              {amountError && <p className="text-xs text-[#D85A30] mt-1">{amountError}</p>}
              {suggestedAmounts.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {suggestedAmounts.map(x => {
                    const selected = amountNum === x
                    const label = x.toLocaleString("th-TH", { minimumFractionDigits: Number.isInteger(x) ? 0 : 2, maximumFractionDigits: 2 })
                    return (
                      <button
                        key={x}
                        type="button"
                        onClick={() => setAmount(sanitizeAmount(String(x)))}
                        aria-label={`ใส่จำนวน ฿${label}`}
                        style={selected ? { borderColor: typeColor, backgroundColor: `${typeColor}1A`, color: typeColor } : undefined}
                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${selected ? "font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                      >
                        ฿{label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={!canSave}
              className="w-full bg-[#1D9E75] text-white rounded-lg btn-height-token text-sm font-medium hover:bg-[#178a64] disabled:opacity-50 transition-colors"
            >
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </button>

            <button
              type="button"
              onClick={() => setShowDetails(v => !v)}
              aria-expanded={showDetails}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <span>เพิ่มรายละเอียด</span>
              {!showDetails && <span className={`text-xs ${date ? "text-gray-400" : "text-[#D85A30]"}`}>{detailsSummary}</span>}
            </button>

            {showDetails && (
              <div className="flex flex-col gap-3">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800"
            />
            <input
              placeholder="ชื่อรายการ เช่น ข้าวเที่ยง (ไม่บังคับ)"
              value={name}
              onChange={e => setName(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800"
            />
            {mode === "full" && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2 flex-wrap items-center">
                  {topCategories.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setCategory(category === c.name ? "" : c.name)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-colors ${category === c.name ? "bg-[#1D9E75] text-white border-[#1D9E75]" : "border-gray-200 text-gray-600"}`}
                    >
                      <CategoryIcon icon={c.icon} color={c.color} size="sm" selected={category === c.name} />
                      <span>{c.name}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setShowAllCategories(v => !v)
                      setCategorySearch(category)
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 shrink-0"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {showAllCategories && (
                  <div className="relative">
                    <input
                      type="text"
                      value={categorySearch}
                      onChange={e => { setCategorySearch(e.target.value); setCategoryDropdownOpen(true); if (category) setCategory("") }}
                      onFocus={() => setCategoryDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setCategoryDropdownOpen(false), 150)}
                      placeholder="พิมพ์ค้นหาหมวดหมู่..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800"
                    />
                    {categoryDropdownOpen && (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                        {filteredCategories.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-gray-400">ไม่พบหมวดหมู่</p>
                        ) : (
                          filteredCategories.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => {
                                setCategory(c.name)
                                setCategorySearch(c.name)
                                setCategoryDropdownOpen(false)
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${category === c.name ? "bg-green-50 text-[#1D9E75]" : "text-gray-700"}`}
                            >
                              <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                              <span>{c.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <select
                value={cycleId}
                onChange={e => setCycleId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none text-gray-800"
              >
                <option value="">-- รอบเงินเดือน --</option>
                {cycles.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">ไม่บังคับ — เลือกไว้เพื่อดูสรุปแยกตามรอบเงินเดือน</p>
            </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
