"use client"

import { useState, useEffect } from "react"
import { Scale, X, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { showToast } from "@/app/components/Toast"
import { todayInBangkok } from "@/lib/income-schedule"
import { parseMoneyInput, openingAmountForNow } from "@/lib/opening-balance"

type Props = {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

export default function AdjustBalanceModal({ open, onClose, onSaved }: Props) {
  const [value, setValue] = useState<string>("")
  const [touched, setTouched] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)

  // เปิดใหม่ทุกครั้ง เริ่มช่องว่าง
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        setValue("")
        setTouched(false)
        setSaving(false)
      }, 0)
      return () => clearTimeout(t)
    }
  }, [open])

  if (!open) return null

  const num = parseMoneyInput(value)
  const error = value.trim() === "" ? "" : num === null ? "กรอกเป็นตัวเลข" : num < 0 ? "จำนวนเงินต้องไม่ติดลบ" : ""
  const valid = num !== null && num >= 0

  const handleSave = async () => {
    setTouched(true)
    if (!valid || num === null || saving) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return
    }
    const today = todayInBangkok()
    // รายการของวันนี้ที่จดไปแล้ว ต้องชดเชยเพื่อให้ยอดคำนวณตรงกับที่ผู้ใช้พิมพ์
    const { data: txs, error: txError } = await supabase
      .from("transactions")
      .select("type, amount")
      .eq("user_id", user.id)
      .eq("date", today)
    if (txError) {
      setSaving(false)
      showToast("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return
    }
    let inc = 0
    let exp = 0
    for (const t of txs ?? []) {
      if (t.type === "income") inc += Number(t.amount)
      else if (t.type === "expense") exp += Number(t.amount)
    }
    const { error: insError } = await supabase.from("opening_balances").insert({
      user_id: user.id,
      amount: openingAmountForNow(num, inc, exp),
      entered_amount: num,
      opening_date: today,
      source: "adjust",
    })
    if (insError) {
      setSaving(false)
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return
    }
    setSaving(false)
    showToast("ปรับยอดแล้ว", "success")
    window.dispatchEvent(new CustomEvent("openingBalanceChanged"))
    onSaved?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl card-padding-token">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800 inline-flex items-center gap-2">
            <Scale size={20} className="text-[#1D9E75]" />
            ปรับยอดเงิน
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="ปิด"
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <label htmlFor="adjust-balance-input" className="text-sm text-gray-700 block mb-2">
          ตอนนี้มีเงินที่จะใช้ได้จนถึงเงินเข้าครั้งหน้าเท่าไหร่
        </label>
        <input
          id="adjust-balance-input"
          value={value}
          inputMode="decimal"
          placeholder="เช่น 5000"
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave()
          }}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
        />
        {(error || (touched && !valid)) && (
          <p className="text-xs text-[#D85A30] mt-1">{error || "กรอกจำนวนเงิน"}</p>
        )}
        <p className="text-xs text-gray-400 mt-2">ไม่ต้องรวมเงินเก็บ และหักค่าเช่าหรือค่าที่ต้องจ่ายก่อนเงินเข้าออกไปด้วย</p>

        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 border border-gray-200 rounded-lg btn-height-token text-sm hover:bg-gray-50 text-gray-700"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!valid || saving}
            className="flex-1 bg-[#1D9E75] text-white rounded-lg btn-height-token text-sm font-medium hover:bg-[#178a64] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            บันทึก
          </button>
        </div>
      </div>
    </div>
  )
}
