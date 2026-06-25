"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Lightbulb } from "lucide-react"

type PayCycle = {
  id: string
  name: string
  start_day: number
  end_day: number
}

export default function PayCyclesSection() {
  const [cycles, setCycles] = useState<PayCycle[]>([])
  const [name, setName] = useState("")
  const [startDay, setStartDay] = useState("")
  const [endDay, setEndDay] = useState("")
  const [loading, setLoading] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const fetchCycles = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("pay_cycles")
      .select("*")
      .eq("user_id", user.id)
      .order("start_day")
    setCycles(data || [])
  }

  useEffect(() => { fetchCycles() }, [])

  const handleSave = async () => {
    if (!name || !startDay || !endDay) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (editId) {
      await supabase.from("pay_cycles").update({
        name, start_day: Number(startDay), end_day: Number(endDay)
      }).eq("id", editId)
      setEditId(null)
    } else {
      await supabase.from("pay_cycles").insert({
        user_id: user.id,
        name,
        start_day: Number(startDay),
        end_day: Number(endDay)
      })
    }

    setName(""); setStartDay(""); setEndDay("")
    setLoading(false)
    fetchCycles()
  }

  const handleEdit = (cycle: PayCycle) => {
    setEditId(cycle.id)
    setName(cycle.name)
    setStartDay(String(cycle.start_day))
    setEndDay(String(cycle.end_day))
  }

  const handleDelete = async (id: string) => {
    await supabase.from("pay_cycles").delete().eq("id", id)
    fetchCycles()
  }

  // สร้างคำอธิบาย preview จากวันที่กรอก
  // ใช้ useMemo ไม่ได้เพราะเป็น derived value ธรรมดา คำนวณตรงๆ ได้เลย
  const getPreview = () => {
    if (!startDay || !endDay) return null
    const s = Number(startDay)
    const e = Number(endDay)
    if (isNaN(s) || isNaN(e)) return null

    if (s > e) {
      // รอบข้ามเดือน เช่น วันที่ 26 ถึง 25 ของเดือนถัดไป
      return `รับเงินวันที่ ${s} แล้วรอบสิ้นสุดวันที่ ${e} ของเดือนถัดไป`
    } else {
      // รอบปกติ เช่น วันที่ 1 ถึง 30
      return `รับเงินวันที่ ${s} แล้วรอบสิ้นสุดวันที่ ${e} ของเดือนเดียวกัน`
    }
  }

  const preview = getPreview()

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold text-gray-800 mb-2">รอบเงินเดือน</h2>

      {/* คำอธิบาย — บอกว่ารอบเงินเดือนคืออะไร */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-blue-700 mb-1 flex items-center gap-1.5">
  <Lightbulb size={14} />
  รอบเงินเดือนคืออะไร?
</p>
        <p className="text-xs text-blue-600 leading-relaxed">
          คือช่วงเวลาที่ใช้ติดตามรายรับ-รายจ่าย เช่น ถ้ารับเงินเดือนวันที่ 25
          ให้ตั้งวันเริ่ม 25 วันสิ้นสุด 24 แอพจะนับรายการตั้งแต่วันที่ 25 ถึง 24 ของเดือนถัดไป
        </p>
        <div className="mt-2 flex flex-col gap-1">
          {/* ตัวอย่างรอบที่พบบ่อย */}
          <p className="text-xs text-blue-500">ตัวอย่างที่พบบ่อย:</p>
          <p className="text-xs text-blue-600">• รับวันที่ 25 → วันเริ่ม 25, วันสิ้นสุด 24</p>
          <p className="text-xs text-blue-600">• รับวันที่ 1 → วันเริ่ม 1, วันสิ้นสุด 30</p>
          <p className="text-xs text-blue-600">• รับวันที่ 5 → วันเริ่ม 5, วันสิ้นสุด 4</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-4">
          {editId ? "แก้ไขรอบ" : "เพิ่มรอบใหม่"}
        </h3>
        <div className="flex flex-col gap-3">
          <input
            placeholder="ชื่อรอบ เช่น รอบ 5, รอบ 25"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">วันที่รับเงิน (วันเริ่ม)</label>
              <input
                placeholder="เช่น 25"
                type="number"
                min={1}
                max={31}
                value={startDay}
                onChange={(e) => setStartDay(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">วันสิ้นสุดรอบ</label>
              <input
                placeholder="เช่น 24"
                type="number"
                min={1}
                max={31}
                value={endDay}
                onChange={(e) => setEndDay(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
              />
            </div>
          </div>

          {/* Preview — แสดงทันทีเมื่อกรอกวันที่ */}
          {preview && (
            <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              <p className="text-xs text-[#1D9E75]">✓ {preview}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-[#1D9E75] text-white rounded-lg px-4 py-2 text-sm hover:bg-[#178a64] disabled:opacity-50 transition-colors"
            >
              {editId ? "บันทึกการแก้ไข" : "เพิ่มรอบ"}
            </button>
            {editId && (
              <button
                onClick={() => { setEditId(null); setName(""); setStartDay(""); setEndDay("") }}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                ยกเลิก
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {cycles.length === 0 ? (
          <p className="text-sm text-gray-400 p-6">ยังไม่มีรอบเงินเดือน กดเพิ่มได้เลย</p>
        ) : (
          cycles.map((cycle) => (
            <div key={cycle.id} className="flex items-center justify-between px-6 py-4 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{cycle.name}</p>
                {/* แสดงคำอธิบายแต่ละรอบที่บันทึกไว้ */}
                <p className="text-xs text-gray-400 mt-0.5">
                  วันที่ {cycle.start_day} — {cycle.end_day}
                  {cycle.start_day > cycle.end_day
                    ? ` (ข้ามเดือน)`
                    : ` (เดือนเดียวกัน)`
                  }
                </p>
                <p className="text-xs text-[#1D9E75] mt-0.5">
                  {/* อธิบายง่ายๆ ว่ารอบนี้คือช่วงไหน */}
                  รับเงินวันที่ {cycle.start_day} ของทุกเดือน
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(cycle)} className="text-xs text-[#378ADD] hover:underline">แก้ไข</button>
                <button onClick={() => handleDelete(cycle.id)} className="text-xs text-[#D85A30] hover:underline">ลบ</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}