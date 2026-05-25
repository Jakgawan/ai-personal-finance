"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

type Recurring = {
  id: string
  name: string
  amount: number
  type: string
  category: string
  cycle: string
  start_date: string
  next_date: string
  is_active: boolean
  business_id: string | null
}

type Business = {
  id: string
  name: string
}

type CreatedLog = {
  name: string
  amount: number
  type: string
  date: string
}

const CYCLE_LABEL: Record<string, string> = {
  weekly: "ทุกสัปดาห์",
  monthly: "ทุกเดือน",
  yearly: "ทุกปี",
}

export default function RecurringSection() {
  const [items, setItems] = useState<Recurring[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Recurring | null>(null)
  const [loading, setLoading] = useState(false)
  const [createdLogs, setCreatedLogs] = useState<CreatedLog[]>([])
  const [showLog, setShowLog] = useState(false)
  const [activeTab, setActiveTab] = useState<"personal" | string>("personal")

  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [type, setType] = useState("expense")
  const [category, setCategory] = useState("")
  const [cycle, setCycle] = useState("monthly")
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0])
  const [businessId, setBusinessId] = useState<string>("")

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: rec }, { data: biz }] = await Promise.all([
      supabase.from("recurring_transactions").select("*").eq("user_id", user.id).order("next_date"),
      supabase.from("businesses").select("*").eq("user_id", user.id),
    ])

    setItems(rec || [])
    setBusinesses(biz || [])
  }

  useEffect(() => {
    fetchAll()
    processRecurring()
  }, [])

  const calcNextDate = (date: string, cycle: string) => {
    const d = new Date(date)
    if (cycle === "monthly") d.setMonth(d.getMonth() + 1)
    if (cycle === "weekly") d.setDate(d.getDate() + 7)
    if (cycle === "yearly") d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().split("T")[0]
  }

  const processRecurring = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split("T")[0]
    const { data } = await supabase
      .from("recurring_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .lte("next_date", today)

    if (!data || data.length === 0) return

    const logs: CreatedLog[] = []

    for (const item of data) {
      if (item.business_id) {
        await supabase.from("business_transactions").insert({
          user_id: user.id,
          business_id: item.business_id,
          name: item.name,
          amount: item.amount,
          type: item.type,
          category: item.category,
          date: item.next_date,
        })
      } else {
        await supabase.from("transactions").insert({
          user_id: user.id,
          name: item.name,
          amount: item.amount,
          type: item.type,
          category: item.category,
          date: item.next_date,
          note: "สร้างอัตโนมัติจากรายการซ้ำ",
        })
      }

      logs.push({
        name: item.name,
        amount: item.amount,
        type: item.type,
        date: item.next_date,
      })

      await supabase
        .from("recurring_transactions")
        .update({ next_date: calcNextDate(item.next_date, item.cycle) })
        .eq("id", item.id)
    }

    if (logs.length > 0) {
      setCreatedLogs(logs)
      setShowLog(true)
    }

    fetchAll()
  }

  const openAdd = (bizId?: string) => {
    setEditItem(null)
    setName(""); setAmount(""); setType("expense")
    setCategory(""); setCycle("monthly")
    setStartDate(new Date().toISOString().split("T")[0])
    setBusinessId(bizId || "")
    setShowModal(true)
  }

  const openEdit = (item: Recurring) => {
    setEditItem(item)
    setName(item.name); setAmount(String(item.amount))
    setType(item.type); setCategory(item.category || "")
    setCycle(item.cycle); setStartDate(item.start_date)
    setBusinessId(item.business_id || "")
    setShowModal(true)
  }

  const saveItem = async () => {
    if (!name || !amount) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

   const calcFirstNextDate = (date: string, cycle: string) => {
  const today = new Date().toISOString().split("T")[0]
  let d = new Date(date)
 while (d.toISOString().split("T")[0] <= today) {
    if (cycle === "monthly") d.setMonth(d.getMonth() + 1)
    if (cycle === "weekly") d.setDate(d.getDate() + 7)
    if (cycle === "yearly") d.setFullYear(d.getFullYear() + 1)
  }
  return d.toISOString().split("T")[0]
}

    const payload = {
        name, amount: Number(amount), type, category,
        cycle, start_date: startDate,
        next_date: calcFirstNextDate(startDate, cycle),
        user_id: user.id,
        business_id: businessId || null,
    }

    if (editItem) {
      await supabase.from("recurring_transactions").update(payload).eq("id", editItem.id)
    } else {
      await supabase.from("recurring_transactions").insert(payload)
    }

    setShowModal(false)
    setLoading(false)
    fetchAll()
  }

  const toggleActive = async (item: Recurring) => {
    await supabase.from("recurring_transactions").update({ is_active: !item.is_active }).eq("id", item.id)
    fetchAll()
  }

  const deleteItem = async (id: string) => {
    if (!confirm("ลบรายการซ้ำนี้?")) return
    await supabase.from("recurring_transactions").delete().eq("id", id)
    fetchAll()
  }

  // กรองตาม tab
  const tabItems = items.filter(i =>
    activeTab === "personal" ? !i.business_id : i.business_id === activeTab
  )
  const activeItems = tabItems.filter(i => i.is_active)
  const inactiveItems = tabItems.filter(i => !i.is_active)

  const totalMonthly = activeItems
    .filter(i => i.cycle === "monthly")
    .reduce((s, i) => i.type === "expense" ? s - i.amount : s + i.amount, 0)

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">รายการซ้ำอัตโนมัติ</h1>
        <button onClick={() => openAdd(activeTab === "personal" ? "" : activeTab)}
          className="bg-[#1D9E75] text-white rounded-lg px-4 py-2 text-sm hover:bg-[#178a64]">
          + เพิ่มรายการซ้ำ
        </button>
      </div>

      {showLog && createdLogs.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-[#1D9E75]">
              ✅ สร้างรายการอัตโนมัติ {createdLogs.length} รายการ
            </p>
            <button onClick={() => setShowLog(false)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
          </div>
          {createdLogs.map((log, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-600 py-1 border-t border-green-100">
              <span>{log.date} — {log.name}</span>
              <span className={log.type === "income" ? "text-[#1D9E75]" : "text-[#D85A30]"}>
                {log.type === "income" ? "+" : "-"}฿{Number(log.amount).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs — ส่วนตัว + แต่ละธุรกิจ */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("personal")}
          className={`px-4 py-2 rounded-lg text-sm font-medium shrink-0 transition-colors ${activeTab === "personal" ? "bg-[#1D9E75] text-white" : "bg-white text-gray-600 shadow-sm hover:bg-gray-100"}`}>
          👤 ส่วนตัว
        </button>
        {businesses.map(biz => (
          <button key={biz.id}
            onClick={() => setActiveTab(biz.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium shrink-0 transition-colors ${activeTab === biz.id ? "bg-[#1D9E75] text-white" : "bg-white text-gray-600 shadow-sm hover:bg-gray-100"}`}>
            🏢 {biz.name}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">รายการที่ active</p>
          <p className="text-xl font-bold text-gray-800">{activeItems.length} รายการ</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">ผลต่อเดือน</p>
          <p className={`text-xl font-bold ${totalMonthly >= 0 ? "text-[#1D9E75]" : "text-[#D85A30]"}`}>
            {totalMonthly >= 0 ? "+" : ""}฿{totalMonthly.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">รายการที่หยุดอยู่</p>
          <p className="text-xl font-bold text-gray-400">{inactiveItems.length} รายการ</p>
        </div>
      </div>

      {/* Active Items */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500">รายการที่เปิดอยู่</p>
        </div>
        {activeItems.length === 0 ? (
          <p className="text-sm text-gray-400 p-6 text-center">ยังไม่มีรายการซ้ำ กดเพิ่มได้เลย</p>
        ) : (
          activeItems.map(item => (
            <div key={item.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${item.type === "income" ? "bg-[#1D9E75]" : "bg-[#D85A30]"}`} />
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.name}</p>
                  <p className="text-xs text-gray-400">
                    {CYCLE_LABEL[item.cycle]} · ถัดไป {item.next_date}
                    {item.category && ` · ${item.category}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className={`text-sm font-semibold ${item.type === "income" ? "text-[#1D9E75]" : "text-[#D85A30]"}`}>
                  {item.type === "income" ? "+" : "-"}฿{Number(item.amount).toLocaleString()}
                </p>
                <button onClick={() => toggleActive(item)} className="text-xs text-gray-400 hover:text-[#D85A30]">หยุด</button>
                <button onClick={() => openEdit(item)} className="text-xs text-[#378ADD] hover:underline">แก้ไข</button>
                <button onClick={() => deleteItem(item.id)} className="text-xs text-[#D85A30] hover:underline">ลบ</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Inactive Items */}
      {inactiveItems.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500">รายการที่หยุดอยู่</p>
          </div>
          {inactiveItems.map(item => (
            <div key={item.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-100 last:border-0 opacity-50">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-gray-300" />
                <div>
                  <p className="text-sm font-medium text-gray-600">{item.name}</p>
                  <p className="text-xs text-gray-400">{CYCLE_LABEL[item.cycle]}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-400">฿{Number(item.amount).toLocaleString()}</p>
                <button onClick={() => toggleActive(item)} className="text-xs text-[#1D9E75] hover:underline">เปิดอีกครั้ง</button>
                <button onClick={() => deleteItem(item.id)} className="text-xs text-[#D85A30] hover:underline">ลบ</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="text-lg font-semibold text-gray-800">
                {editItem ? "แก้ไขรายการซ้ำ" : "เพิ่มรายการซ้ำ"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
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
              <input placeholder="ชื่อรายการ เช่น ค่าเช่า, Netflix" value={name} onChange={e => setName(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              <input placeholder="จำนวน (฿)" type="number" value={amount} onChange={e => setAmount(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              <input placeholder="หมวดหมู่ (optional)" value={category} onChange={e => setCategory(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              <select value={cycle} onChange={e => setCycle(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="weekly">ทุกสัปดาห์</option>
                <option value="monthly">ทุกเดือน</option>
                <option value="yearly">ทุกปี</option>
              </select>
              <select value={businessId} onChange={e => setBusinessId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">👤 ส่วนตัว</option>
                {businesses.map(b => <option key={b.id} value={b.id}>🏢 {b.name}</option>)}
              </select>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                                            วันเริ่มต้น 
                 <span className="text-yellow-500 ml-1">⚠️ ควรเป็นวันในอนาคต</span>
                </label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              </div>
              <div className="flex gap-3 mt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">ยกเลิก</button>
                <button onClick={saveItem} disabled={loading}
                  className="flex-1 bg-[#1D9E75] text-white rounded-lg py-2 text-sm hover:bg-[#178a64] disabled:opacity-50">
                  {loading ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}