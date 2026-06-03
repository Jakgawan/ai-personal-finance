"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import ExportPDF from "@/app/components/ExportPDF"
import { formatDate } from "@/lib/utils"
import ScanSlip from "@/app/components/ScanSlip"

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
  const [view, setView] = useState<"list" | "calendar">("list")

  const [search, setSearch] = useState("")
  const [filterMonth, setFilterMonth] = useState("")
  const [filterCycle, setFilterCycle] = useState("")
  const [filterType, setFilterType] = useState("")
  const [filterCategory, setFilterCategory] = useState("")
  const [page, setPage] = useState(1)

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState("")
  const [type, setType] = useState("expense")
  const [category, setCategory] = useState("")
  const [cycleId, setCycleId] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)

  const [calendarDate, setCalendarDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

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

  const filtered = transactions.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchMonth = filterMonth ? t.date?.startsWith(filterMonth) : true
    const matchCycle = filterCycle ? t.cycle_id === filterCycle : true
    const matchType = filterType ? t.type === filterType : true
    const matchCat = filterCategory ? t.category === filterCategory : true
    return matchSearch && matchMonth && matchCycle && matchType && matchCat
  })

  const totalIncome = filtered.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0)

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
    setName(""); setAmount("")
    setDate(new Date().toISOString().split("T")[0])
    setType("expense")
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

  const exportExcel = async () => {
    const XLSX = await import("xlsx")
    const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date))
    let running = 0
    const rows = sorted.map(t => {
      running += t.type === "income" ? Number(t.amount) : -Number(t.amount)
      return {
        วันที่: t.date,
        รายการ: t.name,
        หมวด: t.category || "-",
        รายรับ: t.type === "income" ? Number(t.amount) : "",
        รายจ่าย: t.type === "expense" ? Number(t.amount) : "",
        คงเหลือ: running,
        หมายเหตุ: t.note || "-",
      }
    })
    const totalRow = {
      วันที่: "", รายการ: "รวมทั้งหมด", หมวด: "",
      รายรับ: totalIncome, รายจ่าย: totalExpense,
      คงเหลือ: totalIncome - totalExpense, หมายเหตุ: "",
    }
    const ws = XLSX.utils.json_to_sheet([...rows, {}, totalRow])
    ws["!cols"] = [
      { wch: 14 }, { wch: 25 }, { wch: 15 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
    ]
    rows.forEach((row, i) => {
      const rowIndex = i + 2
      if (row.รายรับ !== "") {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex - 1, c: 3 })
        ws[cellRef] = { v: row.รายรับ, t: "n", s: { font: { color: { rgb: "1D9E75" }, bold: true } } }
      }
      if (row.รายจ่าย !== "") {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex - 1, c: 4 })
        ws[cellRef] = { v: row.รายจ่าย, t: "n", s: { font: { color: { rgb: "D85A30" }, bold: true } } }
      }
      const balanceCellRef = XLSX.utils.encode_cell({ r: rowIndex - 1, c: 5 })
      ws[balanceCellRef] = {
        v: row.คงเหลือ, t: "n",
        s: { font: { color: { rgb: row.คงเหลือ >= 0 ? "1D9E75" : "D85A30" }, bold: true } }
      }
    })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "รายการ")
    XLSX.writeFile(wb, `transactions-${new Date().toISOString().split("T")[0]}.xlsx`)
  }

  const currentYear = new Date().getFullYear()
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, "0")
    const date = new Date(currentYear, i, 1)
    const label = date.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    return { value: `${currentYear}-${m}`, label }
  })

  const calYear = calendarDate.getFullYear()
  const calMonth = calendarDate.getMonth()
  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()

  const txByDay = transactions.reduce((acc, t) => {
    const d = t.date
    if (!acc[d]) acc[d] = []
    acc[d].push(t)
    return acc
  }, {} as Record<string, Transaction[]>)

  const selectedDayTx = selectedDay ? (txByDay[selectedDay] || []) : []

  const prevMonth = () => setCalendarDate(new Date(calYear, calMonth - 1, 1))
  const nextMonth = () => setCalendarDate(new Date(calYear, calMonth + 1, 1))

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">

      {/* Header — แยกเป็น 2 แถวบน mobile */}
      <div className="mb-6">

        {/* แถว 1 — ชื่อหน้า + ปุ่มเพิ่มรายการ */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-gray-800">รายการ</h1>
          <button
            onClick={openAddModal}
            className="bg-[#1D9E75] text-white rounded-lg px-4 py-2 text-sm hover:bg-[#178a64] flex items-center gap-1"
          >
            + เพิ่มรายการ
          </button>
        </div>

        {/* แถว 2 — ปุ่ม toggle + export */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle รายการ / ปฏิทิน */}
          <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setView("list")}
              className={`px-3 py-2 text-sm transition-colors ${view === "list" ? "bg-[#1D9E75] text-white" : "text-gray-500 hover:bg-gray-50"}`}
            >
              ☰ รายการ
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`px-3 py-2 text-sm transition-colors ${view === "calendar" ? "bg-[#1D9E75] text-white" : "text-gray-500 hover:bg-gray-50"}`}
            >
              📅 ปฏิทิน
            </button>
          </div>

          {/* Export buttons — รวมกันเป็นกลุ่ม */}
          <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={exportExcel}
              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 border-r border-gray-200 flex items-center gap-1"
            >
              📊 Excel
            </button>
            <ExportPDF />
            <ScanSlip onSuccess={fetchAll} />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[
          { label: "รายรับ", value: totalIncome, color: "text-[#1D9E75]" },
          { label: "รายจ่าย", value: totalExpense, color: "text-[#D85A30]" },
          { label: "ยอดคงเหลือ", value: totalIncome - totalExpense, color: (totalIncome - totalExpense) >= 0 ? "text-[#1D9E75]" : "text-[#D85A30]" },
          { label: "รายการทั้งหมด", value: filtered.length, color: "text-gray-800", unit: "รายการ" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-xl font-bold ${card.color}`}>
              {card.unit ? `${card.value} ${card.unit}` : `฿${Number(card.value).toLocaleString()}`}
            </p>
          </div>
        ))}
      </div>

      {/* LIST VIEW */}
      {view === "list" && (
        <>
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

          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["#", "วันที่", "รายการ", "หมวด", "รายรับ (฿)", "รายจ่าย (฿)", "หมายเหตุ", "จัดการ"].map(h => (
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
                          <td className="px-4 py-3 text-gray-600">{formatDate(t.date)}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{t.name}</td>
                          <td className="px-4 py-3 text-gray-500">{t.category || "-"}</td>
                          <td className="px-4 py-3 font-semibold text-[#1D9E75]">
                            {t.type === "income" ? `฿${Number(t.amount).toLocaleString()}` : ""}
                          </td>
                          <td className="px-4 py-3 font-semibold text-[#D85A30]">
                            {t.type === "expense" ? `฿${Number(t.amount).toLocaleString()}` : ""}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{t.note || "-"}</td>
                          <td className="px-4 py-3 flex gap-2">
                            <button onClick={() => openEditModal(t)} className="text-xs text-[#378ADD] hover:underline">แก้ไข</button>
                            <button onClick={() => handleDelete(t.id)} className="text-xs text-[#D85A30] hover:underline">ลบ</button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-gray-500">รวม</td>
                    <td className="px-4 py-3 text-sm font-bold text-[#1D9E75]">฿{totalIncome.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-bold text-[#D85A30]">฿{totalExpense.toLocaleString()}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

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

      {/* CALENDAR VIEW */}
      {view === "calendar" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="px-3 py-1 border rounded-lg text-sm hover:bg-gray-100">←</button>
              <h2 className="text-sm font-semibold text-gray-700">
                {calendarDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </h2>
              <button onClick={nextMonth} className="px-3 py-1 border rounded-lg text-sm hover:bg-gray-100">→</button>
            </div>
            <div className="grid grid-cols-7 mb-2">
              {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map(d => (
                <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                const dayTx = txByDay[dateStr] || []
                const dayIncome = dayTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0)
                const dayExpense = dayTx.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0)
                const isToday = dateStr === new Date().toISOString().split("T")[0]
                const isSelected = selectedDay === dateStr
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                    className={`rounded-xl p-1.5 text-center transition-colors min-h-14 ${isSelected ? "bg-[#1D9E75] text-white" : isToday ? "bg-green-50 border border-[#1D9E75]" : "hover:bg-gray-50"}`}
                  >
                    <p className={`text-xs font-semibold ${isSelected ? "text-white" : isToday ? "text-[#1D9E75]" : "text-gray-700"}`}>{day}</p>
                    {dayIncome > 0 && <p className={`text-xs ${isSelected ? "text-white" : "text-[#1D9E75]"}`}>+{dayIncome.toLocaleString()}</p>}
                    {dayExpense > 0 && <p className={`text-xs ${isSelected ? "text-white" : "text-[#D85A30]"}`}>-{dayExpense.toLocaleString()}</p>}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              {selectedDay ? `รายการ ${formatDate(selectedDay)}` : "กดวันเพื่อดูรายการ"}
            </h2>
            {selectedDay && (
              <>
                <div className="flex gap-3 mb-4">
                  <div className="flex-1 bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500">รายรับ</p>
                    <p className="text-sm font-bold text-[#1D9E75]">
                      ฿{selectedDayTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex-1 bg-red-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500">รายจ่าย</p>
                    <p className="text-sm font-bold text-[#D85A30]">
                      ฿{selectedDayTx.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                {selectedDayTx.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">ไม่มีรายการวันนี้</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selectedDayTx.map(t => (
                      <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{t.name}</p>
                          <p className="text-xs text-gray-400">{t.category || "-"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-semibold ${t.type === "income" ? "text-[#1D9E75]" : "text-[#D85A30]"}`}>
                            {t.type === "income" ? "+" : "-"}฿{Number(t.amount).toLocaleString()}
                          </p>
                          <button onClick={() => openEditModal(t)} className="text-xs text-[#378ADD] hover:underline">แก้ไข</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {
                    setEditId(null)
                    setName(""); setAmount("")
                    setDate(selectedDay!)
                    setType("expense")
                    setCategory(""); setCycleId(""); setNote("")
                    setShowModal(true)
                  }}
                  className="w-full mt-4 border border-dashed border-gray-300 text-gray-500 rounded-lg py-2 text-sm hover:border-[#1D9E75] hover:text-[#1D9E75] transition-colors"
                >
                  + เพิ่มรายการวันนี้
                </button>
              </>
            )}
          </div>
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
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">ยกเลิก</button>
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