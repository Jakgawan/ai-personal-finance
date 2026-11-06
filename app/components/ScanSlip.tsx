"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Camera, CheckCircle2, Loader2, X } from "lucide-react"
import { showToast } from "./Toast"
import { todayInBangkok } from "@/lib/income-schedule"
import { isValidDateString } from "@/lib/date-valid"

type ScannedData = {
  name: string
  amount: string
  amountMissing: boolean
  dateFromToday: boolean
  date: string
  type: "income" | "expense"
  category: string
}

const parseAmount = (v: string): number => (v.trim() === "" ? NaN : Number(v))
const isAmountValid = (v: string): boolean => {
  const n = parseAmount(v)
  return Number.isFinite(n) && n > 0
}

export default function ScanSlip({ onSuccess }: { onSuccess?: () => void }) {
  const [showModal, setShowModal] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState<ScannedData | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const scanIdRef = useRef<number>(0)
  const abortRef = useRef<AbortController | null>(null)
  const [categories, setCategories] = useState<{id: string, name: string, type: string}[]>([])

useEffect(() => {
  const fetchCats = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from("categories").select("*").eq("user_id", user.id)
    setCategories(data || [])
  }
  fetchCats()
}, [])
  

  // ยกเลิกการสแกนที่ค้างอยู่ และทำให้ผลที่ตอบกลับมาทีหลังถูกทิ้ง
  const cancelScan = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    scanIdRef.current += 1
    setScanning(false)
    setScanned(null)
    setPreview(null)
  }, [])

  useEffect(() => {
    return () => cancelScan()
  }, [cancelScan])

  const handleFile = async (file: File) => {
    if (!file) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    scanIdRef.current += 1
    const myId = scanIdRef.current
    const isCurrent = (): boolean => myId === scanIdRef.current
    setScanning(true)
    setScanned(null)

    // อ่านสลิปไม่สำเร็จ: แจ้งผู้ใช้ ล้างภาพเก่า เปิดโมดอลค้างไว้ให้เลือกรูปใหม่
    const failScan = () => {
      if (!isCurrent()) return
      showToast("อ่านสลิปไม่สำเร็จ ลองใหม่หรือกรอกเอง", "error")
      setScanned(null)
      setPreview(null)
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const base64 = (e.target?.result as string).split(",")[1]
        const mimeType = file.type
        if (isCurrent()) setPreview(e.target?.result as string)

        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
          signal: controller.signal,
        })

        if (!isCurrent()) return
        if (!res.ok) {
          failScan()
          return
        }
        const data = await res.json()
        if (!isCurrent()) return
        if (data?.success !== true || !data.data) {
          failScan()
          return
        }
        const ocrAmount = Number(data.data.amount)
        const amountOk = Number.isFinite(ocrAmount) && ocrAmount > 0
        setScanned({
          name: data.data.name || "",
          amount: amountOk ? String(ocrAmount) : "",
          amountMissing: !amountOk,
          date: isValidDateString(data.data.date) ? data.data.date : todayInBangkok(),
          dateFromToday: !isValidDateString(data.data.date),
          type: data.data.type === "income" ? "income" : "expense",
          category: data.data.category || "",
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) failScan()
      } finally {
        if (isCurrent()) setScanning(false)
      }
    }
    reader.onerror = () => {
      failScan()
      if (isCurrent()) setScanning(false)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!scanned) return
    if (
      !isAmountValid(scanned.amount) ||
      !isValidDateString(scanned.date) ||
      (scanned.type !== "income" && scanned.type !== "expense")
    ) {
      showToast("กรอกจำนวนเงินและวันที่ให้ถูกต้อง", "error")
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      name: scanned.name,
      amount: Number(scanned.amount),
      date: scanned.date,
      type: scanned.type,
      category: scanned.category,
      note: "สแกนจากสลิป",
    })

    if (error) {
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      setSaving(false)
      return
    }

    setSaving(false)
    setShowModal(false)
    cancelScan()
    onSuccess?.()
  }
  

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="border border-gray-300 text-gray-600 rounded-lg px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
      >
        <span className="flex items-center gap-1.5">
  <Camera size={14} />
  สแกนสลิป
