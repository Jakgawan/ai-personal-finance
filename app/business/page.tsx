"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"


type Business = {
  id: string
  name: string
  description: string
  user_id: string
}

type Transaction = {
  id: string
  name: string
  amount: number
  date: string
  type: string
  category: string
  business_id: string
}

const PAGE_SIZE = 10

export default function BusinessPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selected, setSelected] = useState<Business | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("")

  const [showBizModal, setShowBizModal] = useState(false)
  const [showTxModal, setShowTxModal] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)

  const [bizName, setBizName] = useState("")
  const [bizDesc, setBizDesc] = useState("")

  const [txName, setTxName] = useState("")
  const [txAmount, setTxAmount] = useState("")
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0])
  const [txType, setTxType] = useState("expense")
  const [txCategory, setTxCategory] = useState("")
  const [loading, setLoading] = useState(false)

  const fetchBusinesses = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from("businesses").select("*").eq("user_id", user.id)
    setBusinesses(data || [])
    if (data && data.length > 0 && !selected) {
      setSelected(data[0])
    }
  }

  const fetchTransactions = async (businessId: string) => {
    const { data } = await supabase
      .from("business_transactions")
      .select("*")
      .eq("business_id", businessId)
      .order("date", { ascending: false })
    setTransactions(data || [])
  }

  useEffect(() => { fetchBusinesses() }, [])
  useEffect(() => { if (selected) fetchTransactions(selected.id) }, [selected])

  const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0)
  const profit = totalIncome - totalExpense
  const profitMargin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0

  const filtered = transactions.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType ? t.type === filterType : true
    return matchSearch && matchType
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const saveBusiness = async () => {
    if (!bizName) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from("businesses").insert({ name: bizName, description: bizDesc, user_id: user.id })
    setBizName(""); setBizDesc("")
    setShowBizModal(false)
    setLoading(false)
    fetchBusinesses()
  }

  const deleteBusiness = async (id: string) => {
    if (!confirm("ลบธุรกิจนี้? รายการทั้งหมดจะถูกลบด้วย")) return
    await supabase.from("business_transactions").delete().eq("business_id", id)
    await supabase.from("businesses").delete().eq("id", id)
    setSelected(null)
    fetchBusinesses()
  }

  const openAddTx = () => {
    setEditTx(null)
    setTxName(""); setTxAmount(""); setTxDate(new Date().toISOString().split("T")[0])
    setTxType("expense"); setTxCategory("")
    setShowTxModal(true)
  }

  const openEditTx = (t: Transaction) => {
    setEditTx(t)
    setTxName(t.name); setTxAmount(String(t.amount)); setTxDate(t.date)
    setTxType(t.type); setTxCategory(t.category || "")
    setShowTxModal(true)
  }

  const saveTx = async () => {
    if (!txName || !txAmount || !selected) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      name: txName, amount: Number(txAmount), date: txDate,
      type: txType, category: txCategory,
      business_id: selected.id, user_id: user.id
    }

    if (editTx) {
      await supabase.from("business_transactions").update(payload).eq("id", editTx.id)
    } else {
      await supabase.from("business_transactions").insert(payload)
    }

    setShowTxModal(false)
    setLoading(false)
    fetchTransactions(selected.id)
  }
  useEffect(() => {
  const handler = () => openAddTx()
  window.addEventListener("openBusinessTxModal", handler)
  return () => window.removeEventListener("openBusinessTxModal", handler)
    }, [selected])

  const deleteTx = async (id: string) => {
    if (!confirm("ลบรายการนี้?")) return
    await supabase.from("business_transactions").delete().eq("id", id)
    if (selected) fetchTransactions(selected.id)
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">บัญชีธุรกิจ</h1>
        <button onClick={() => setShowBizModal(true)}
          className="bg-[#1D9E75] text-white rounded-lg px-4 py-2 text-sm hover:bg-[#178a64]">
          + เพิ่มธุรกิจ
        </button>
      </div>

      {/* Business Tabs */}
      {businesses.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center mb-6">
          <p className="text-4xl mb-3">🏢</p>
          <p className="text-gray-500 text-sm mb-4">ยังไม่มีธุรกิจ เพิ่มธุรกิจแรกได้เลย</p>
          <button onClick={() => setShowBizModal(true)}
            className="bg-[#1D9E75] text-white rounded-lg px-4 py-2 text-sm hover:bg-[#178a64]">
            + เพิ่มธุรกิจ
          </button>
        </div>
      ) : (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {businesses.map(biz => (
            <div key={biz.id} className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => { setSelected(biz); setPage(1) }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selected?.id === biz.id ? "bg-[#1D9E75] text-white" : "bg-white text-gray-600 hover:bg-gray-100 shadow-sm"}`}>
                🏢 {biz.name}
              </button>
              {selected?.id === biz.id && (
                <button onClick={() => deleteBusiness(biz.id)}
                  className="text-xs text-gray-400 hover:text-[#D85A30] px-1">✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "รายรับรวม", value: totalIncome, color: "text-[#1D9E75]" },
              { label: "รายจ่ายรวม", value: totalExpense, color: "text-[#D85A30]" },
              { label: "กำไรสุทธิ", value: profit, color: profit >= 0 ? "text-[#1D9E75]" : "text-[#D85A30]" },
              { label: "Profit Margin", value: profitMargin, color: "text-[#378ADD]", unit: "%" },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                <p className={`text-xl font-bold ${card.color}`}>
                  {card.unit ? `${profitMargin.toFixed(1)}%` : `฿${Number(card.value).toLocaleString()}`}
                </p>
              </div>
            ))}
          </div>

          {/* Filter + Add */}
          <div className="bg-white rounded-xl p-4 shadow-sm mb-4 flex flex-wrap gap-3 items-center">
            <input
              placeholder="ค้นหารายการ..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
            />
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="">ทุกประเภท</option>
              <option value="income">รายรับ</option>
              <option value="expense">รายจ่าย</option>
            </select>
            <button onClick={openAddTx}
              className="bg-[#1D9E75] text-white rounded-lg px-4 py-2 text-sm hover:bg-[#178a64]">
              + เพิ่มรายการ
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["#", "วันที่", "รายการ", "หมวด", "ประเภท", "จำนวน (฿)", "จัดการ"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">ยังไม่มีรายการ</td></tr>
                  ) : (
                    paginated.map((t, i) => (
                      <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                        <td className="px-4 py-3 text-gray-600">{t.date}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{t.name}</td>
                        <td className="px-4 py-3 text-gray-500">{t.category || "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${t.type === "income" ? "bg-green-100 text-[#1D9E75]" : "bg-red-100 text-[#D85A30]"}`}>
                            {t.type === "income" ? "รายรับ" : "รายจ่าย"}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-semibold ${t.type === "income" ? "text-[#1D9E75]" : "text-[#D85A30]"}`}>
                          {t.type === "income" ? "+" : "-"}฿{Number(t.amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 flex gap-2">
                          <button onClick={() => openEditTx(t)} className="text-xs text-[#378ADD] hover:underline">แก้ไข</button>
                          <button onClick={() => deleteTx(t.id)} className="text-xs text-[#D85A30] hover:underline">ลบ</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-gray-500">รวม</td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-800">
                      +฿{totalIncome.toLocaleString()} / -฿{totalExpense.toLocaleString()}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-100">← ก่อนหน้า</button>
              <span className="px-3 py-1 text-sm text-gray-600">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-100">ถัดไป →</button>
            </div>
          )}
        </>
      )}

      {/* Add Business Modal */}
      {showBizModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">เพิ่มธุรกิจใหม่</h2>
            <div className="flex flex-col gap-3">
              <input placeholder="ชื่อธุรกิจ" value={bizName} onChange={e => setBizName(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              <input placeholder="คำอธิบาย (optional)" value={bizDesc} onChange={e => setBizDesc(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowBizModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">ยกเลิก</button>
              <button onClick={saveBusiness} disabled={loading}
                className="flex-1 bg-[#1D9E75] text-white rounded-lg py-2 text-sm hover:bg-[#178a64] disabled:opacity-50">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Transaction Modal */}
      {showTxModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="text-lg font-semibold text-gray-800">{editTx ? "แก้ไขรายการ" : "เพิ่มรายการ"}</h2>
              <button onClick={() => setShowTxModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="px-6 pb-6 flex flex-col gap-3">
              <div className="flex gap-3">
                <button onClick={() => setTxType("expense")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${txType === "expense" ? "bg-[#D85A30] text-white border-[#D85A30]" : "border-gray-200 text-gray-600"}`}>
                  รายจ่าย
                </button>
                <button onClick={() => setTxType("income")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${txType === "income" ? "bg-[#1D9E75] text-white border-[#1D9E75]" : "border-gray-200 text-gray-600"}`}>
                  รายรับ
                </button>
              </div>
              <input placeholder="วันที่" type="date" value={txDate} onChange={e => setTxDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              <input placeholder="ชื่อรายการ" value={txName} onChange={e => setTxName(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              <input placeholder="จำนวน (฿)" type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              <input placeholder="หมวดหมู่ เช่น ต้นทุนสินค้า, ค่าการตลาด" value={txCategory} onChange={e => setTxCategory(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              <div className="flex gap-3 mt-2">
                <button onClick={() => setShowTxModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">ยกเลิก</button>
                <button onClick={saveTx} disabled={loading}
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