"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export default function DisplaySection() {
  const [showFloatingMenu, setShowFloatingMenu] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from("financial_profile")
        .select("show_floating_menu")
        .eq("user_id", user.id)
        .maybeSingle()
      setShowFloatingMenu(data?.show_floating_menu !== false)
    }
    load()
  }, [])

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
    await supabase.from("financial_profile").upsert({
      user_id: user.id,
      show_floating_menu: next,
      updated_at: new Date().toISOString(),
    })
    setLoading(false)
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">การแสดงผล</h2>

      <div className="bg-white rounded-xl p-6 shadow-sm flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-800">แสดงปุ่มเมนูลอย</p>
          <p className="text-xs text-gray-400 mt-1">
            ปุ่มลอยสีเขียวสำหรับเปิดเมนู ลากขึ้น-ลงได้ตามขอบจอ ถ้าปิดไว้จะมีแท็บ &quot;เพิ่มเติม&quot; ในแถบด้านล่างแทน
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
    </div>
  )
}
