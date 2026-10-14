"use client"

import { useState, useEffect } from "react"
import { CalendarCheck, X, Loader2 } from "lucide-react"
import { formatMoney } from "@/lib/daily-budget"

type Props = {
  open: boolean
  leftover: number
  prevRangeLabel: string // เช่น "5 ต.ค. – 19 ต.ค."
  saving: boolean
  onCarry: (remember: boolean) => void
  onReset: (remember: boolean) => void
  // ปิดด้วย X / พื้นหลัง = ตัดสินใจทีหลัง (จะถามใหม่ตอนเปิดแอปครั้งหน้า)
  onClose: () => void
}

export default function CarryOverModal({ open, leftover, prevRangeLabel, saving, onCarry, onReset, onClose }: Props) {
  const [remember, setRemember] = useState<boolean>(false)

  // เปิดใหม่ทุกครั้ง ล้างตัวเลือก "จำ"
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => setRemember(false), 0)
    return () => clearTimeout(t)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-[60] p-4"
      onClick={() => { if (!saving) onClose() }}
    >
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl card-padding-token" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800 inline-flex items-center gap-2">
            <CalendarCheck size={20} className="text-[#1D9E75]" />
            รอบใหม่เริ่มแล้ว
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

        <p className="text-sm text-gray-700">
          รอบก่อน ({prevRangeLabel}) เหลือเงิน{" "}
          <span className="font-semibold tabular-nums text-[#1D9E75]">฿{formatMoney(leftover)}</span>
        </p>

        <label className="flex items-center gap-2 mt-4 text-sm text-gray-700 min-h-11 cursor-pointer">
          <input
            type="checkbox"
            checked={remember}
            disabled={saving}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-4 h-4 accent-[#1D9E75]"
          />
          จำตัวเลือกนี้ ไม่ต้องถามอีก
        </label>

        <div className="flex flex-col gap-2 mt-3">
          <button
            type="button"
            onClick={() => onCarry(remember)}
            disabled={saving}
            className="w-full bg-[#1D9E75] text-white rounded-lg btn-height-token text-sm font-medium hover:bg-[#178a64] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            ยกไปรวมรอบนี้
          </button>
          <button
            type="button"
            onClick={() => onReset(remember)}
            disabled={saving}
            className="w-full border border-gray-200 rounded-lg btn-height-token text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            ไม่ยก เก็บไว้
          </button>
        </div>
      </div>
    </div>
  )
}
