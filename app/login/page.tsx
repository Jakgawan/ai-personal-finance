"use client"
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Wallet, AlertTriangle } from "lucide-react"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)


  const handleLogin = async () => {
    if (!email || !password) {
      setMessage("กรุณากรอกอีเมลและรหัสผ่าน")
      return
    }
    setLoading(true)
    setMessage("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
if (error) {
  if (error.message.includes("Invalid login")) {
    setMessage("อีเมลหรือรหัสผ่านไม่ถูกต้อง")
  } else if (error.message.includes("Email not confirmed")) {
    setMessage("กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ")
  } else {
    setMessage("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่")
  }
} else {
  window.location.href = "/"
}
  }
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-md">

        <div className="text-center mb-8">
          <Wallet size={40} className="text-[#1D9E75] mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-gray-800">เข้าสู่ระบบ</h1>
          <p className="text-sm text-gray-500 mt-1">ยินดีต้อนรับกลับมา</p>
        </div>

        <div className="flex flex-col gap-4">

          {/* Email */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">อีเมล</label>
            <input
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setMessage("") }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">รหัสผ่าน</label>
              <a href="/forgot-password" className="text-xs text-[#378ADD] hover:underline">
                ลืมรหัสผ่าน?
              </a>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="รหัสผ่านของคุณ"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setMessage("") }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
              >
                {showPassword ? "ซ่อน" : "แสดง"}
              </button>
            </div>
          </div>

          {/* Error */}
          {message && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <p className="text-sm text-red-600 flex items-center gap-1.5">
  <AlertTriangle size={14} />
  {message}
</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-[#1D9E75] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#178a64] disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>

        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          ยังไม่มีบัญชี?{" "}
          <a href="/register" className="text-[#1D9E75] hover:underline font-medium">
            สมัครสมาชิก
          </a>
        </p>

      </div>
    </div>
  )
}