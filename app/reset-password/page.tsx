"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { LockKeyhole, CheckCircle2 , AlertTriangle } from "lucide-react"

export default function ResetPassword() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        // Supabase set session ให้แล้ว พร้อมรับรหัสผ่านใหม่
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const validate = (): string => {
    if (!password) return "กรุณากรอกรหัสผ่านใหม่"
    if (password.length < 8) return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"
    if (!/[A-Z]/.test(password)) return "รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว"
    if (!/[0-9]/.test(password)) return "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว"
    if (!/[!@#$%^&*]/.test(password)) return "รหัสผ่านต้องมีอักขระพิเศษ เช่น !@#$%"
    if (!confirmPassword) return "กรุณายืนยันรหัสผ่าน"
    if (password !== confirmPassword) return "รหัสผ่านไม่ตรงกัน"
    return ""
  }

  const handleSubmit = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง")
    } else {
      setSuccess(true)
      setTimeout(() => router.push("/login"), 3000)
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-md text-center">
          <p className="text-5xl mb-4">✅</p>
          <h2 className="text-xl font-bold text-gray-800 mb-2">เปลี่ยนรหัสผ่านสำเร็จ!</h2>
          <p className="text-sm text-gray-500 mb-6">กำลังพาไปหน้าเข้าสู่ระบบ...</p>
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
          <LockKeyhole size={40} className="text-[#1D9E75] mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-gray-800">ตั้งรหัสผ่านใหม่</h1>
          <p className="text-sm text-gray-500 mt-1">กรอกรหัสผ่านใหม่ของคุณ</p>
        </div>

        <div className="flex flex-col gap-4">

          {/* Password */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">รหัสผ่านใหม่</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError("") }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
              >
                {showPassword ? "ซ่อน" : "แสดง"}
              </button>
            </div>

            {/* Requirement checklist */}
            {password && (
              <div className="mt-2 flex flex-col gap-1">
                {[
                  { label: "อย่างน้อย 8 ตัวอักษร", pass: password.length >= 8 },
                  { label: "ตัวพิมพ์ใหญ่ (A-Z)", pass: /[A-Z]/.test(password) },
                  { label: "ตัวเลข (0-9)", pass: /[0-9]/.test(password) },
                  { label: "อักขระพิเศษ /[!@#$%^&*\-]/", pass: /[!@#$%^&*\-]/.test(password) },
                ].map(({ label, pass }) => (
                  <p key={label} className={`text-xs flex items-center gap-1 ${pass ? "text-[#1D9E75]" : "text-gray-400"}`}>
                    {pass ? "✓" : "○"} {label}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">ยืนยันรหัสผ่านใหม่</label>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="กรอกรหัสผ่านอีกครั้ง"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError("") }}
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] transition-colors text-gray-800 ${
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

          {/* Error */}
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
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-[#1D9E75] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#178a64] disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
          </button>

        </div>

      </div>
    </div>
  )
}