</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="text-lg font-semibold text-gray-800">สแกนสลิป</h2>
              <button onClick={() => { setShowModal(false); cancelScan() }}
                aria-label="ปิด" className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="px-6 pb-6">
              {/* Upload area */}
              <div
                onClick={() => !scanning && fileRef.current?.click()}
                className={`border-2 border-dashed border-gray-200 rounded-xl p-6 text-center transition-colors mb-4 ${scanning ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-[#1D9E75]"}`}
              >
                {preview ? (
                  <img src={preview} alt="slip" className="max-h-48 mx-auto rounded-lg object-contain" />
                ) : (
                  <>
                    <Camera size={32} className="text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">กดเพื่ออัปโหลดรูปสลิป</p>
                    <p className="text-xs text-gray-400 mt-1">รองรับ JPG, PNG</p>
                  </>
                )}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (file) handleFile(file)
                }}
              />

              {scanning && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 flex items-center justify-center gap-1.5">
  <Loader2 size={14} className="animate-spin" />
  AI กำลังอ่านสลิป...
</p>
                </div>
              )}

              {scanned && (
                <div className="flex flex-col gap-3 mt-2">
                 <p className="text-xs font-semibold text-[#1D9E75] mb-1 flex items-center gap-1">
  <CheckCircle2 size={12} />
  อ่านข้อมูลได้แล้ว ตรวจสอบก่อนบันทึก
</p>

                  <div className="flex gap-2">
                    <button onClick={() => setScanned({ ...scanned, type: "expense" })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${scanned.type === "expense" ? "bg-[#D85A30] text-white border-[#D85A30]" : "border-gray-200 text-gray-600"}`}>
                      รายจ่าย
                    </button>
                    <button onClick={() => setScanned({ ...scanned, type: "income" })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${scanned.type === "income" ? "bg-[#1D9E75] text-white border-[#1D9E75]" : "border-gray-200 text-gray-600"}`}>
                      รายรับ
                    </button>
                  </div>

                  <input value={scanned.name} onChange={e => setScanned({ ...scanned, name: e.target.value })}
                    placeholder="ชื่อรายการ"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />

                  <input value={scanned.amount} onChange={e => setScanned({ ...scanned, amount: e.target.value })}
                    type="number" inputMode="decimal" placeholder="จำนวน (฿)"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
                  {scanned.amount.trim() === "" && scanned.amountMissing && (
                    <p className="text-[0.75rem] text-gray-500 -mt-2">อ่านยอดจากสลิปไม่ได้ กรอกยอดเอง</p>
                  )}
                  {scanned.amount.trim() !== "" && !isAmountValid(scanned.amount) && (
                    <p className="text-[0.75rem] text-[#D85A30] -mt-2">จำนวนเงินต้องมากกว่า 0</p>
                  )}

                  <input value={scanned.date} onChange={e => setScanned({ ...scanned, date: e.target.value, dateFromToday: false })}
                    type="date"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
                  {scanned.dateFromToday && (
                    <p className="text-[0.75rem] text-gray-500 -mt-2">อ่านวันที่จากสลิปไม่ได้ ใช้วันนี้แทน ตรวจก่อนบันทึก</p>
                  )}

                  <input value={scanned.category} onChange={e => setScanned({ ...scanned, category: e.target.value })} placeholder="หมวดหมู่" 
                    list="category-list"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"/>
                  <datalist id="category-list"> {categories
                  .filter(c => !c.type || c.type === scanned?.type)
                  .map(c => <option key={c.id} value={c.name} />) }
                  </datalist>

                  <button onClick={handleSave} disabled={saving || !isAmountValid(scanned.amount) || !isValidDateString(scanned.date)}
                    className="w-full bg-[#1D9E75] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#178a64] disabled:opacity-50 transition-colors">
                    {saving ? "กำลังบันทึก..." : "บันทึกรายการ"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}