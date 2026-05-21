"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

type Transaction = {
  id: string
  name: string
  amount: number
  date: string
  type: string
  category: string
  cycle_id: string | null
  note: string | null
}

type Category = {
  id: string
  name: string
  type: string
  color: string
  icon: string
}

type PayCycle = {
  id: string
  name: string
  start_day: number
  end_day: number
}

const PAGE_SIZE = 10

export default function TransactionPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [cycles, setCycles] = useState<PayCycle[]>([])

  // Filter state
  const [search, setSearch] = useState("")
  const [filterMonth, setFilterMonth] = useState("")
  const [filterCycle, setFilterCycle] = useState("")
  const [filterType, setFilterType] = useState("")
  const [filterCategory, setFilterCategory] = useState("")
  const [page, setPage] = useState(1)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState("")
  const [type, setType] = useState("expense")
  const [category, setCategory] = useState("")
  const [cycleId, setCycleId] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: txData }, { data: catData }, { data: cycleData }] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("categories").select("*").eq("user_id", user.id),
      supabase.from("pay_cycles").select("*").eq("user_id", user.id),
    ])

    setTransactions(txData || [])
    setCategories(catData || [])
    setCycles(cycleData || [])
  }

  useEffect(() => { fetchAll() }, [])

  // Filter logic
  const filtered = transactions.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchMonth = filterMonth ? t.date?.startsWith(filterMonth) : true
    const matchCycle = filterCycle ? t.cycle_id === filterCycle : true
    const matchType = filterType ? t.type === filterType : true
    const matchCat = filterCategory ? t.category === filterCategory : true
    return matchSearch && matchMonth && matchCycle && matchType && matchCat
  })

  // Summary
  const totalIncome = filtered.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0)
  const avgAmount = filtered.length ? (totalIncome + totalExpense) / filtered.length : 0

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Running balance
  const getBalance = (index: number) => {
    const all = [...filtered].reverse()
    let balance = 0
    for (let i = 0; i <= index; i++) {
      balance += all[i].type === "income" ? Number(all[i].amount) : -Number(all[i].amount)
    }
    return balance
  }

  const openAddModal = () => {
    setEditId(null)
    setName(""); setAmount(""); setDate(""); setType("expense")
    setCategory(""); setCycleId(""); setNote("")
    setShowModal(true)
  }

  const openEditModal = (t: Transaction) => {
    setEditId(t.id)
    setName(t.name); setAmount(String(t.amount)); setDate(t.date)
    setType(t.type); setCategory(t.category); setCycleId(t.cycle_id || ""); setNote(t.note || "")
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!name || !amount || !date) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      name, amount: Number(amount), date, type, category,
      cycle_id: cycleId || null, note: note || null, user_id: user.id
    }

    if (editId) {
      await supabase.from("transactions").update(payload).eq("id", editId)
    } else {
      await supabase.from("transactions").insert(payload)
    }

    setShowModal(false)
    setLoading(false)
    fetchAll()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("ลบรายการนี้?")) return
    await supabase.from("transactions").delete().eq("id", id)
    fetchAll()
  }

  const exportCSV = () => {
    const header = ["วันที่", "รายการ", "หมวด", "ประเภท", "จำนวน", "หมายเหตุ"]
    const rows = filtered.map(t => [t.date, t.name, t.category, t.type, t.amount, t.note || ""])
    const csv = [header, ...rows].map(r => r.join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "transactions.csv"; a.click()
  }

  // Month options
const currentYear = new Date().getFullYear()

const months = Array.from({ length: 12 }, (_, i) => {
  const m = String(i + 1).padStart(2, "0")
  const date = new Date(currentYear, i, 1)
  const label = date.toLocaleDateString(undefined, { month: "long", year: "numeric" })
  return { value: `${currentYear}-${m}`, label }
})

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">รายการ</h1>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="border border-gray-300 text-gray-600 rounded-lg px-4 py-2 text-sm hover:bg-gray-100">
            Export CSV
          </button>
          <button onClick={openAddModal} className="bg-[#1D9E75] text-white rounded-lg px-4 py-2 text-sm hover:bg-[#178a64]">
            + เพิ่มรายการ
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "รายรับ", value: totalIncome, color: "text-[#1D9E75]" },
          { label: "รายจ่าย", value: totalExpense, color: "text-[#D85A30]" },
          { label: "รายการทั้งหมด", value: filtered.length, color: "text-gray-800", unit: "รายการ" },
          { label: "เฉลี่ยต่อรายการ", value: avgAmount, color: "text-[#378ADD]" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-xl font-bold ${card.color}`}>
              {card.unit ? `${card.value} ${card.unit}` : `฿${Number(card.value).toLocaleString()}`}
            </p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4 flex flex-wrap gap-3">
        <input
          placeholder="ค้นหารายการ..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
        />
        <select value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">ทุกเดือน</option>
          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select value={filterCycle} onChange={(e) => { setFilterCycle(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">ทุกรอบ</option>
          {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">ทุกประเภท</option>
          <option value="income">รายรับ</option>
          <option value="expense">รายจ่าย</option>
        </select>
        <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">ทุกหมวด</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["#", "วันที่", "รายการ", "หมวด", "ประเภท", "จำนวน (฿)", "คงเหลือ (฿)", "จัดการ"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">ไม่มีรายการ</td></tr>
              ) : (
                paginated.map((t, i) => {
                  const realIndex = filtered.length - 1 - ((page - 1) * PAGE_SIZE + i)
                  const balance = getBalance(realIndex)
                  return (
                    <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
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
                      <td className="px-4 py-3 text-gray-700">฿{balance.toLocaleString()}</td>
                      <td className="px-4 py-3 flex gap-2">
                        <button onClick={() => openEditModal(t)} className="text-xs text-[#378ADD] hover:underline">แก้ไข</button>
                        <button onClick={() => handleDelete(t.id)} className="text-xs text-[#D85A30] hover:underline">ลบ</button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {/* Footer */}
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-gray-500">รวม</td>
                <td className="px-4 py-3 text-xs font-semibold text-gray-800">
                  +฿{totalIncome.toLocaleString()} / -฿{totalExpense.toLocaleString()}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-100">
            ← ก่อนหน้า
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-100">
            ถัดไป →
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {editId ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"}
            </h2>
            <div className="flex flex-col gap-3">
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
              <input placeholder="วันที่" type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              <input placeholder="ชื่อรายการ" value={name} onChange={(e) => setName(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              <input placeholder="จำนวน (฿)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">-- หมวดหมู่ --</option>
                {categories.filter(c => !c.type || c.type === type).map(c => (
                  <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                ))}
              </select>
              <select value={cycleId} onChange={(e) => setCycleId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">-- รอบเงินเดือน --</option>
                {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input placeholder="หมายเหตุ (optional)" value={note} onChange={(e) => setNote(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">
                ยกเลิก
              </button>
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 bg-[#1D9E75] text-white rounded-lg py-2 text-sm hover:bg-[#178a64] disabled:opacity-50">
                {loading ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}