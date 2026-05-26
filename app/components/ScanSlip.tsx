"use client"

import { useState, useRef, useEffect } from "react"
import { supabase } from "@/lib/supabase"


type ScannedData = {
  name: string
  amount: number
  date: string
  type: string
  category: string
}

export default function ScanSlip({ onSuccess }: { onSuccess?: () => void }) {
  const [showModal, setShowModal] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState<ScannedData | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
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
  

  const handleFile = async (file: File) => {
    if (!file) return
    setScanning(true)
    setScanned(null)

    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(",")[1]
      const mimeType = file.type
      setPreview(e.target?.result as string)

      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      })

      const data = await res.json()
      if (data.success) {
        setScanned({
          name: data.data.name || "",
          amount: data.data.amount || 0,
          date: data.data.date || new Date().toISOString().split("T")[0],
          type: data.data.type || "expense",
          category: data.data.category || "",
        })
      }
      setScanning(false)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!scanned) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from("transactions").insert({
      user_id: user.id,
      name: scanned.name,
      amount: Number(scanned.amount),
      date: scanned.date,
      type: scanned.type,
      category: scanned.category,
      note: "สแกนจากสลิป",
    })

    setSaving(false)
    setShowModal(false)
    setScanned(null)
    setPreview(null)
    onSuccess?.()
  }
  

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="border border-gray-300 text-gray-600 rounded-lg px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
      >
        📷 สแกนสลิป
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="text-lg font-semibold text-gray-800">สแกนสลิป</h2>
              <button onClick={() => { setShowModal(false); setScanned(null); setPreview(null) }}
                className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="px-6 pb-6">
              {/* Upload area */}
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#1D9E75] transition-colors mb-4"
              >
                {preview ? (
                  <img src={preview} alt="slip" className="max-h-48 mx-auto rounded-lg object-contain" />
                ) : (
                  <>
                    <p className="text-3xl mb-2">📷</p>
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
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />

              {scanning && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 animate-pulse">🔍 AI กำลังอ่านสลิป...</p>
                </div>
              )}

              {scanned && (
                <div className="flex flex-col gap-3 mt-2">
                  <p className="text-xs font-semibold text-[#1D9E75] mb-1">✅ อ่านข้อมูลได้แล้ว ตรวจสอบก่อนบันทึก</p>

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

                  <input value={scanned.amount} onChange={e => setScanned({ ...scanned, amount: Number(e.target.value) })}
                    type="number" placeholder="จำนวน (฿)"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />

                  <input value={scanned.date} onChange={e => setScanned({ ...scanned, date: e.target.value })}
                    type="date"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />

                  <input value={scanned.category} onChange={e => setScanned({ ...scanned, category: e.target.value })} placeholder="หมวดหมู่" 
                    list="category-list"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"/>
                  <datalist id="category-list"> {categories
                  .filter(c => !c.type || c.type === scanned?.type)
                  .map(c => <option key={c.id} value={c.name} />) }
                  </datalist>

                  <button onClick={handleSave} disabled={saving}
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