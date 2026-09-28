"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { showToast } from "@/app/components/Toast"

export default function DisplaySection() {
  const [showFloatingMenu, setShowFloatingMenu] = useState(true)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<"simple" | "full">("simple")
  const [modeSaving, setModeSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from("financial_profile")
        .select("show_floating_menu, mode")
        .eq("user_id", user.id)
        .maybeSingle()
      setShowFloatingMenu(data?.show_floating_menu !== false)
      // ให้ตรงกับ Sidebar: mode ว่าง/แถวเก่า -> ถือเป็นแบบเต็ม (ผู้ใช้ไม่มีแถวจะถูกพาไป onboarding อยู่แล้ว)
      setMode(data?.mode === "simple" ? "simple" : "full")
    }
    load()
  }, [])

  const handleModeChange = async (next: "simple" | "full") => {
    if (next === mode || modeSaving) return
    const prev = mode
    setMode(next)
    window.dispatchEvent(new CustomEvent("profileModeChanged", { detail: { mode: next } }))

    setModeSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMode(prev)
      window.dispatchEvent(new CustomEvent("profileModeChanged", { detail: { mode: prev } }))
      setModeSaving(false)
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return
    }
    const { error } = await supabase.from("financial_profile").upsert({
      user_id: user.id,
      mode: next,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      setMode(prev)
      window.dispatchEvent(new CustomEvent("profileModeChanged", { detail: { mode: prev } }))
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
    }
    setModeSaving(false)
  }

  const handleToggle = async () => {
    const next = !showFloatingMenu
    setShowFloatingMenu(next)
    window.dispatchEvent(new CustomEvent("floatingMenuToggled", { detail: { show: next } }))

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    const { error } = await supabase.from("financial_profile").upsert({
      user_id: user.id,
      show_floating_menu: next,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      // ย้อนค่ากลับ เพราะ UI เปลี่ยนไปก่อนแล้วแต่บันทึกไม่สำเร็จ
      setShowFloatingMenu(!next)
      window.dispatchEvent(new CustomEvent("floatingMenuToggled", { detail: { show: !next } }))
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
    }
    setLoading(false)
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-heading-token text-gray-800 mb-6">การแสดงผล</h2>

      <div className="bg-white rounded-xl card-padding-token shadow-sm flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-800">แสดงปุ่มเมนูลอย</p>
          <p className="text-xs text-gray-400 mt-1">
            ปุ่มลอยสีเขียวสำหรับเปิดเมนู ลากขึ้น-ลงได้ตามขอบจอ ถ้าปิดไว้จะมีไอคอนเมนูมุมบนขวาแทน
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
            showFloatingMenu ? "bg-[#1D9E75]" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              showFloatingMenu ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className="bg-white rounded-xl card-padding-token shadow-sm mt-4">
        <p className="text-sm font-medium text-gray-800">โหมดการใช้งาน</p>
        <div role="radiogroup" aria-label="โหมดการใช้งาน" className="mt-3 grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-lg">
          {([
            { value: "simple", label: "แบบง่าย" },
            { value: "full", label: "แบบเต็ม" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={mode === opt.value}
              onClick={() => handleModeChange(opt.value)}
              disabled={modeSaving}
              className={`py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                mode === opt.value ? "bg-[#1D9E75] text-white" : "text-gray-600 hover:bg-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          แบบง่ายมีเมนูน้อย เน้นบันทึกรายการและดูยอดคงเหลือ แบบเต็มเพิ่มวางแผน งบการเงิน และปรึกษา AI
        </p>
      </div>
    </div>
  )
}
