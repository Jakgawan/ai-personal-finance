"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { showToast } from "@/app/components/Toast"

// รับเฉพาะตัวเลขกับจุดทศนิยม 1 จุด ทศนิยมไม่เกิน 2 ตำแหน่ง
function sanitize(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "")
  const firstDot = cleaned.indexOf(".")
  if (firstDot === -1) return cleaned
  return `${cleaned.slice(0, firstDot)}.${cleaned.slice(firstDot + 1).replace(/\./g, "").slice(0, 2)}`
}

// ช่องว่าง = 0, ไม่ใช่ตัวเลขจำกัด/ติดลบ = null (ไม่ถูกต้อง)
function parseStart(v: string): number | null {
  if (v.trim() === "") return 0
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export default function SavingsSection() {
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [hasProfile, setHasProfile] = useState(true)
  const [savingStart, setSavingStart] = useState("")
  const [investmentStart, setInvestmentStart] = useState("")
  const [saved, setSaved] = useState<{ saving: number; investment: number }>({ saving: 0, investment: 0 })
  const [hideSavings, setHideSavings] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoadError(true)
          return
        }
        const { data, error } = await supabase
          .from("financial_profile")
          .select("hide_savings, saving_start, investment_start")
          .eq("user_id", user.id)
          .maybeSingle()
        if (error) {
          setLoadError(true)
          return
        }
        setHasProfile(!!data)
        const s = Number(data?.saving_start) || 0
        const i = Number(data?.investment_start) || 0
        setSavingStart(s > 0 ? String(s) : "")
        setInvestmentStart(i > 0 ? String(i) : "")
        setSaved({ saving: s, investment: i })
        setHideSavings(data?.hide_savings === true)
      } catch {
        setLoadError(true)
      } finally {
        setLoaded(true)
      }
    }
    load()
  }, [])

  const sNum = parseStart(savingStart)
  const iNum = parseStart(investmentStart)
  const valid = sNum !== null && iNum !== null
  const changed = valid && (sNum !== saved.saving || iNum !== saved.investment)

  const handleSave = async () => {
    if (!valid || !changed || saving || sNum === null || iNum === null) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return
    }
    const { error } = await supabase
      .from("financial_profile")
      .update({ saving_start: sNum, investment_start: iNum, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
    setSaving(false)
    if (error) {
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return
    }
    setSaved({ saving: sNum, investment: iNum })
    showToast("บันทึกแล้ว", "success")
  }

  const handleToggle = async () => {
    if (toggling) return
    const next = !hideSavings
    setHideSavings(next)
    setToggling(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setHideSavings(!next)
      setToggling(false)
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return
    }
    const { error } = await supabase
      .from("financial_profile")
      .update({ hide_savings: next, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
    if (error) {
      setHideSavings(!next)
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
    }
    setToggling(false)
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800"

  return (
    <div className="max-w-lg">
      <h2 className="text-heading-token text-gray-800 mb-6">เงินเก็บและเงินลงทุน</h2>

      {!loaded ? null : loadError ? (
        <div className="bg-white rounded-xl card-padding-token shadow-sm">
          <p className="text-sm text-[#D85A30]">โหลดข้อมูลไม่สำเร็จ ลองเปิดหน้านี้ใหม่อีกครั้ง</p>
        </div>
      ) : !hasProfile ? (
        <div className="bg-white rounded-xl card-padding-token shadow-sm">
          <p className="text-sm text-gray-500">ยังไม่มีข้อมูลโปรไฟล์การเงิน กรุณาตั้งค่าเริ่มต้นที่หน้าแรกก่อน</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl card-padding-token shadow-sm flex flex-col gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">ยอดเงินเก็บที่มีอยู่ก่อนเริ่มใช้แอป (฿)</label>
              <input
                type="text"
                inputMode="decimal"
                value={savingStart}
                onChange={(e) => setSavingStart(sanitize(e.target.value))}
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">ยอดเงินลงทุนที่มีอยู่ก่อนเริ่มใช้แอป (฿)</label>
              <input
                type="text"
                inputMode="decimal"
                value={investmentStart}
                onChange={(e) => setInvestmentStart(sanitize(e.target.value))}
                placeholder="0"
                className={inputClass}
              />
            </div>
            <p className="text-xs text-gray-400">ใช้เป็นยอดเริ่มต้น ไม่กระทบเงินใช้ได้</p>
            <button
              onClick={handleSave}
              disabled={!valid || !changed || saving}
              className="bg-[#1D9E75] text-white rounded-lg px-4 btn-height-token flex items-center justify-center text-sm hover:bg-[#178a64] disabled:opacity-50 transition-colors"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>

          <div className="bg-white rounded-xl card-padding-token shadow-sm mt-4 flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-gray-800">ซ่อนยอดเงินเก็บบนหน้าแรก</p>
            <button
              type="button"
              role="switch"
              aria-checked={hideSavings}
              aria-label="ซ่อนยอดเงินเก็บบนหน้าแรก"
              onClick={handleToggle}
              disabled={toggling}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
                hideSavings ? "bg-[#1D9E75]" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  hideSavings ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
