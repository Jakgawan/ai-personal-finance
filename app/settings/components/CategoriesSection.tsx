"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Lightbulb, ClipboardList } from "lucide-react"

type Category = {
  id: string
  name: string
  type: string
  color: string
  icon: string
}

const COLORS = ["#1D9E75", "#D85A30", "#378ADD", "#F59E0B", "#8B5CF6", "#EC4899", "#6B7280"]

export default function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState("")
  const [type, setType] = useState("expense")
  const [color, setColor] = useState(COLORS[0])
  const [icon, setIcon] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const DEFAULT_CATEGORIES = [
  { name: "อาหาร", type: "expense", color: "#D85A30", icon: "🍔" },
  { name: "น้ำมัน", type: "expense", color: "#F59E0B", icon: "⛽" },
  { name: "ที่พัก", type: "expense", color: "#8B5CF6", icon: "🏠" },
  { name: "สุขภาพ", type: "expense", color: "#EC4899", icon: "💊" },
  { name: "บันเทิง", type: "expense", color: "#378ADD", icon: "🎮" },
  { name: "เสื้อผ้า", type: "expense", color: "#6B7280", icon: "👕" },
  { name: "ชำระหนี้", type: "expense", color: "#D85A30", icon: "💳" },
  { name: "อื่นๆ", type: "expense", color: "#6B7280", icon: "📦" },
  { name: "เงินเดือน", type: "income", color: "#1D9E75", icon: "💰" },
  { name: "รายได้เสริม", type: "income", color: "#1D9E75", icon: "💵" },
]

const handleLoadTemplate = async () => {
  if (!confirm("โหลด template หมวดหมู่? (จะเพิ่มเข้าไปในรายการที่มีอยู่)")) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from("categories").insert(
    DEFAULT_CATEGORIES.map(c => ({ ...c, user_id: user.id }))
  )
  fetchCategories()
}

  const fetchCategories = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", user.id)
      .order("type")
    setCategories(data || [])
  }

  useEffect(() => { fetchCategories() }, [])

  const handleSave = async () => {
    if (!name) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (editId) {
      await supabase.from("categories").update({ name, type, color, icon }).eq("id", editId)
      setEditId(null)
    } else {
      await supabase.from("categories").insert({ user_id: user.id, name, type, color, icon })
    }

    setName(""); setIcon(""); setColor(COLORS[0]); setType("expense")
    setLoading(false)
    fetchCategories()
  }

  const handleEdit = (cat: Category) => {
    setEditId(cat.id)
    setName(cat.name)
    setType(cat.type)
    setColor(cat.color || COLORS[0])
    setIcon(cat.icon || "")
  }

  const handleDelete = async (id: string) => {
    await supabase.from("categories").delete().eq("id", id)
    fetchCategories()
  }

  const income = categories.filter(c => c.type === "income")
  const expense = categories.filter(c => c.type === "expense")

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">หมวดหมู่รายการ</h2>

      {/* Form */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-4">
          {editId ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่ใหม่"}
        </h3>
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <input
              placeholder="Emoji icon เช่น 🍔"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
            />
            <input
              placeholder="ชื่อหมวดหมู่"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
            />
          </div>

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
          >
            <option value="expense">รายจ่าย</option>
            <option value="income">รายรับ</option>
          </select>

          <div>
            <p className="text-xs text-gray-500 mb-2">สี</p>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : ""}`}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-[#1D9E75] text-white rounded-lg px-4 py-2 text-sm hover:bg-[#178a64] disabled:opacity-50 transition-colors"
            >
              {editId ? "บันทึกการแก้ไข" : "เพิ่มหมวดหมู่"}
            </button>
            {editId && (
              <button
                onClick={() => { setEditId(null); setName(""); setIcon(""); setColor(COLORS[0]); setType("expense") }}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                ยกเลิก
              </button>
            )}
          </div>
        </div>
      </div>
      <button
  onClick={handleLoadTemplate}
  className="w-full border border-dashed border-gray-300 text-gray-500 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 mb-4"
>
  <span className="flex items-center justify-center gap-1.5">
  <ClipboardList size={14} />
  โหลด template หมวดหมู่เริ่มต้น
</span>
</button>

      {/* Lists */}
      {[{ label: "รายจ่าย", items: expense }, { label: "รายรับ", items: income }].map(({ label, items }) => (
        <div key={label} className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase">{label}</p>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 p-6">ยังไม่มีหมวดหมู่</p>
          ) : (
            items.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between px-6 py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                    style={{ backgroundColor: cat.color || "#eee" }}
                  >
                    {cat.icon || "•"}
                  </span>
                  <p className="text-sm text-gray-800">{cat.name}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(cat)} className="text-xs text-[#378ADD] hover:underline">แก้ไข</button>
                  <button onClick={() => handleDelete(cat.id)} className="text-xs text-[#D85A30] hover:underline">ลบ</button>
                </div>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  )
}