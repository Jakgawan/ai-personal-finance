"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Wallet, PartyPopper, AlertTriangle, CheckCircle2 } from "lucide-react"

export default function Register() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const validate = (): string => {
    if (!email.trim()) return "กรุณากรอกอีเมล"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "รูปแบบอีเมลไม่ถูกต้อง"
    if (!password) return "กรุณากรอกรหัสผ่าน"
    if (password.length < 8) return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"
    if (!/[A-Z]/.test(password)) return "รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว"
    if (!/[0-9]/.test(password)) return "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว"
    if (!/[!@#$%^&*\-]/.test(password)) return "รหัสผ่านต้องมีอักขระพิเศษ เช่น !@#$% หรือ -"
    if (!confirmPassword) return "กรุณายืนยันรหัสผ่าน"
    if (password !== confirmPassword) return "รหัสผ่านไม่ตรงกัน"
    return ""
  }

  const handleRegister = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      if (error.message.includes("already registered")) {
        setError("อีเมลนี้มีบัญชีอยู่แล้ว")
      } else if (error.message.includes("invalid")) {
        setError("รูปแบบอีเมลไม่ถูกต้อง")
      } else {
        setError(error.message)
      }
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-md text-center">
          <PartyPopper size={48} className="text-[#1D9E75] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">สมัครสมาชิกสำเร็จ!</h2>
          <p className="text-sm text-gray-500 mb-6">ยินดีต้อนรับสู่ Finance App</p>
          <a href="/login" className="block w-full bg-[#1D9E75] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#178a64] transition-colors text-center">
            เข้าสู่ระบบเลย
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-md">

        <div className="text-center mb-8">
          <Wallet size={40} className="text-[#1D9E75] mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-gray-800">สร้างบัญชีใหม่</h1>
          <p className="text-sm text-gray-500 mt-1">เริ่มวางแผนการเงินของคุณ</p>
        </div>

        <div className="flex flex-col gap-4">

          {/* Email */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">อีเมล</label>
            <input
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError("") }}
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] transition-colors ${
                error && !email ? "border-red-300 bg-red-50" : "border-gray-200"
              }`}
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">รหัสผ่าน</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError("") }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
              >
                {showPassword ? "ซ่อน" : "แสดง"}
              </button>
            </div>
            {password && (
              <div className="mt-1.5 flex gap-1">
                {(() => {
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[!@#$%^&*\-]/.test(password)
  const hasLength = password.length >= 8
  const strength = [hasLength, hasUpper, hasNumber, hasSpecial].filter(Boolean).length
  return [1, 2, 3, 4].map(level => (
    <div
      key={level}
      className={`h-1 flex-1 rounded-full transition-colors ${
        strength >= level
          ? level <= 1 ? "bg-red-400"
            : level <= 2 ? "bg-yellow-400"
            : level <= 3 ? "bg-blue-400"
            : "bg-[#1D9E75]"
          : "bg-gray-100"
      }`}
    />
  ))
})()}
              </div>
            )}
          </div>
          {password && (
  <div className="mt-2 flex flex-col gap-1">
    {[
      { label: "อย่างน้อย 8 ตัวอักษร", pass: password.length >= 8 },
      { label: "ตัวพิมพ์ใหญ่ (A-Z)", pass: /[A-Z]/.test(password) },
      { label: "ตัวเลข (0-9)", pass: /[0-9]/.test(password) },
      { label: "อักขระพิเศษ (!@#$% หรือ -)", pass: /[!@#$%^&*\-]/.test(password) },
    ].map(({ label, pass }) => (
      <p key={label} className={`text-xs flex items-center gap-1 ${pass ? "text-[#1D9E75]" : "text-gray-400"}`}>
        {pass ? "✓" : "○"} {label}
      </p>
    ))}
  </div>
)}

          {/* Confirm Password */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">ยืนยันรหัสผ่าน</label>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="กรอกรหัสผ่านอีกครั้ง"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError("") }}
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] transition-colors ${
                confirmPassword && confirmPassword !== password
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200"
              }`}
            />
            {confirmPassword && confirmPassword === password && (
              <p className="text-xs text-[#1D9E75] mt-1 flex items-center gap-1">
  <CheckCircle2 size={12} />
  รหัสผ่านตรงกัน
</p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <p className="text-sm text-red-600 flex items-center gap-1.5">
  <AlertTriangle size={14} />
  {error}
</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full bg-[#1D9E75] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#178a64] disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
          </button>

        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          มีบัญชีแล้ว?{" "}
          <a href="/login" className="text-[#1D9E75] hover:underline font-medium">
            เข้าสู่ระบบ
          </a>
        </p>

      </div>
    </div>
  )
}