"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import React from "react"
import { ClipboardList, BarChart2, Copy, Trash2 } from "lucide-react"

type PlanItem = {
  id: string
  section: "income" | "saving" | "fixed" | "variable"
  name: string
  category: string | null
  monthly_amount: Record<string, number>
}

const SECTIONS = [
  { key: "income", label: "รายรับ", color: "bg-green-50 text-[#1D9E75]" },
  { key: "saving", label: "ออมเงิน", color: "bg-blue-50 text-[#378ADD]" },
  { key: "fixed", label: "รายจ่ายคงที่", color: "bg-orange-50 text-[#D85A30]" },
  { key: "variable", label: "รายจ่ายผันแปร", color: "bg-gray-50 text-gray-600" },
] as const

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
const CURRENT_YEAR = new Date().getFullYear()

const TEMPLATE_ITEMS = [
  { section: "income", name: "เงินเดือน", category: "เงินเดือน" },
  { section: "income", name: "รายได้เสริม", category: "รายได้เสริม" },
  { section: "saving", name: "เงินออมฉุกเฉิน", category: "ออมเงิน" },
  { section: "saving", name: "เงินออมลงทุน", category: "ออมเงิน" },
  { section: "saving", name: "เงินออมเป้าหมาย", category: "ออมเงิน" },
  { section: "fixed", name: "ค่าเช่า/ผ่อนบ้าน", category: "ที่พัก" },
  { section: "fixed", name: "ค่าผ่อนรถ", category: "เดินทาง" },
  { section: "fixed", name: "ค่าประกันชีวิต", category: "ประกัน" },
  { section: "fixed", name: "ชำระหนี้", category: "ชำระหนี้" },
  { section: "fixed", name: "ค่าโทรศัพท์/อินเทอร์เน็ต", category: "สาธารณูปโภค" },
  { section: "variable", name: "อาหาร", category: "อาหาร" },
  { section: "variable", name: "เดินทาง/น้ำมัน", category: "เดินทาง" },
  { section: "variable", name: "ช้อปปิ้ง", category: "ช้อปปิ้ง" },
  { section: "variable", name: "บันเทิง", category: "บันเทิง" },
  { section: "variable", name: "สุขภาพ/ยา", category: "สุขภาพ" },
  { section: "variable", name: "ค่าสาธารณูปโภค", category: "สาธารณูปโภค" },
]

// สี RGB ของแต่ละ section สำหรับ Excel
const SECTION_COLORS: Record<string, string> = {
  income: "D1FAE5",   // เขียวอ่อน
  saving: "DBEAFE",   // น้ำเงินอ่อน
  fixed: "FFEDD5",    // ส้มอ่อน
  variable: "F3F4F6", // เทาอ่อน
}

