"use client"
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { KeyRound, AlertTriangle } from "lucide-react"
export default function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("กรุณากรอกอีเมล")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("รูปแบบอีเมลไม่ถูกต้อง")
      return
    }
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง")
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-md text-center">
          <p className="text-5xl mb-4">📧</p>
          <h2 className="text-xl font-bold text-gray-800 mb-2">ตรวจสอบอีเมลของคุณ</h2>
          <p className="text-sm text-gray-500 mb-2">เราส่งลิงก์รีเซ็ตรหัสผ่านไปที่</p>
          <p className="text-sm font-medium text-gray-800 mb-6">{email}</p>
          <p className="text-xs text-gray-400 mb-6">ไม่พบอีเมล? ตรวจสอบโฟลเดอร์ spam หรือลองใหม่อีกครั้ง</p>
          <a href="/login" className="block w-full bg-[#1D9E75] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#178a64] transition-colors text-center">
            กลับหน้าเข้าสู่ระบบ
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-md">

        <div className="text-center mb-8">
          <KeyRound size={40} className="text-[#1D9E75] mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-gray-800">ลืมรหัสผ่าน?</h1>
          <p className="text-sm text-gray-500 mt-1">กรอกอีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่าน</p>
        </div>

        <div className="flex flex-col gap-4">

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">อีเมล</label>
            <input
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError("") }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <p className="text-sm text-red-600 flex items-center gap-1.5">
  <AlertTriangle size={14} />
  {message}
</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-[#1D9E75] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#178a64] disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
          </button>

        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          จำรหัสผ่านได้แล้ว?{" "}
          <a href="/login" className="text-[#1D9E75] hover:underline font-medium">
            เข้าสู่ระบบ
          </a>
        </p>

      </div>
    </div>
  )
}