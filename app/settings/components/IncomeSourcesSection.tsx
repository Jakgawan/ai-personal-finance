"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { showToast } from "@/app/components/Toast"
import ConfirmModal from "@/app/components/ConfirmModal"
import { getNextIncomeDate, todayInBangkok, formatDateLabel } from "@/lib/income-schedule"
import { Plus, Pencil, Trash2, CalendarClock, Scale } from "lucide-react"
import AdjustBalanceModal from "@/app/components/AdjustBalanceModal"
import { pickActiveOpening } from "@/lib/opening-balance"

type IncomeSource = {
  id: string
  name: string
  amount: number | null
  schedule_type: string
  monthly_days: number[] | null
}

type OpeningRow = { id: string; entered_amount: number; opening_date: string; source: string; created_at: string }

type CarryPref = "ask" | "carry" | "reset"

type Frequency = "once" | "twice" | "custom"

const ALL_DAYS: number[] = Array.from({ length: 31 }, (_, i) => i + 1)

// [5,20] -> 'ทุกวันที่ 5 และ 20 ของเดือน'
function describeDays(days: number[] | null): string {
  const sorted = [...(days ?? [])].sort((a, b) => a - b)
  if (sorted.length === 0) return ""
  const text =
    sorted.length === 1
      ? String(sorted[0])
      : `${sorted.slice(0, -1).join(", ")} และ ${sorted[sorted.length - 1]}`
  return `ทุกวันที่ ${text} ของเดือน`
}

function presetOf(days: number[]): Frequency {
  if (days.length === 1) return "once"
  if (days.length === 2) return "twice"
  return "custom"
}

