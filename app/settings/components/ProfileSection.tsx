"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export default function ProfileSection() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email || "")
        setName(user.user_metadata?.name || "")
      }
    }
    getProfile()
  }, [])

  const handleSave = async () => {
    setLoading(true)
    const { error } = await supabase.auth.updateUser({
      data: { name }
    })
    setMessage(error ? "เกิดข้อผิดพลาด" : "บันทึกสำเร็จ ✅")
    setLoading(false)
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">บัญชีและโปรไฟล์</h2>

      <div className="bg-white rounded-xl p-6 shadow-sm flex flex-col gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">ชื่อ</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">อีเมล</label>
          <input
            type="text"
            value={email}
            disabled
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400"
          />
          <p className="text-xs text-gray-400 mt-1">ไม่สามารถเปลี่ยนอีเมลได้</p>
        </div>

        {message && (
          <p className="text-sm text-[#1D9E75]">{message}</p>
        )}

        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-[#1D9E75] text-white rounded-lg px-4 py-2 text-sm hover:bg-[#178a64] disabled:opacity-50 transition-colors"
        >
          {loading ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </div>
  )
}