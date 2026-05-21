"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

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

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">รอบเงินเดือน</h2>

      {/* Form */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-4">
          {editId ? "แก้ไขรอบ" : "เพิ่มรอบใหม่"}
        </h3>
        <div className="flex flex-col gap-3">
          <input
            placeholder="ชื่อรอบ เช่น รอบ 5, รอบ 20"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
          />
          <div className="flex gap-3">
            <input
              placeholder="วันเริ่ม เช่น 21"
              type="number"
              value={startDay}
              onChange={(e) => setStartDay(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
            />
            <input
              placeholder="วันสิ้นสุด เช่น 5"
              type="number"
              value={endDay}
              onChange={(e) => setEndDay(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
            />
          </div>
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
          <p className="text-sm text-gray-400 p-6">ยังไม่มีรอบเงินเดือน</p>
        ) : (
          cycles.map((cycle) => (
            <div key={cycle.id} className="flex items-center justify-between px-6 py-3 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{cycle.name}</p>
                <p className="text-xs text-gray-400">วันที่ {cycle.start_day} — {cycle.end_day}</p>
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