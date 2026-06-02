"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import React from "react"
type PlanItem = {
  id: string
  section: "income" | "saving" | "fixed" | "variable"
  name: string
  monthly_amount: Record<string, number> // { "1": 5000, "2": 5000, ... }
}
const SECTIONS = [
  { key: "income", label: "รายรับ", color: "bg-green-50 text-[#1D9E75]" },
  { key: "saving", label: "ออมเงิน", color: "bg-blue-50 text-[#378ADD]" },
  { key: "fixed", label: "รายจ่ายคงที่", color: "bg-orange-50 text-[#D85A30]" },
  { key: "variable", label: "รายจ่ายผันแปร", color: "bg-gray-50 text-gray-600" },
] as const

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

const CURRENT_YEAR = new Date().getFullYear() // ค.ศ.
const BUDDHIST_YEAR = CURRENT_YEAR + 543
const TEMPLATE_ITEMS = [
  { section: "income", name: "เงินเดือน" },
  { section: "income", name: "รายได้เสริม" },
  { section: "saving", name: "เงินออมฉุกเฉิน" },
  { section: "saving", name: "เงินออมลงทุน" },
  { section: "saving", name: "เงินออมเป้าหมาย" },
  { section: "fixed", name: "ค่าเช่า/ผ่อนบ้าน" },
  { section: "fixed", name: "ค่าผ่อนรถ" },
  { section: "fixed", name: "ค่าประกันชีวิต" },
  { section: "fixed", name: "ชำระหนี้" },
  { section: "fixed", name: "ค่าโทรศัพท์/อินเทอร์เน็ต" },
  { section: "variable", name: "อาหาร" },
  { section: "variable", name: "เดินทาง/น้ำมัน" },
  { section: "variable", name: "ช้อปปิ้ง" },
  { section: "variable", name: "บันเทิง" },
  { section: "variable", name: "สุขภาพ/ยา" },
  { section: "variable", name: "ค่าสาธารณูปโภค" },
]

export default function PlanningPage() {
  const [items, setItems] = useState<PlanItem[]>([])
  const [year, setYear] = useState(CURRENT_YEAR)
  const [loading, setLoading] = useState(true)
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string | null>(null)

  const fetchItems = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("planning_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("year", year)
      .order("section")
    setItems((data || []) as PlanItem[])
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [year])

  const addItem = async (section: PlanItem["section"]) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from("planning_items").insert({
      user_id: user.id,
      year,
      section,
      name: "รายการใหม่",
      monthly_amount: {},
    })
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

  const rowTotal = (item: PlanItem) =>
    Object.values(item.monthly_amount).reduce((s, v) => s + v, 0)

  const colTotal = (sectionItems: PlanItem[], month: number) =>
    sectionItems.reduce((s, item) => s + (item.monthly_amount[String(month)] || 0), 0)

  const netByMonth = (month: number) => {
    const inc = items.filter(i => i.section === "income").reduce((s, i) => s + (i.monthly_amount[String(month)] || 0), 0)
    const out = items.filter(i => i.section !== "income").reduce((s, i) => s + (i.monthly_amount[String(month)] || 0), 0)
    return inc - out
  }

  if (loading) return <div className="p-8 text-gray-400">กำลังโหลด...</div>
  const loadTemplate = async () => {
  if (!confirm("โหลด template Money Coach? รายการที่มีอยู่จะยังคงอยู่")) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from("planning_items").insert(
    TEMPLATE_ITEMS.map(item => ({
      user_id: user.id,
      year,
      section: item.section,
      name: item.name,
      monthly_amount: {},
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
    if (!updated[String(m)]) {
      updated[String(m)] = firstValue
    }
  }
  await supabase.from("planning_items").update({ monthly_amount: updated }).eq("id", item.id)
  fetchItems()
}
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">วางแผนการเงิน</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="px-2 py-1 border rounded-lg text-sm hover:bg-gray-100">←</button>
          <span className="text-sm font-semibold text-gray-700">พ.ศ. {year + 543}</span>
          <button onClick={() => setYear(y => y + 1)} className="px-2 py-1 border rounded-lg text-sm hover:bg-gray-100">→</button>
          <button
            onClick={loadTemplate}
            title="โหลด template"
            className="border border-dashed border-gray-300 text-gray-400 rounded-lg px-2 py-1 text-xs hover:bg-gray-50"
          >
            📋<span className="hidden sm:inline"> template</span>
          </button>
        </div>
      </div>

      
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
                    
                    <tr key={`header-${sec.key}`} className="border-t border-gray-200">
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
                              <span
                                onClick={() => setEditingName(item.id)}
                                className="cursor-pointer hover:text-[#1D9E75] truncate max-w-28"
                              >{item.name}</span>
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

                    
                    <tr key={`add-${sec.key}`} className="border-t border-dashed border-gray-200">
                      <td colSpan={14} className="px-4 py-2">
                        <button
                          onClick={() => addItem(sec.key)}
                          className="text-xs text-gray-400 hover:text-[#1D9E75] hover:bg-green-50 px-2 py-1 rounded transition-colors"
                        >
                          + เพิ่มรายการ
                        </button>
                      </td>
                    </tr>

                    
                    <tr key={`total-${sec.key}`} className="border-t border-gray-200 bg-gray-50">
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
    </div>
        
  )
}