export default function PlanningPage() {
  const [items, setItems] = useState<PlanItem[]>([])
  const [year, setYear] = useState(CURRENT_YEAR)
  const [loading, setLoading] = useState(true)
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [categories, setCategories] = useState<{id: string, name: string, type: string}[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [addSection, setAddSection] = useState<PlanItem["section"]>("income")
  const [addName, setAddName] = useState("")
  const [addCategory, setAddCategory] = useState("")
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [copyFrom, setCopyFrom] = useState(1)
  const [copyToMonths, setCopyToMonths] = useState<number[]>([])
  const [copyFromYear, setCopyFromYear] = useState(year)
  const [copyToYear, setCopyToYear] = useState(year)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetMonths, setResetMonths] = useState<number[]>([])

  const fetchItems = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const [{ data }, { data: catData }] = await Promise.all([
    supabase.from("planning_items").select("*").eq("user_id", user.id).eq("year", year).order("section"),
    supabase.from("categories").select("*").eq("user_id", user.id),
  ])
  setItems((data || []) as PlanItem[])
  setCategories(catData || [])
  setLoading(false)
}

  useEffect(() => { fetchItems() }, [year])

  const addItem = (section: PlanItem["section"]) => {
  setAddSection(section)
  setAddName("")
  setAddCategory("")
  setShowAddModal(true)
}
  const saveNewItem = async () => {
  if (!addName) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from("planning_items").insert({
    user_id: user.id, year, section: addSection,
    name: addName, category: addCategory || null, monthly_amount: {},
  })
  setShowAddModal(false)
  fetchItems()
}
 const copyMonth = async () => {
  if (copyToMonths.length === 0) return
  const toLabels = copyToMonths.map(m => MONTHS[m - 1]).join(", ")
  const yearLabel = copyFromYear !== copyToYear ? ` (พ.ศ. ${copyToYear + 543})` : ""
  if (!confirm(`copy จาก ${MONTHS[copyFrom - 1]} (พ.ศ. ${copyFromYear + 543}) ไป ${toLabels}${yearLabel}?`)) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // ถ้า copy ข้ามปี ต้องดึง items ของปีต้นทาง
  let sourceItems = items
  if (copyFromYear !== year) {
    const { data } = await supabase.from("planning_items").select("*").eq("user_id", user.id).eq("year", copyFromYear)
    sourceItems = (data || []) as PlanItem[]
  }

  if (copyFromYear === copyToYear) {
    // copy ภายในปีเดียวกัน
    for (const item of sourceItems) {
      const sourceValue = item.monthly_amount[String(copyFrom)] || 0
      if (sourceValue === 0) continue
      const updated = { ...item.monthly_amount }
      copyToMonths.forEach(m => { updated[String(m)] = sourceValue })
      await supabase.from("planning_items").update({ monthly_amount: updated }).eq("id", item.id)
    }
  } else {
    // copy ข้ามปี — สร้างรายการใหม่ในปีปลายทางถ้ายังไม่มี
    const { data: targetItems } = await supabase.from("planning_items").select("*").eq("user_id", user.id).eq("year", copyToYear)
    const existingNames = (targetItems || []).map((t: PlanItem) => t.name)

    for (const item of sourceItems) {
      const sourceValue = item.monthly_amount[String(copyFrom)] || 0
      if (sourceValue === 0) continue
      const newAmounts: Record<string, number> = {}
      copyToMonths.forEach(m => { newAmounts[String(m)] = sourceValue })

      if (existingNames.includes(item.name)) {
        // มีรายการอยู่แล้ว → update
        const target = (targetItems as PlanItem[]).find(t => t.name === item.name)
        if (target) {
          const merged = { ...target.monthly_amount, ...newAmounts }
          await supabase.from("planning_items").update({ monthly_amount: merged }).eq("id", target.id)
        }
      } else {
        // ยังไม่มี → insert ใหม่
        await supabase.from("planning_items").insert({
          user_id: user.id, year: copyToYear, section: item.section,
          name: item.name, category: item.category, monthly_amount: newAmounts,
        })
      }
    }
  }

  setShowCopyModal(false)
  setCopyToMonths([])
  fetchItems()
}
 const resetMonth = async () => {
  if (resetMonths.length === 0) return
  const labels = resetMonths.map(m => MONTHS[m - 1]).join(", ")
  if (!confirm(`ล้างข้อมูล ${labels}? ตัวเลขจะถูกลบ แต่ชื่อรายการยังอยู่`)) return

  for (const item of items) {
    const updated = { ...item.monthly_amount }
    let changed = false
    resetMonths.forEach(m => {
      if (updated[String(m)] !== undefined) {
        delete updated[String(m)]
        changed = true
      }
    })
    if (changed) {
      await supabase.from("planning_items").update({ monthly_amount: updated }).eq("id", item.id)
    }
  }

  setShowResetModal(false)
  setResetMonths([])
  fetchItems()
}

  const deleteItem = async (id: string) => {
    if (!confirm("ลบรายการนี้?")) return
    await supabase.from("planning_items").delete().eq("id", id)
    fetchItems()
  }

  const updateName = async (id: string, name: string) => {
    await supabase.from("planning_items").update({ name }).eq("id", id)
    setEditingName(null)
    fetchItems()
  }

  const updateAmount = async (item: PlanItem, month: number, value: string) => {
    const updated = { ...item.monthly_amount, [String(month)]: Number(value) || 0 }
    await supabase.from("planning_items").update({ monthly_amount: updated }).eq("id", item.id)
    setEditingCell(null)
    fetchItems()
  }

  const loadTemplate = async () => {
    if (!confirm("โหลด template Money Coach? รายการที่มีอยู่จะยังคงอยู่")) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from("planning_items").insert(
  TEMPLATE_ITEMS.map(item => ({
    user_id: user.id, year,
    section: item.section, name: item.name, category: item.category, monthly_amount: {},
  }))
)
    fetchItems()
  }

  const fillRow = async (item: PlanItem) => {
    const firstMonth = Object.keys(item.monthly_amount).sort()[0]
    if (!firstMonth) return
    const firstValue = item.monthly_amount[firstMonth]
    if (!confirm(`fill ฿${firstValue.toLocaleString()} ไปทุกเดือนที่ยังว่างอยู่?`)) return
    const updated = { ...item.monthly_amount }
    for (let m = 1; m <= 12; m++) {
      if (!updated[String(m)]) updated[String(m)] = firstValue
    }
    await supabase.from("planning_items").update({ monthly_amount: updated }).eq("id", item.id)
    fetchItems()
  }

  const rowTotal = (item: PlanItem) =>
    Object.values(item.monthly_amount).reduce((s, v) => s + v, 0)

  const colTotal = (sectionItems: PlanItem[], month: number) =>
    sectionItems.reduce((s, item) => s + (item.monthly_amount[String(month)] || 0), 0)

  const netByMonth = (month: number) => {
    const inc = items.filter(i => i.section === "income").reduce((s, i) => s + (i.monthly_amount[String(month)] || 0), 0)
    const out = items.filter(i => i.section !== "income").reduce((s, i) => s + (i.monthly_amount[String(month)] || 0), 0)
    return inc - out
  }

  const exportExcel = async () => {
    const XLSX = await import("xlsx")

    // สร้าง array of arrays สำหรับ worksheet
    // แต่ละ array = 1 แถว มี 14 column (รายการ + 12 เดือน + รวม)
    const wsData: (string | number)[][] = []

    // แถว title
    wsData.push([`แผนการเงิน พ.ศ. ${year + 543}`, ...Array(13).fill("")])
    wsData.push([]) // แถวว่าง

    // แถว header (รายการ + ม.ค. ถึง ธ.ค. + รวม)
    wsData.push(["รายการ", ...MONTHS, "รวม (฿)"])

    // วนแต่ละ section
    SECTIONS.forEach(sec => {
      const secItems = items.filter(i => i.section === sec.key)

      // แถวชื่อ section เช่น "รายรับ", "ออมเงิน"
      wsData.push([sec.label, ...Array(13).fill("")])

      // แถวข้อมูลแต่ละรายการ
      secItems.forEach(item => {
        const row: (string | number)[] = [item.name]
        let total = 0
        for (let m = 1; m <= 12; m++) {
          const val = item.monthly_amount[String(m)] || 0
          // val > 0 ใส่ตัวเลข ถ้า 0 ใส่ string ว่าง
          // ต้องบอก TypeScript ชัดๆ ว่าเป็น string หรือ number
          row.push(val > 0 ? val : "")
          total += val
        }
        row.push(total > 0 ? total : "")
        wsData.push(row)
      })

      // แถวรวมของ section
      const totalRow: (string | number)[] = [`รวม${sec.label}`]
      let sectionTotal = 0
      for (let m = 1; m <= 12; m++) {
        const t = colTotal(secItems, m)
        totalRow.push(t || "")
        sectionTotal += t
      }
      totalRow.push(sectionTotal || "")
      wsData.push(totalRow)

      wsData.push([]) // แถวว่างคั่น section
    })

    // แถวเงินเหลือสุทธิ
    const netRow: (string | number)[] = ["เงินเหลือสุทธิ"]
    let netTotal = 0
    for (let m = 1; m <= 12; m++) {
      const net = netByMonth(m)
      netRow.push(net || "")
      netTotal += net
    }
    netRow.push(netTotal || "")
    wsData.push(netRow)

    // สร้าง worksheet จาก array of arrays
    // aoa_to_sheet = array of arrays to sheet
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // กำหนดความกว้าง column
    ws["!cols"] = [
      { wch: 22 }, // รายการ
      ...Array(12).fill({ wch: 10 }), // 12 เดือน
      { wch: 12 }, // รวม
    ]

    // ใส่สีแถว section header และแถวรวม
    // วน wsData หาแถวที่ตรงกับ section label
    wsData.forEach((row, rowIdx) => {
      const label = row[0]

      // ถ้าเป็น section header ใส่พื้นหลังตามสี section
      const sec = SECTIONS.find(s => s.label === label)
      if (sec) {
        for (let c = 0; c < 14; c++) {
          const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c })
          if (!ws[cellRef]) ws[cellRef] = { v: c === 0 ? label : "", t: "s" }
          ws[cellRef].s = {
            fill: { fgColor: { rgb: SECTION_COLORS[sec.key] } },
            font: { bold: true },
          }
        }
      }

      // ถ้าเป็นแถวเงินเหลือสุทธิ ใส่สีเขียวอ่อน + ตัวหนา
      if (label === "เงินเหลือสุทธิ") {
        for (let c = 0; c < 14; c++) {
          const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c })
          if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" }
          ws[cellRef].s = {
            fill: { fgColor: { rgb: "D1FAE5" } },
            font: { bold: true, color: { rgb: "1D9E75" } },
          }
        }
      }
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `แผน ${year + 543}`)
    XLSX.writeFile(wb, `planning-${year + 543}.xlsx`)
  }

  if (loading) return <div className="p-8 text-gray-400">กำลังโหลด...</div>

  return (
    <div className="p-6 bg-gray-50 min-h-screen">

      {/* Header */}
      {/* Header — แยก 2 แถวบน mobile */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-gray-800">วางแผนการเงิน</h1>
          {/* ปุ่ม template + export รวมกลุ่ม */}
       <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
  <button
    onClick={loadTemplate}
    title="โหลด template"
    className="px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 border-r border-gray-200"
  >
    <ClipboardList size={14} /><span className="hidden sm:inline"> template</span>
  </button>
  <button
    onClick={() => setShowCopyModal(true)}
    title="copy เดือน"
    className="px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 border-r border-gray-200"
  >
    <Copy size={14} /><span className="hidden sm:inline"> copy</span>
  </button>
  <button
  onClick={() => setShowResetModal(true)}
  title="ล้างเดือน"
  className="px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 border-r border-gray-200"
>
  <Trash2 size={14} /><span className="hidden sm:inline"> ล้าง</span>
</button>
  <button
    onClick={exportExcel}
    title="Export Excel"
    className="px-3 py-2 text-xs text-gray-500 hover:bg-gray-50"
  >
    <BarChart2 size={14} /><span className="hidden sm:inline"> Excel</span>
  </button>
</div>
        </div>
        {/* ปุ่มเลือกปี อยู่แถวล่าง ไม่เบียดกัน */}
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-100">←</button>
          <span className="text-sm font-semibold text-gray-700">พ.ศ. {year + 543}</span>
          <button onClick={() => setYear(y => y + 1)} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-100">→</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {SECTIONS.map(sec => {
          const secItems = items.filter(i => i.section === sec.key)
          const total = secItems.reduce((s, i) => s + rowTotal(i), 0)
          return (
            <div key={sec.key} className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">{sec.label}</p>
              <p className="text-xl font-bold text-gray-800">฿{total.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{secItems.length} รายการ</p>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-gray-500 w-40">รายการ</th>
                {MONTHS.map((m, i) => (
                  <th key={i} className="px-2 py-3 text-center text-gray-500 w-16">{m}</th>
                ))}
                <th className="px-4 py-3 text-right text-gray-500 w-24">รวม (฿)</th>
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map(sec => {
                const secItems = items.filter(i => i.section === sec.key)
                return (
                  <React.Fragment key={sec.key}>
                    <tr className="border-t border-gray-200">
                      <td colSpan={14} className={`px-4 py-2 text-xs font-semibold ${sec.color}`}>
                        {sec.label}
                      </td>
                    </tr>
                    {secItems.map(item => (
                      <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2">
                          {editingName === item.id ? (
                            <input
                              autoFocus
                              defaultValue={item.name}
                              onBlur={(e) => updateName(item.id, e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && updateName(item.id, (e.target as HTMLInputElement).value)}
                              className="w-full border border-gray-300 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1D9E75]"
                            />
                          ) : (
                            <div className="flex items-center gap-1 group">
                              <div onClick={() => setEditingName(item.id)} className="cursor-pointer hover:text-[#1D9E75] truncate max-w-28">
                              <span>{item.name}</span>
                             {item.category && item.category !== item.name && <p className="text-xs text-gray-400">{item.category}</p>}
                              </div>
                              <button
                                onClick={() => deleteItem(item.id)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs ml-1"
                              >✕</button>
                            </div>
                          )}
                        </td>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                          const cellKey = `${item.id}-${month}`
                          const val = item.monthly_amount[String(month)] || 0
                          return (
                            <td key={month} className="px-1 py-2 text-center">
                              {editingCell === cellKey ? (
                                <input
                                  autoFocus
                                  type="number"
                                  defaultValue={val || ""}
                                  onBlur={(e) => updateAmount(item, month, e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && updateAmount(item, month, (e.target as HTMLInputElement).value)}
                                  className="w-14 border border-gray-300 rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[#1D9E75]"
                                />
                              ) : (
                                <span
                                  onClick={() => setEditingCell(cellKey)}
                                  className={`cursor-pointer px-1 py-0.5 rounded hover:bg-gray-100 ${val ? "text-gray-800" : "text-gray-300"}`}
                                >
                                  {val ? val.toLocaleString() : "—"}
                                </span>
                              )}
                            </td>
                          )
                        })}
                        <td className="px-4 py-2 text-right font-semibold text-gray-700">
                          {rowTotal(item).toLocaleString()}
                        </td>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => fillRow(item)}
                            className="text-xs text-gray-400 hover:text-[#1D9E75] px-2 py-1 rounded hover:bg-green-50 transition-colors whitespace-nowrap"
                            title="copy ค่าเดือนแรกไปทุกเดือน"
                          >
                            fill →
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-dashed border-gray-200">
                      <td colSpan={14} className="px-4 py-2">
                        <button
                          onClick={() => addItem(sec.key)}
                          className="text-xs text-gray-400 hover:text-[#1D9E75] hover:bg-green-50 px-2 py-1 rounded transition-colors"
                        >
                          + เพิ่มรายการ
                        </button>
                      </td>
                    </tr>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td className="px-4 py-2 text-xs font-semibold text-gray-500">รวม{sec.label}</td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                        <td key={month} className="px-1 py-2 text-center text-xs font-semibold text-gray-700">
                          {colTotal(secItems, month) ? colTotal(secItems, month).toLocaleString() : "—"}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right text-xs font-semibold text-gray-700">
                        {secItems.reduce((s, i) => s + rowTotal(i), 0).toLocaleString()}
                      </td>
                    </tr>
                  </React.Fragment>
                )
              })}
              <tr className="border-t-2 border-gray-300 bg-green-50">
                <td className="px-4 py-3 text-xs font-bold text-[#1D9E75]">เงินเหลือสุทธิ</td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                  const net = netByMonth(month)
                  return (
                    <td key={month} className={`px-1 py-3 text-center text-xs font-bold ${net >= 0 ? "text-[#1D9E75]" : "text-[#D85A30]"}`}>
                      {net ? net.toLocaleString() : "—"}
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-right text-xs font-bold text-[#1D9E75]">
                  {Array.from({ length: 12 }, (_, i) => i + 1).reduce((s, m) => s + netByMonth(m), 0).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {/* Add Item Modal */}
{showAddModal && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">เพิ่มรายการ</h2>
      <div className="flex flex-col gap-3">
        <input
          placeholder="ชื่อรายการ"
          value={addName}
          onChange={e => setAddName(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800"
        />
        <select
          value={addCategory}
          onChange={e => setAddCategory(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-gray-800"
        >
          <option value="">-- เลือกหมวดหมู่ --</option>
          {categories.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-3 mt-5">
        <button onClick={() => setShowAddModal(false)}
          className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50 text-gray-700">
          ยกเลิก
        </button>
        <button onClick={saveNewItem}
          className="flex-1 bg-[#1D9E75] text-white rounded-lg py-2 text-sm hover:bg-[#178a64] disabled:opacity-50"
          disabled={!addName}>
          บันทึก
        </button>
      </div>
    </div>
  </div>
)}
{/* Copy Month Modal */}
{showCopyModal && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">copy ข้อมูลเดือน</h2>
      <div className="flex flex-col gap-3">

        {/* ปีต้นทาง + เดือนต้นทาง */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">จากปี</label>
          <select value={copyFromYear} onChange={e => setCopyFromYear(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-gray-800">
            {[year - 1, year, year + 1].map(y => (
              <option key={y} value={y}>พ.ศ. {y + 543}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">จากเดือน</label>
          <select value={copyFrom} onChange={e => setCopyFrom(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-gray-800">
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>

        {/* ปีปลายทาง */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">ไปปี</label>
          <select value={copyToYear} onChange={e => setCopyToYear(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-gray-800">
            {[year - 1, year, year + 1].map(y => (
              <option key={y} value={y}>พ.ศ. {y + 543}</option>
            ))}
          </select>
        </div>

        {/* เลือกหลายเดือนปลายทาง */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">ไปเดือน (เลือกได้หลายเดือน)</label>
          <div className="grid grid-cols-4 gap-1.5">
            {MONTHS.map((m, i) => {
              const month = i + 1
              const selected = copyToMonths.includes(month)
              const isSameMonth = copyFromYear === copyToYear && month === copyFrom
              return (
                <button key={i}
                  disabled={isSameMonth}
                  onClick={() => setCopyToMonths(
                    selected ? copyToMonths.filter(x => x !== month) : [...copyToMonths, month]
                  )}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    isSameMonth ? "bg-gray-100 text-gray-300 border-gray-100" :
                    selected ? "bg-[#1D9E75] text-white border-[#1D9E75]" :
                    "border-gray-200 text-gray-600 hover:border-[#1D9E75]"
                  }`}>
                  {m}
                </button>
              )
            })}
          </div>
          <button onClick={() => {
            const all = MONTHS.map((_, i) => i + 1).filter(m => !(copyFromYear === copyToYear && m === copyFrom))
            setCopyToMonths(copyToMonths.length === all.length ? [] : all)
          }}
            className="text-xs text-[#378ADD] mt-1.5 hover:underline">
            {copyToMonths.length === 11 ? "ยกเลิกทั้งหมด" : "เลือกทั้งปี"}
          </button>
        </div>

        {copyToMonths.length === 0 && (
          <p className="text-xs text-[#D85A30]">กรุณาเลือกเดือนปลายทางอย่างน้อย 1 เดือน</p>
        )}
      </div>
      <div className="flex gap-3 mt-5">
        <button onClick={() => { setShowCopyModal(false); setCopyToMonths([]) }}
          className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50 text-gray-700">
          ยกเลิก
        </button>
        <button onClick={copyMonth}
          className="flex-1 bg-[#1D9E75] text-white rounded-lg py-2 text-sm hover:bg-[#178a64] disabled:opacity-50"
          disabled={copyToMonths.length === 0}>
          copy ({copyToMonths.length} เดือน)
        </button>
      </div>
    </div>
  </div>
)}
{/* Reset Month Modal */}
{showResetModal && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">ล้างข้อมูลเดือน</h2>
      <p className="text-xs text-gray-400 mb-3">เลือกเดือนที่ต้องการล้าง ตัวเลขจะถูกลบ แต่ชื่อรายการยังอยู่</p>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-1.5">
          {MONTHS.map((m, i) => {
            const month = i + 1
            const selected = resetMonths.includes(month)
            return (
              <button key={i}
                onClick={() => setResetMonths(
                  selected ? resetMonths.filter(x => x !== month) : [...resetMonths, month]
                )}
                className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  selected ? "bg-[#D85A30] text-white border-[#D85A30]" :
                  "border-gray-200 text-gray-600 hover:border-[#D85A30]"
                }`}>
                {m}
              </button>
            )
          })}
        </div>
        <button onClick={() => setResetMonths(resetMonths.length === 12 ? [] : MONTHS.map((_, i) => i + 1))}
          className="text-xs text-[#378ADD] hover:underline">
          {resetMonths.length === 12 ? "ยกเลิกทั้งหมด" : "เลือกทั้งปี"}
        </button>
        {resetMonths.length === 0 && (
          <p className="text-xs text-[#D85A30]">กรุณาเลือกเดือนอย่างน้อย 1 เดือน</p>
        )}
      </div>
      <div className="flex gap-3 mt-5">
        <button onClick={() => { setShowResetModal(false); setResetMonths([]) }}
          className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50 text-gray-700">
          ยกเลิก
        </button>
        <button onClick={resetMonth}
          className="flex-1 bg-[#D85A30] text-white rounded-lg py-2 text-sm hover:bg-red-600 disabled:opacity-50"
          disabled={resetMonths.length === 0}>
          ล้าง ({resetMonths.length} เดือน)
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  )
}