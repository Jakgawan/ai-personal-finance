"use client"

import { useState, useEffect } from "react"
import { Wallet, Sparkles, LayoutGrid, Check, Loader2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { showToast } from "@/app/components/Toast"

type Mode = "simple" | "full"

const OPTIONS: { value: Mode; title: string; desc: string; icon: LucideIcon }[] = [
  {
    value: "simple",
    title: "แบบง่าย",
    desc: "บันทึกรายรับ-รายจ่ายและดูยอดคงเหลือ เมนูน้อย ใช้ง่าย",
    icon: Sparkles,
  },
  {
    value: "full",
    title: "แบบเต็ม",
    desc: "เพิ่มวางแผนงบประมาณ งบการเงิน (สินทรัพย์/หนี้สิน) และปรึกษา AI",
    icon: LayoutGrid,
  },
]

export default function OnboardingPage() {
  const [mode, setMode] = useState<Mode>("simple")
  const [saving, setSaving] = useState<boolean>(false)
  const [checking, setChecking] = useState<boolean>(true)

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setChecking(false)
        return
      }
      const { data, error } = await supabase
        .from("financial_profile")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle()
      // มีแถวอยู่แล้ว = เคยเลือกโหมดแล้ว ไม่ต้องถามซ้ำ
      if (!error && data) {
        window.location.href = "/"
        return
      }
      setChecking(false)
    }
    check()
  }, [])

  const handleSubmit = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return
    }
    const { error } = await supabase.from("financial_profile").upsert({
      user_id: user.id,
      mode,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      setSaving(false)
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return
    }
    // โหลดหน้าใหม่ทั้งหน้า เพื่อให้ Sidebar อ่านค่า mode ใหม่
    window.location.href = "/"
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#1D9E75]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm card-padding-token">
        <div className="flex justify-center mb-4">
          <span className="w-12 h-12 rounded-full bg-[#1D9E75] text-white flex items-center justify-center">
            <Wallet size={24} />
          </span>
        </div>
        <h1 className="text-heading-token text-gray-800 text-center">เลือกรูปแบบ<span className="whitespace-nowrap">การใช้งาน</span></h1>
        <p className="text-sm text-gray-500 text-center mt-2 mb-6">
          เลือกแบบที่เหมาะกับคุณ เริ่มจากแบบง่ายก็ได้
        </p>

        <div role="radiogroup" aria-label="รูปแบบการใช้งาน" className="flex flex-col gap-3">
          {OPTIONS.map((opt) => {
            const selected = mode === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(opt.value)}
                disabled={saving}
                className={`w-full text-left flex items-start gap-3 rounded-xl border-2 p-4 transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D9E75] ${
                  selected ? "border-[#1D9E75] bg-[#1D9E75]/5" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    selected ? "bg-[#1D9E75] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <opt.icon size={20} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-base font-medium text-gray-800">{opt.title}</span>
                  <span className="block text-sm text-gray-500 mt-1">{opt.desc}</span>
                </span>
                {selected && <Check size={20} className="text-[#1D9E75] shrink-0" />}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="w-full mt-6 h-12 md:h-11 bg-[#1D9E75] text-white rounded-xl font-medium hover:bg-[#178a64] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          เริ่มใช้งาน
        </button>
        <p className="text-xs text-gray-400 text-center mt-3">
          เปลี่ยนได้ทุกเมื่อที่ ตั้งค่า &gt; การแสดงผล
        </p>
      </div>
    </div>
  )
}
