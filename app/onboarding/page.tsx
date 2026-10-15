"use client"

import { useState, useEffect } from "react"
import { Wallet, Loader2, ArrowLeft, CalendarClock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { showToast } from "@/app/components/Toast"
import { getNextIncomeDate, todayInBangkok, formatDateLabel, addDays } from "@/lib/income-schedule"
import { parseMoneyInput, openingAmountForNow } from "@/lib/opening-balance"

type NextKind = "monthly" | "uncertain" | "unknown"

const ALL_DAYS: number[] = Array.from({ length: 31 }, (_, i) => i + 1)

export default function OnboardingPage() {
  const [checking, setChecking] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [step, setStep] = useState<1 | 2>(1)

  // ขั้น 1
  const [amountText, setAmountText] = useState<string>("")
  const [amountTouched, setAmountTouched] = useState<boolean>(false)
  const [backfill, setBackfill] = useState<boolean>(false)
  const [backfillDate, setBackfillDate] = useState<string>("")

  // ขั้น 2
  const [kind, setKind] = useState<NextKind>("monthly")
  const [days, setDays] = useState<number[]>([])
  const [targetDate, setTargetDate] = useState<string>("")

  // id แถวที่บันทึกไปแล้วในรอบ onboarding นี้ — ลองใหม่จะอัปเดตแถวเดิม ไม่สร้างซ้ำ
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [incomeSourceId, setIncomeSourceId] = useState<string | null>(null)

  const today = todayInBangkok()
  const minBackfill = addDays(today, -62)
  const tomorrow = addDays(today, 1)

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
      // มีแถวอยู่แล้ว = เคยผ่าน onboarding แล้ว ไม่ต้องถามซ้ำ
      if (!error && data) {
        window.location.assign("/")
        return
      }
      setChecking(false)
    }
    check()
  }, [])

  // ---- validation ขั้น 1 ----
  const amount = parseMoneyInput(amountText)
  const amountError =
    amountText.trim() === "" ? "" : amount === null ? "กรอกเป็นตัวเลข" : amount < 0 ? "จำนวนเงินต้องไม่ติดลบ" : ""
  const backfillValid = !backfill || (backfillDate >= minBackfill && backfillDate <= today && backfillDate !== "")
  const step1Valid = amount !== null && amount >= 0 && backfillValid

  // ---- validation ขั้น 2 ----
  const targetValid = targetDate !== "" && targetDate >= tomorrow
  const step2Valid = kind === "monthly" ? days.length >= 1 : kind === "uncertain" ? targetValid : true

  const toggleDay = (d: number) => {
    setDays((prev) => {
      if (prev.includes(d)) return prev.filter((x) => x !== d)
      // เลือกได้สูงสุด 2 วัน: วันที่สามแทนที่วันที่เลือกไว้ก่อนสุด
      return prev.length >= 2 ? [prev[1], d] : [...prev, d]
    })
  }

  const sortedDays = [...days].sort((a, b) => a - b)
  const next =
    step === 2 && step2Valid
      ? getNextIncomeDate(today, {
          incomeSources: kind === "monthly" ? [{ schedule_type: "monthly_days", monthly_days: sortedDays }] : [],
          payCycles: [],
          targetDate: kind === "uncertain" ? targetDate : null,
        })
      : null

  const handleSubmit = async () => {
    if (saving || !step1Valid || !step2Valid || amount === null) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return
    }
    const fail = () => {
      setSaving(false)
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
    }
    // ลำดับสำคัญ: แถว financial_profile เป็นตัวบอกว่า onboarding เสร็จแล้ว จึงบันทึกเป็นขั้นสุดท้าย
    // ถ้าพลาดกลางทาง ลองใหม่จะอัปเดตแถวที่สร้างไปแล้ว (เก็บ id ไว้ใน state) ไม่สร้างซ้ำ

    // ยอดที่เก็บ: จดย้อนหลัง = ตัวเลขที่พิมพ์; ปกติ = ชดเชยรายการของวันนี้เหมือนหน้าปรับยอด
    let storedAmount = amount
    if (!backfill) {
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
      storedAmount = openingAmountForNow(amount, inc, exp)
    }
    const openingValues = {
      amount: storedAmount,
      entered_amount: amount,
      opening_date: backfill ? backfillDate : today,
      source: backfill ? "onboarding_backfill" : "onboarding",
    }
    if (openingId) {
      const { error: obError } = await supabase.from("opening_balances").update(openingValues).eq("id", openingId)
      if (obError) return fail()
    } else {
      const { data: ins, error: obError } = await supabase
        .from("opening_balances")
        .insert({ user_id: user.id, ...openingValues })
        .select("id")
        .single()
      if (obError || !ins) return fail()
      setOpeningId(ins.id as string)
    }

    if (kind === "monthly") {
      if (incomeSourceId) {
        const { error: srcError } = await supabase
          .from("income_sources")
          .update({ monthly_days: sortedDays })
          .eq("id", incomeSourceId)
        if (srcError) return fail()
      } else {
        const { data: src, error: srcError } = await supabase
          .from("income_sources")
          .insert({ user_id: user.id, name: "เงินเดือน", schedule_type: "monthly_days", monthly_days: sortedDays })
          .select("id")
          .single()
        if (srcError || !src) return fail()
        setIncomeSourceId(src.id as string)
      }
    } else if (incomeSourceId) {
      // ลองใหม่โดยเปลี่ยนจากตัวเลือก (a) -> ลบแถวที่เคยสร้างไว้
      const { error: delError } = await supabase.from("income_sources").delete().eq("id", incomeSourceId)
      if (delError) return fail()
      setIncomeSourceId(null)
    }

    const { error: profError } = await supabase.from("financial_profile").upsert(
      {
        user_id: user.id,
        mode: "simple",
        target_date: kind === "uncertain" ? targetDate : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    if (profError) return fail()
    // โหลดหน้าใหม่ทั้งหน้า เพื่อให้ Sidebar อ่านค่าใหม่
    window.location.assign("/")
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#1D9E75]" />
      </div>
    )
  }

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
  const primaryBtn =
    "w-full mt-6 btn-height-token bg-[#1D9E75] text-white rounded-xl font-medium hover:bg-[#178a64] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"

  const radioOptions: { value: NextKind; title: string }[] = [
    { value: "monthly", title: "เงินเดือน/รายได้ประจำ เข้าทุกเดือน" },
    { value: "uncertain", title: "ไม่แน่นอน" },
    { value: "unknown", title: "ยังไม่รู้" },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex items-start md:items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm card-padding-token">
        <div className="flex items-center justify-between mb-4 min-h-10">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={saving}
              aria-label="ย้อนกลับ"
              className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <span className="w-10 h-10 rounded-full bg-[#1D9E75] text-white flex items-center justify-center">
              <Wallet size={20} />
            </span>
          )}
          <span className="text-xs text-gray-400">{step}/2</span>
        </div>

        {step === 1 ? (
          <>
            <h1 className="text-xl font-bold text-gray-800 leading-snug">
              {backfill
                ? "ยอดเงินตอนต้นวันนั้น (ประมาณได้)"
                : "ตอนนี้มีเงินที่จะใช้ได้จนถึงเงินเข้าครั้งหน้าเท่าไหร่"}
            </h1>

            {backfill && (
              <div className="mt-4">
                <label htmlFor="backfill-date" className="text-xs text-gray-500 mb-1 block">
                  เงินเดือนออกล่าสุดวันที่
                </label>
                <input
                  id="backfill-date"
                  type="date"
                  min={minBackfill}
                  max={today}
                  value={backfillDate}
                  onChange={(e) => setBackfillDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}

            <input
              value={amountText}
              inputMode="decimal"
              placeholder="0"
              autoFocus
              aria-label="จำนวนเงิน"
              onChange={(e) => setAmountText(e.target.value)}
              onBlur={() => setAmountTouched(true)}
              className="w-full mt-4 border border-gray-200 rounded-xl px-4 py-3 text-3xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
            />
            {(amountError || (amountTouched && amountText.trim() === "")) && (
              <p className="text-xs text-[#D85A30] mt-1">{amountError || "กรอกจำนวนเงิน"}</p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              ไม่ต้องรวมเงินเก็บ และหักค่าเช่าหรือค่าที่ต้องจ่ายก่อนเงินเข้าออกไปด้วย
            </p>

            <button
              type="button"
              onClick={() => setBackfill((v) => !v)}
              className="text-sm text-[#378ADD] hover:underline mt-4 text-left"
            >
              {backfill ? "ไม่ต้องจดย้อนหลัง ใช้ยอดตอนนี้" : "อยากจดย้อนหลังตั้งแต่วันเงินเดือนออก?"}
            </button>

            <button type="button" onClick={() => setStep(2)} disabled={!step1Valid} className={primaryBtn}>
              ถัดไป
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-gray-800 leading-snug">เงินก้อนถัดไปเข้าวันไหน</h1>

            <div role="radiogroup" aria-label="เงินก้อนถัดไป" className="flex flex-col gap-3 mt-4">
              {radioOptions.map((opt) => {
                const selected = kind === opt.value
                return (
                  <div
                    key={opt.value}
                    className={`rounded-xl border-2 p-3 transition-colors ${
                      selected ? "border-[#1D9E75] bg-[#1D9E75]/5" : "border-gray-200"
                    }`}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setKind(opt.value)}
                      disabled={saving}
                      className="w-full text-left flex items-center gap-3 focus:outline-none"
                    >
                      <span
                        className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          selected ? "border-[#1D9E75]" : "border-gray-300"
                        }`}
                      >
                        {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#1D9E75]" />}
                      </span>
                      <span className="text-sm font-medium text-gray-800">{opt.title}</span>
                    </button>

                    {selected && opt.value === "monthly" && (
                      <div className="mt-3">
                        <div className="grid grid-cols-7 gap-1.5">
                          {ALL_DAYS.map((d) => {
                            const on = days.includes(d)
                            return (
                              <button
                                key={d}
                                type="button"
                                aria-pressed={on}
                                onClick={() => toggleDay(d)}
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
                        <p className="text-xs text-gray-400 mt-2">
                          เลือกได้ 1–2 วัน ตั้งแบบละเอียดได้ที่ ตั้งค่า &gt; รายได้และรอบเงิน
                        </p>
                        {days.some((d) => d >= 29) && (
                          <p className="text-xs text-gray-400 mt-1">
                            ถ้าเดือนไหนไม่มีวันนั้น จะนับเป็นวันสุดท้ายของเดือน
                          </p>
                        )}
                      </div>
                    )}

                    {selected && opt.value === "uncertain" && (
                      <div className="mt-3">
                        <label htmlFor="target-date" className="text-xs text-gray-500 mb-1 block">
                          ครั้งหน้าน่าจะเข้าวันที่
                        </label>
                        <input
                          id="target-date"
                          type="date"
                          min={tomorrow}
                          value={targetDate}
                          onChange={(e) => setTargetDate(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    )}

                    {selected && opt.value === "unknown" && (
                      <p className="text-xs text-gray-400 mt-2">แอปจะนับถึงสิ้นเดือนไปก่อน</p>
                    )}
                  </div>
                )
              })}
            </div>

            {next && (
              <p className="text-xs text-gray-500 mt-4 inline-flex items-center gap-1.5">
                <CalendarClock size={14} className="text-[#1D9E75]" />
                เงินเข้าครั้งถัดไป: {next.source === "month_end" ? "สิ้นเดือนนี้" : formatDateLabel(next.date)}
              </p>
            )}

            <button type="button" onClick={handleSubmit} disabled={!step2Valid || saving} className={primaryBtn}>
              {saving && <Loader2 size={18} className="animate-spin" />}
              เริ่มใช้งาน
            </button>
          </>
        )}
      </div>
    </div>
  )
}