export default function IncomeSourcesSection() {
  const [sources, setSources] = useState<IncomeSource[]>([])
  const [targetDate, setTargetDate] = useState<string | null>(null)
  const [targetInput, setTargetInput] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [payCycles, setPayCycles] = useState<{ start_day: number }[]>([])
  const [openingRows, setOpeningRows] = useState<OpeningRow[]>([])
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [carryPref, setCarryPref] = useState<CarryPref>("ask")
  const [prefSaving, setPrefSaving] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState("เงินเดือน")
  const [amount, setAmount] = useState("")
  const [freq, setFreq] = useState<Frequency>("once")
  const [dayOnce, setDayOnce] = useState(25)
  const [dayA, setDayA] = useState(15)
  const [dayB, setDayB] = useState(30)
  const [customDays, setCustomDays] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [targetSaving, setTargetSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<IncomeSource | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [srcRes, profRes, cycRes, obRes] = await Promise.all([
      supabase
        .from("income_sources")
        .select("id, name, amount, schedule_type, monthly_days")
        .eq("user_id", user.id)
        .order("created_at"),
      supabase.from("financial_profile").select("target_date, carryover_pref").eq("user_id", user.id).maybeSingle(),
      supabase.from("pay_cycles").select("start_day").eq("user_id", user.id),
      supabase.from("opening_balances").select("id, entered_amount, opening_date, source, created_at").eq("user_id", user.id),
    ])
    const failed = !!(srcRes.error || profRes.error || cycRes.error || obRes.error)
    if (failed) {
      showToast("โหลดข้อมูลไม่สำเร็จ", "error")
    }
    setLoadFailed(failed)
    if (!obRes.error) {
      setOpeningRows(((obRes.data ?? []) as OpeningRow[]).map((r) => ({ ...r, entered_amount: Number(r.entered_amount) })))
    }
    if (!cycRes.error) setPayCycles((cycRes.data ?? []) as { start_day: number }[])
    if (!srcRes.error) {
      setSources(
        (srcRes.data ?? []).map((s) => ({
          ...s,
          amount: s.amount === null ? null : Number(s.amount),
        })) as IncomeSource[]
      )
    }
    if (!profRes.error) {
      const td = (profRes.data?.target_date as string | null | undefined) ?? null
      setTargetDate(td)
      setTargetInput(td ?? "")
      const cp = profRes.data?.carryover_pref as CarryPref | null | undefined
      setCarryPref(cp === "carry" || cp === "reset" ? cp : "ask")
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    // เลื่อนไปทำงานหลังจบ effect เพื่อไม่ให้ setState ถูกเรียกแบบ synchronous ใน effect
    const t = setTimeout(() => {
      load()
    }, 0)
    return () => clearTimeout(t)
  }, [load])

  const resetForm = () => {
    setEditId(null)
    setName("เงินเดือน")
    setAmount("")
    setFreq("once")
    setDayOnce(25)
    setDayA(15)
    setDayB(30)
    setCustomDays([])
  }

  const openAdd = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (s: IncomeSource) => {
    const days = [...(s.monthly_days ?? [])].sort((a, b) => a - b)
    const preset = presetOf(days)
    setEditId(s.id)
    setName(s.name)
    setAmount(s.amount === null ? "" : String(s.amount))
    setFreq(preset)
    setDayOnce(days[0] ?? 25)
    setDayA(days[0] ?? 15)
    setDayB(days[1] ?? 30)
    setCustomDays(preset === "custom" ? days : [])
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    resetForm()
  }

  const toggleCustomDay = (d: number) => {
    setCustomDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
  }

  // ---- validation ----
  const trimmedName = name.trim()
  const amountClean = amount.replace(/[,\s]/g, "")
  const amountNum = amountClean === "" ? null : Number(amountClean)
  const amountError =
    amountNum === null
      ? ""
      : !Number.isFinite(amountNum)
        ? "กรอกเป็นตัวเลข"
        : amountNum <= 0
          ? "จำนวนเงินต้องมากกว่า 0"
          : ""
  const selectedDays: number[] =
    freq === "once" ? [dayOnce] : freq === "twice" ? [dayA, dayB] : customDays
  const uniqueDays = Array.from(new Set(selectedDays)).sort((a, b) => a - b)
  const twiceError = freq === "twice" && dayA === dayB ? "สองวันต้องไม่ซ้ำกัน" : ""
  const customError = freq === "custom" && customDays.length === 0 ? "เลือกอย่างน้อย 1 วัน" : ""
  const valid =
    trimmedName.length >= 1 &&
    trimmedName.length <= 50 &&
    !amountError &&
    !twiceError &&
    uniqueDays.length >= 1

  const handleSave = async () => {
    if (!valid || saving) return
    setSaving(true)
    const payload = {
      name: trimmedName,
      amount: amountNum,
      schedule_type: "monthly_days",
      monthly_days: uniqueDays,
    }
    let errored = false
    if (editId) {
      const { error } = await supabase.from("income_sources").update(payload).eq("id", editId)
      errored = !!error
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
        setSaving(false)
        return
      }
      const { error } = await supabase.from("income_sources").insert({ ...payload, user_id: user.id })
      errored = !!error
    }
    if (errored) {
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      setSaving(false)
      return
    }
    showToast("บันทึกแล้ว", "success")
    setSaving(false)
    closeForm()
    load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    const { error } = await supabase.from("income_sources").delete().eq("id", id)
    if (error) {
      showToast("ลบไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return
    }
    if (editId === id) closeForm()
    showToast("ลบแล้ว", "success")
    load()
  }

  const saveTargetDate = async (value: string | null) => {
    if (targetSaving) return
    setTargetSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setTargetSaving(false)
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return
    }
    const { error } = await supabase.from("financial_profile").upsert(
      { user_id: user.id, target_date: value, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    setTargetSaving(false)
    if (error) {
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return
    }
    showToast("บันทึกแล้ว", "success")
    setTargetDate(value)
    setTargetInput(value ?? "")
  }

  // เปลี่ยนวิธีจัดการตอนขึ้นรอบใหม่ — "ask" เก็บเป็น null (ถามทุกครั้ง); บันทึกพลาดแล้วคืนค่าเดิม
  const savePref = async (value: CarryPref) => {
    if (prefSaving || value === carryPref) return
    const before = carryPref
    setCarryPref(value)
    setPrefSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setPrefSaving(false)
      setCarryPref(before)
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return
    }
    const { error } = await supabase.from("financial_profile").upsert(
      { user_id: user.id, carryover_pref: value === "ask" ? null : value, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    setPrefSaving(false)
    if (error) {
      setCarryPref(before)
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return
    }
    showToast("บันทึกแล้ว", "success")
  }

  const activeOpening = pickActiveOpening(openingRows)
  const today = todayInBangkok()
  const showContent = loaded && !loadFailed
  const next = showContent ? getNextIncomeDate(today, { incomeSources: sources, payCycles, targetDate }) : null
  const nextLabel = next
    ? next.source === "month_end"
      ? "สิ้นเดือนนี้ (ยังไม่ได้ตั้งวันเงินเข้า)"
      : next.source === "pay_cycles"
        ? `${formatDateLabel(next.date)} (จากรอบเงินเดือนแบบเดิม)`
        : formatDateLabel(next.date)
    : ""

  const selectClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"

  const daySelect = (value: number, onChange: (n: number) => void, label: string) => (
    <div className="flex-1">
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={selectClass}>
        {ALL_DAYS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <div className="max-w-lg">
      <h2 className="text-heading-token text-gray-800 mb-2">รายได้และรอบเงิน</h2>

      {showContent && (
        <div className="bg-white rounded-xl card-padding-token shadow-sm mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-gray-700">ยอดเงินตั้งต้น</h3>
            {activeOpening && activeOpening.source === "carryover" ? (
              <p className="text-sm text-gray-800 mt-1">
                เริ่มรอบใหม่ {formatDateLabel(activeOpening.opening_date)}
                <span className="text-xs text-gray-400"> (ไม่ยกยอด)</span>
              </p>
            ) : activeOpening ? (
              <p className="text-sm text-gray-800 mt-1">
                <span className="font-semibold tabular-nums">฿{activeOpening.entered_amount.toLocaleString()}</span>
                <span className="text-xs text-gray-400"> {activeOpening.source === "onboarding_backfill" ? `ยอด ณ ต้นวันที่ ${formatDateLabel(activeOpening.opening_date)}` : `ตั้งเมื่อ ${formatDateLabel(todayInBangkok(new Date(activeOpening.created_at)))}`}</span>
              </p>
            ) : (
              <p className="text-sm text-gray-400 mt-1">ยังไม่ได้ตั้ง</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAdjustOpen(true)}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 text-sm border border-[#1D9E75] text-[#1D9E75] rounded-lg btn-height-token hover:bg-green-50 transition-colors"
          >
            <Scale size={16} />
            ปรับยอดเงิน
          </button>
        </div>
      )}

      {showContent && (
        <div className="bg-white rounded-xl card-padding-token shadow-sm mb-4">
          <h3 className="text-sm font-medium text-gray-700">เมื่อขึ้นรอบใหม่</h3>
          <p className="text-xs text-gray-400 mt-1 mb-3">เงินที่เหลือจากรอบก่อน จะให้ยกมารวมกับรอบใหม่ไหม</p>
          <div role="radiogroup" aria-label="เมื่อขึ้นรอบใหม่" className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-lg">
            {([
              { value: "ask", label: "ถามทุกครั้ง" },
              { value: "carry", label: "ยกยอดเสมอ" },
              { value: "reset", label: "ไม่ยกยอดเสมอ" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={carryPref === opt.value}
                disabled={prefSaving}
                onClick={() => savePref(opt.value)}
                className={`py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  carryPref === opt.value ? "bg-[#1D9E75] text-white" : "text-gray-600 hover:bg-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl card-padding-token shadow-sm">
        <h3 className="text-sm font-medium text-gray-700">รายได้ประจำ</h3>
        <p className="text-xs text-gray-400 mt-1 mb-4">
          บอกแอปว่าเงินเข้าวันไหน แอปจะใช้คำนวณว่าแต่ละวันใช้ได้เท่าไหร่
        </p>

        {showContent && sources.length === 0 && !formOpen && (
          <p className="text-sm text-gray-400 mb-4">ยังไม่มีรายได้ประจำ</p>
        )}

        {sources.length > 0 && (
          <div className="mb-4">
            {sources.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{describeDays(s.monthly_days)}</p>
                  {s.amount !== null && (
                    <p className="text-xs text-[#1D9E75] mt-0.5">฿{s.amount.toLocaleString()}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(s)}
                    aria-label={`แก้ไข ${s.name}`}
                    className="p-2 text-[#378ADD] hover:bg-gray-100 rounded-lg"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(s)}
                    aria-label={`ลบ ${s.name}`}
                    className="p-2 text-[#D85A30] hover:bg-gray-100 rounded-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {formOpen ? (
          <div className="flex flex-col gap-3 border border-gray-100 rounded-xl p-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ชื่อรายได้</label>
              <input
                value={name}
                maxLength={50}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">จำนวนเงิน (ไม่บังคับ)</label>
              <input
                value={amount}
                inputMode="decimal"
                placeholder="เช่น 15000"
                onChange={(e) => setAmount(e.target.value)}
                className={inputClass}
              />
              {amountError && <p className="text-xs text-[#D85A30] mt-1">{amountError}</p>}
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">เงินเข้าบ่อยแค่ไหน</label>
              <div role="radiogroup" aria-label="ความถี่" className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-lg">
                {([
                  { value: "once", label: "เดือนละครั้ง" },
                  { value: "twice", label: "เดือนละ 2 ครั้ง" },
                  { value: "custom", label: "กำหนดเอง" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={freq === opt.value}
                    onClick={() => setFreq(opt.value)}
                    className={`py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                      freq === opt.value ? "bg-[#1D9E75] text-white" : "text-gray-600 hover:bg-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {freq === "once" && <div className="flex gap-3">{daySelect(dayOnce, setDayOnce, "วันที่")}</div>}
            {freq === "twice" && (
              <>
                <div className="flex gap-3">
                  {daySelect(dayA, setDayA, "ครั้งที่ 1 วันที่")}
                  {daySelect(dayB, setDayB, "ครั้งที่ 2 วันที่")}
                </div>
                {twiceError && <p className="text-xs text-[#D85A30]">{twiceError}</p>}
              </>
            )}
            {freq === "custom" && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">เลือกวันที่เงินเข้า (เลือกได้หลายวัน)</label>
                <div className="grid grid-cols-7 gap-1.5">
                  {ALL_DAYS.map((d) => {
                    const on = customDays.includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleCustomDay(d)}
                        className={`min-w-0 h-9 rounded-lg text-sm border transition-colors ${
                          on
                            ? "bg-[#1D9E75] border-[#1D9E75] text-white font-medium"
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
                {customError && <p className="text-xs text-[#D85A30] mt-1">{customError}</p>}
              </div>
            )}

            {uniqueDays.some((d) => d >= 29) && (
              <p className="text-xs text-gray-400">ถ้าเดือนไหนไม่มีวันนั้น จะนับเป็นวันสุดท้ายของเดือน</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={!valid || saving}
                className="flex-1 bg-[#1D9E75] text-white rounded-lg px-4 btn-height-token flex items-center justify-center text-sm hover:bg-[#178a64] disabled:opacity-50 transition-colors"
              >
                {saving ? "กำลังบันทึก..." : editId ? "บันทึกการแก้ไข" : "บันทึก"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="px-4 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={openAdd}
            className="w-full border border-dashed border-[#1D9E75] text-[#1D9E75] rounded-lg px-4 btn-height-token flex items-center justify-center gap-1.5 text-sm hover:bg-green-50 transition-colors"
          >
            <Plus size={16} />
            เพิ่มรายได้ประจำ
          </button>
        )}
      </div>

      {loaded && loadFailed && (
        <div className="bg-white rounded-xl card-padding-token shadow-sm mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-[#D85A30]">โหลดข้อมูลไม่สำเร็จ</p>
          <button
            type="button"
            onClick={() => load()}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            ลองใหม่
          </button>
        </div>
      )}

      {showContent && next && (
        <p className="text-xs text-gray-500 mt-3 inline-flex items-center gap-1.5">
          <CalendarClock size={14} className="text-[#1D9E75]" />
          เงินเข้าครั้งถัดไป: {nextLabel}
        </p>
      )}

      {showContent && sources.length === 0 && payCycles.length === 0 && (
        <div className="bg-white rounded-xl card-padding-token shadow-sm mt-4">
          <h3 className="text-sm font-medium text-gray-700">ไม่มีรายได้ประจำ?</h3>
          <p className="text-xs text-gray-400 mt-1 mb-3">
            ตั้งวันที่เงินก้อนถัดไปเข้า ถ้าไม่ตั้ง แอปจะนับถึงสิ้นเดือน
          </p>
          <input
            type="date"
            min={today}
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            className={inputClass}
          />
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => saveTargetDate(targetInput)}
              disabled={targetSaving || !targetInput || targetInput <= today || targetInput === targetDate}
              className="flex-1 bg-[#1D9E75] text-white rounded-lg px-4 btn-height-token flex items-center justify-center text-sm hover:bg-[#178a64] disabled:opacity-50 transition-colors"
            >
              บันทึกวันที่
            </button>
            {targetDate && (
              <button
                type="button"
                onClick={() => saveTargetDate(null)}
                disabled={targetSaving}
                className="px-4 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                ล้าง
              </button>
            )}
          </div>
        </div>
      )}

      <AdjustBalanceModal open={adjustOpen} onClose={() => setAdjustOpen(false)} onSaved={() => load()} />

      <ConfirmModal
        open={deleteTarget !== null}
        message={`ลบรายได้ประจำ "${deleteTarget?.name ?? ""}" ใช่ไหม?`}
        confirmLabel="ลบ"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
