"use client"

import { ShieldAlert } from "lucide-react"

export default function SlipConsentNotice({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <ShieldAlert size={18} className="text-gray-500 shrink-0 mt-0.5" />
        <p className="text-sm text-gray-600">
          รูปสลิปจะถูกส่งให้ AI ภายนอก (Typhoon และ Google Gemini) อ่านเพื่อกรอกยอดให้ ผู้ให้บริการอาจเก็บข้อมูลไว้ปรับปรุงระบบ — ปิดหรือตัดส่วนที่ไม่อยากส่งก่อนได้
        </p>
      </div>
      <button
        type="button"
        onClick={onAccept}
        className="w-full bg-[#1D9E75] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#178a64] transition-colors"
      >
        เข้าใจแล้ว เลือกรูป
      </button>
    </div>
  )
}
