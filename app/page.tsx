"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { formatDate } from "@/lib/utils"
import { Plus, Lightbulb, Scale, X, Wallet, TriangleAlert } from "lucide-react"
import AdjustBalanceModal from "@/app/components/AdjustBalanceModal"
import CarryOverModal from "@/app/components/CarryOverModal"
import { getPeriodTransition, type CarryoverPref, type PeriodTransition } from "@/lib/period-transition"
import { showToast } from "@/app/components/Toast"
import { pickActiveOpening } from "@/lib/opening-balance"
import CategoryIcon from "@/app/components/CategoryIcon"
import { pickInsight, formatMoney, formatThaiShortDate } from "@/lib/daily-budget"
import { todayInBangkok, addDays, getNextIncomeDate, getPreviousIncomeDate, type IncomeSourceSchedule } from "@/lib/income-schedule"
import { calcSpendable, getCurrentPeriod, toLegacyBudget, dayDiff } from "@/lib/spendable"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts"

type Transaction = {
  id: string
  name: string
  amount: number
  date: string
  type: string
  category: string
}

type PayCycle = {
  id: string
  name: string
  start_day: number
  end_day: number
}

type CategoryInfo = {
  name: string
  icon: string
  color?: string
}

type Asset = {
  id: string
  name: string
  asset_group: string
  value: number
}

type OpeningRow = {
  id: string
  amount: number
  opening_date: string
  source: string
  leftover: number | null
  leftover_from: string | null
  created_at: string
}

type ProfileState = {
  carryover_pref: CarryoverPref | null
  last_period_decided: string | null
  income_prompt_dismissed: string | null
}

type IncomeSourceRow = IncomeSourceSchedule & { amount: number | string | null }

const COLORS = ["#1D9E75", "#D85A30", "#378ADD", "#F59E0B", "#8B5CF6", "#EC4899", "#6B7280"]

function calcFinancialScore(
  cycleIncome: number,
  cycleExpense: number,
  cycleBalance: number,
  assets: Asset[],
  transactions: Transaction[],
  liabilities: number
) {
  let score = 0
  const details: { label: string; score: number; max: number; tip: string }[] = []

  const savingRate = cycleIncome > 0 ? ((cycleIncome - cycleExpense) / cycleIncome) * 100 : 0
  const savingScore = Math.max(0, Math.min(25, Math.round((savingRate / 20) * 25)))
  details.push({
    label: "อัตราออม", score: savingScore, max: 25,
    tip: savingRate >= 20 ? "ออมเงินได้ดีมาก!" : savingRate <= 0 ? "รายจ่ายมากกว่ารายรับ ควรปรับแผน" : `ออมอยู่ ${savingRate.toFixed(1)}% เป้า 20%`
  })
  score += savingScore

  const annualIncome = cycleIncome * 12
  // ยังไม่มีรายรับในรอบนี้แต่มีหนี้ → หารด้วย 0 ไม่ได้ ให้คะแนนหนี้เป็น 0 แทนการแสดงว่าดีเยี่ยม
  const noIncomeWithDebt = annualIncome === 0 && liabilities > 0
  const debtRate = annualIncome > 0 ? (liabilities / annualIncome) * 100 : 0
  const debtScore = noIncomeWithDebt ? 0 : debtRate <= 35 ? 25 : debtRate <= 50 ? 15 : debtRate <= 70 ? 8 : 0
  details.push({
  label: "ภาระหนี้สิน", score: debtScore, max: 25,
  tip: noIncomeWithDebt
    ? "มีหนี้แต่ยังไม่มีรายรับในรอบนี้ บันทึกรายรับเพื่อคำนวณภาระหนี้"
    : debtRate <= 35 ? "ภาระหนี้อยู่ในเกณฑ์ดี" : `หนี้ ${debtRate.toFixed(1)}% ของรายได้ทั้งปี เป้า < 35%`
})
  score += debtScore

  const liquidAssets = assets.filter(a => a.asset_group === "liquid").reduce((s, a) => s + Number(a.value), 0)
  const monthlyExpenseAvg = cycleExpense || 1
  const emergencyMonths = liquidAssets / monthlyExpenseAvg
  const emergencyScore = emergencyMonths >= 6 ? 20 : Math.round((emergencyMonths / 6) * 20)
  details.push({
    label: "เงินสำรองฉุกเฉิน", score: emergencyScore, max: 20,
    tip: emergencyMonths >= 6 ? "มีเงินสำรองเพียงพอ!" : `มีเงินสำรอง ${emergencyMonths.toFixed(1)} เดือน เป้า 6 เดือน`
  })
  score += emergencyScore

  const cashflowScore = cycleBalance >= 0 ? 20 : 0
  details.push({
    label: "กระแสเงินสด", score: cashflowScore, max: 20,
    tip: cycleBalance >= 0 ? "รายรับมากกว่ารายจ่าย ดีมาก!" : "รายจ่ายมากกว่ารายรับ ควรปรับแผน"
  })
  score += cashflowScore

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return d.toISOString().split("T")[0]
  })
  const activeDays = last7Days.filter(day => transactions.some(t => t.date === day)).length
  const consistencyScore = Math.round((activeDays / 7) * 10)
  details.push({
    label: "ความสม่ำเสมอ", score: consistencyScore, max: 10,
    tip: activeDays >= 5 ? "บันทึกสม่ำเสมอมาก!" : `บันทึก ${activeDays}/7 วัน ลองบันทึกทุกวัน`
  })
  score += consistencyScore

  return { score: Math.max(0, Math.min(100, score)), details }
}

// แสดงเงินแบบมีเครื่องหมาย: ติดลบ -> -฿X, ใกล้ 0 (< 0.5) -> ฿0
const signedMoney = (x: number): string =>
  Math.abs(x) < 0.5 ? "฿0" : x < 0 ? `-฿${formatMoney(Math.abs(x))}` : `฿${formatMoney(x)}`

const getScoreColor = (score: number) => {
  if (score >= 80) return { text: "text-[#1D9E75]", label: "ยอดเยี่ยม" }
  if (score >= 60) return { text: "text-[#378ADD]", label: "ดี" }
  if (score >= 40) return { text: "text-[#F59E0B]", label: "พอใช้" }
  return { text: "text-[#D85A30]", label: "ต้องปรับปรุง" }
}
export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cycles, setCycles] = useState<PayCycle[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [liabilities, setLiabilities] = useState<{balance: number}[]>([])  // เพิ่มบรรทัดนี้
  const [chartMode, setChartMode] = useState<"bar" | "donut" | "column" | "table">("bar")
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [incomeSources, setIncomeSources] = useState<IncomeSourceRow[]>([])
  const [targetDate, setTargetDate] = useState<string | null>(null)
  const [openingRows, setOpeningRows] = useState<OpeningRow[]>([])
  const [openingLoaded, setOpeningLoaded] = useState(false)
  const [openingError, setOpeningError] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [dismissedId, setDismissedId] = useState<string | null>(null)
  const [dismissCheckedKey, setDismissCheckedKey] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileState | null>(null)
  const [carryModalClosedFor, setCarryModalClosedFor] = useState<string | null>(null)
  const [carrySaving, setCarrySaving] = useState(false)
  const [incomeCheckSaving, setIncomeCheckSaving] = useState(false)
  const [noteDismissedKey, setNoteDismissedKey] = useState<string | null>(null)
  const [noteCheckedKey, setNoteCheckedKey] = useState<string | null>(null)
  const transitionBusy = useRef<boolean>(false)

  // โหลดยอดเงินตั้งต้น (งาน 4: เก็บข้อมูลและจุดเข้าปรับยอดเท่านั้น ยังไม่ใช้คำนวณ)
  const fetchOpening = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setOpeningError(false)
    const { data, error } = await supabase
      .from("opening_balances")
      .select("id, amount, opening_date, source, leftover, leftover_from, created_at")
      .eq("user_id", user.id)
    if (error) {
      showToast("โหลดยอดเงินตั้งต้นไม่สำเร็จ", "error")
      setOpeningError(true)
      return
    }
    setOpeningRows(((data || []) as OpeningRow[]).map(r => ({ ...r, amount: Number(r.amount), leftover: r.leftover === null || r.leftover === undefined ? null : Number(r.leftover) })))
    setOpeningLoaded(true)
  }, [])

  useEffect(() => {
    fetchOpening()
  }, [fetchOpening])

  useEffect(() => {
    const handler = () => { fetchOpening() }
    window.addEventListener("openingBalanceChanged", handler)
    return () => window.removeEventListener("openingBalanceChanged", handler)
  }, [fetchOpening])

  const activeOpening = pickActiveOpening(openingRows)
  const dismissKey = activeOpening ? `backfillCardDismissed:${activeOpening.id}` : null
  useEffect(() => {
    if (!dismissKey) return
    const t = setTimeout(() => {
      let dismissed = false
      try {
        dismissed = !!localStorage.getItem(dismissKey)
      } catch {
        // localStorage ใช้ไม่ได้ (เช่น โหมดส่วนตัว) -> ถือว่ายังไม่เคยปิด
      }
      setDismissedId(dismissed ? dismissKey : null)
      setDismissCheckedKey(dismissKey)
    }, 0)
    return () => clearTimeout(t)
  }, [dismissKey])
  const showBackfillCard = !!activeOpening && activeOpening.source === "onboarding_backfill" && dismissCheckedKey === dismissKey && dismissedId !== dismissKey

  // ดึงข้อมูลทั้งหมด — แยกเป็น callback เพื่อเรียกซ้ำได้ตอนบันทึกรายการใหม่ (event transactionAdded)
  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: txData }, { data: cycleData }, { data: assetData }, { data: liabData }, { data: catData }, { data: srcData, error: srcError }, { data: profData, error: profError }] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("pay_cycles").select("*").eq("user_id", user.id),
      supabase.from("assets").select("*").eq("user_id", user.id),
      supabase.from("liabilities_long").select("balance").eq("user_id", user.id),
      supabase.from("categories").select("name, icon, color").eq("user_id", user.id),
      supabase.from("income_sources").select("schedule_type, monthly_days, amount").eq("user_id", user.id),
      supabase.from("financial_profile").select("target_date, carryover_pref, last_period_decided, income_prompt_dismissed").eq("user_id", user.id).maybeSingle(),
    ])
    if (srcError || profError) {
      showToast("โหลดข้อมูลไม่สำเร็จ", "error")
    }
    setIncomeSources((srcData || []) as IncomeSourceRow[])
    const prof = profData as (ProfileState & { target_date: string | null }) | null
    setTargetDate(prof?.target_date ?? null)
    // อ่านโปรไฟล์ไม่สำเร็จ -> ปล่อย profile เดิม (ไม่เดาว่าเคยตัดสินใจหรือยัง)
    if (!profError) {
      setProfile({
        carryover_pref: prof?.carryover_pref ?? null,
        last_period_decided: prof?.last_period_decided ?? null,
        income_prompt_dismissed: prof?.income_prompt_dismissed ?? null,
      })
    }
    setTransactions(txData || [])
    setCycles(cycleData || [])
    setAssets(assetData || [])
    setLiabilities(liabData || [])
    setCategories((catData || []) as CategoryInfo[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // บันทึกรายการจาก FAB/ปุ่มด่วน -> โหลดใหม่ให้การ์ด "ใช้ได้วันนี้" อัปเดตทันที
  useEffect(() => {
    const handler = () => { fetchData() }
    window.addEventListener("transactionAdded", handler)
    return () => window.removeEventListener("transactionAdded", handler)
  }, [fetchData])

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  // ---- ตัดสินช่วงรอบ "ที่เดียว" ให้ทุกส่วนของ Dashboard ใช้ร่วมกัน (วันเงินเข้าล่าสุด ถึงวันก่อนเงินเข้าครั้งถัดไป) ----
  const today = todayInBangkok()
  const next = getNextIncomeDate(today, { incomeSources, payCycles: cycles, targetDate })
  const prev = getPreviousIncomeDate(today, { incomeSources, payCycles: cycles })
  const period = getCurrentPeriod(today, prev?.date ?? null, next.date, activeOpening?.opening_date ?? today)
  const spend = activeOpening
    ? calcSpendable({
        today,
        opening: { amount: activeOpening.amount, opening_date: activeOpening.opening_date },
        transactions,
        nextIncomeDate: next.date,
      })
    : null
  // ยอดรอบนี้เป็น 0 พอดี (เช่น ขึ้นรอบใหม่แบบไม่ยกยอด) ไม่ใช่ใช้เกิน → แสดงเป็นข้อมูล ไม่ใช่ความผิดพลาด
  const zeroBalance: boolean = !!spend && spend.state === "negative" && Math.round(spend.overBy) === 0

  // ---- ขึ้นรอบใหม่ (งาน 5c) ----
  const prevPaydayDate = prev?.date ?? null
  const prevPeriodStart = prevPaydayDate
    ? getPreviousIncomeDate(addDays(prevPaydayDate, -1), { incomeSources, payCycles: cycles })?.date ?? null
    : null
  const transition: PeriodTransition = useMemo(() => {
    // ยังโหลดไม่ครบ (ยอดตั้งต้น/โปรไฟล์/รายการ) -> ไม่ทำอะไร
    if (loading || !openingLoaded || !profile || !activeOpening) return { kind: "none" }
    return getPeriodTransition({
      today,
      prevIncomeDate: prevPaydayDate,
      prevPeriodStart,
      opening: { amount: activeOpening.amount, opening_date: activeOpening.opening_date },
      transactions,
      lastPeriodDecided: profile.last_period_decided,
      incomePromptDismissed: profile.income_prompt_dismissed,
      pref: profile.carryover_pref,
    })
  }, [loading, openingLoaded, profile, activeOpening, today, prevPaydayDate, prevPeriodStart, transactions])

  // บันทึกการตัดสินใจเรื่องยกยอด: mode "reset" = ไม่ยก (เพิ่มแถว carryover ยอด 0), "mark" = แค่จดว่าตัดสินแล้ว
  // คืน true เมื่อสำเร็จทั้งหมด; error ใดๆ แจ้ง toast แล้วคืน false
  const applyDecision = useCallback(async (
    payday: string,
    leftover: number,
    prevStart: string,
    mode: "reset" | "mark",
    remember: CarryoverPref | null
  ): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return false
    }
    if (mode === "reset") {
      // กันเพิ่มแถวซ้ำ: ถ้าเคยเพิ่มแถว carryover ของวันเงินเข้านี้แล้ว (แต่บันทึกโปรไฟล์พลาด) ข้ามการเพิ่ม
      const { data: existing, error: exError } = await supabase
        .from("opening_balances")
        .select("id")
        .eq("user_id", user.id)
        .eq("source", "carryover")
        .eq("opening_date", payday)
        .limit(1)
      if (exError) {
        showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
        return false
      }
      if (!existing || existing.length === 0) {
        const { error: insError } = await supabase.from("opening_balances").insert({
          user_id: user.id,
          amount: 0,
          entered_amount: 0,
          opening_date: payday,
          source: "carryover",
          leftover,
          leftover_from: prevStart,
        })
        if (insError) {
          showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
          return false
        }
        window.dispatchEvent(new CustomEvent("openingBalanceChanged"))
      }
    }
    const patch: { last_period_decided: string; carryover_pref?: CarryoverPref } = { last_period_decided: payday }
    if (remember) patch.carryover_pref = remember
    const { error: profUpError } = await supabase.from("financial_profile").upsert(
      { user_id: user.id, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    if (profUpError) {
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return false
    }
    setProfile(p => ({
      carryover_pref: remember ?? p?.carryover_pref ?? null,
      last_period_decided: payday,
      income_prompt_dismissed: p?.income_prompt_dismissed ?? null,
    }))
    return true
  }, [])

  // การกระทำอัตโนมัติ (ไม่ต้องถามผู้ใช้): ยกยอดเสมอ / ไม่ยกเสมอ / ติดลบ / ศูนย์
  useEffect(() => {
    if (transition.kind !== "carry" || transition.action === "ask") return
    if (transitionBusy.current) return
    transitionBusy.current = true
    const mode = transition.action === "auto-reset" || transition.action === "negative" ? "reset" : "mark"
    applyDecision(transition.payday, transition.leftover, transition.prevStart, mode, null).finally(() => {
      transitionBusy.current = false
    })
  }, [transition, applyDecision])

  const askCarry = transition.kind === "carry" && transition.action === "ask" ? transition : null

  const handleCarryChoice = async (mode: "reset" | "mark", remember: boolean) => {
    if (!askCarry || transitionBusy.current) return
    transitionBusy.current = true
    setCarrySaving(true)
    const ok = await applyDecision(askCarry.payday, askCarry.leftover, askCarry.prevStart, mode, remember ? (mode === "reset" ? "reset" : "carry") : null)
    transitionBusy.current = false
    setCarrySaving(false)
    if (ok) showToast(mode === "reset" ? "เริ่มรอบใหม่โดยไม่ยกยอด" : "ยกยอดไปรอบนี้แล้ว", "success")
  }

  // ขั้น "เงินเข้าแล้วหรือยัง"
  const incomeCheck = transition.kind === "income-check" ? transition : null
  const handleIncomeNotYet = async () => {
    if (!incomeCheck || incomeCheckSaving) return
    setIncomeCheckSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setIncomeCheckSaving(false)
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return
    }
    const { error } = await supabase.from("financial_profile").upsert(
      { user_id: user.id, income_prompt_dismissed: incomeCheck.payday, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    setIncomeCheckSaving(false)
    if (error) {
      showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
      return
    }
    setProfile(p => ({
      carryover_pref: p?.carryover_pref ?? null,
      last_period_decided: p?.last_period_decided ?? null,
      income_prompt_dismissed: incomeCheck.payday,
    }))
  }
  const handleIncomeRecord = () => {
    if (!incomeCheck) return
    window.dispatchEvent(new CustomEvent("openQuickAdd", {
      detail: { amount: null, type: "income", date: incomeCheck.payday },
    }))
  }

  // รอบก่อนติดลบ: แสดงหมายเหตุที่ปิดได้ (เก็บการปิดใน localStorage ตามวันเริ่มรอบ)
  const negNoteKey =
    activeOpening && activeOpening.source === "carryover" && activeOpening.leftover !== null && activeOpening.leftover < 0
      ? `negativeNoteDismissed:${activeOpening.opening_date}`
      : null
  useEffect(() => {
    if (!negNoteKey) return
    const t = setTimeout(() => {
      let dismissed = false
      try {
        dismissed = !!localStorage.getItem(negNoteKey)
      } catch {
        // localStorage ใช้ไม่ได้ -> ถือว่ายังไม่เคยปิด
      }
      setNoteDismissedKey(dismissed ? negNoteKey : null)
      setNoteCheckedKey(negNoteKey)
    }, 0)
    return () => clearTimeout(t)
  }, [negNoteKey])
  const showNegNote = !!negNoteKey && !!activeOpening && activeOpening.opening_date === period.start && noteCheckedKey === negNoteKey && noteDismissedKey !== negNoteKey

  // รายการในรอบ — ใช้ช่วงวันที่เดียวกับ hero ทุกส่วนของ Dashboard จึงตัวเลขตรงกัน
  const cycleTransactions = transactions.filter(t => t.date >= period.start && t.date <= period.end && t.date <= today)
  const sumType = (txs: Transaction[], type: string): number =>
    txs.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount), 0)

  const cycleIncome = sumType(cycleTransactions, "income")
  const cycleExpense = sumType(cycleTransactions, "expense")
  const cycleBalance = cycleIncome - cycleExpense

  const insight = spend
    ? pickInsight(transactions, toLegacyBudget(spend, period, { income: cycleIncome, expense: cycleExpense, balance: cycleBalance }), today)
    : null
  const todayTransactions = transactions.filter(t => t.date === today)
  const todayTop5 = todayTransactions.slice(0, 5)
  const categoryByName = new Map(categories.map(c => [c.name, c]))
  const spentPct = spend && spend.todayBudget > 0 ? Math.min(100, (spend.todayExpense / spend.todayBudget) * 100) : 100

  const totalLiabilities = liabilities.reduce((s, l) => s + Number(l.balance), 0)
  const { score: financialScore, details: scoreDetails } = calcFinancialScore(cycleIncome, cycleExpense, cycleBalance, assets, transactions, totalLiabilities)
  const scoreColor = getScoreColor(financialScore)

  // รอบก่อนหน้า: จบวันก่อนเริ่มรอบนี้ เริ่มที่วันเงินเข้าครั้งก่อนหน้านั้น (ไม่มี -> วันแรกของเดือน)
  const prevEnd = addDays(period.start, -1)
  const prevStart = getPreviousIncomeDate(prevEnd, { incomeSources, payCycles: cycles })?.date ?? `${prevEnd.slice(0, 7)}-01`
  const prevTx = transactions.filter(t => t.date >= prevStart && t.date <= prevEnd && t.date <= today)
  const prevIncome = sumType(prevTx, "income")
  const prevExpense = sumType(prevTx, "expense")

  const pctChange = (current: number, prev: number) => {
    if (prev === 0) return null
    return ((current - prev) / prev * 100).toFixed(1)
  }

  const expenseByCategory = Object.entries(
    cycleTransactions.filter(t => t.type === "expense")
      .reduce((acc, t) => {
        const key = t.category || "อื่นๆ"
        acc[key] = (acc[key] || 0) + Number(t.amount)
        return acc
      }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const totalExpenseForPct = expenseByCategory.reduce((s, c) => s + c.value, 0)

  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - 5 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("th-TH", { month: "short" })
    const monthTx = transactions.filter(t => t.date?.startsWith(key))
    return {
      label, key,
      income: monthTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
      expense: monthTx.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
    }
  })

  const latest5 = transactions.slice(0, 5)
  let runningBalance = transactions.reduce((s, t) => t.type === "income" ? s + Number(t.amount) : s - Number(t.amount), 0)
  const latest5WithBalance = latest5.map((t) => {
    const bal = runningBalance
    if (t.type === "income") {
      runningBalance -= Number(t.amount)
    } else {
      runningBalance += Number(t.amount)
    }
    return { ...t, balance: bal }
  })

  if (loading || (!openingLoaded && !openingError)) {
    return (
      <div className="p-4 md:p-6 bg-gray-50 min-h-screen animate-pulse">
        <div className="h-7 w-32 bg-gray-200 rounded mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-3 md:mb-4">
          <div className="bg-gray-200 rounded-2xl h-44" />
          <div className="bg-white rounded-xl shadow-sm p-4 h-44">
            <div className="h-3 w-32 bg-gray-200 rounded mb-4" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-3 md:p-4 shadow-sm h-20">
              <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
              <div className="h-5 w-20 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-5 mb-6 h-64">
          <div className="h-4 w-40 bg-gray-200 rounded mb-4" />
          <div className="w-24 h-24 rounded-full bg-gray-200 mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="md:col-span-2 bg-white rounded-xl p-4 md:p-5 shadow-sm h-56" />
          <div className="bg-white rounded-xl p-4 md:p-5 shadow-sm h-56" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">ภาพรวม</h1>

      {/* ถึงวันเงินเข้าแล้วแต่ยังไม่มีรายรับ -> ถามว่าเงินเข้าแล้วหรือยัง */}
      {incomeCheck && (
        <div className="bg-white rounded-xl p-4 shadow-sm mb-3 md:mb-4 flex flex-col md:flex-row md:items-center gap-3">
          <p className="flex-1 text-sm text-gray-700 inline-flex items-center gap-2">
            <Wallet size={18} className="text-[#1D9E75] shrink-0" />
            วันที่ {formatThaiShortDate(incomeCheck.payday)} เงินเข้าแล้วหรือยัง?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleIncomeRecord}
              className="flex-1 md:flex-none bg-[#1D9E75] text-white rounded-lg px-4 min-h-11 text-sm font-medium hover:bg-[#178a64] transition-colors"
            >
              บันทึกรายรับ
            </button>
            <button
              type="button"
              onClick={handleIncomeNotYet}
              disabled={incomeCheckSaving}
              className="flex-1 md:flex-none border border-gray-200 rounded-lg px-4 min-h-11 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              ยังไม่เข้า
            </button>
          </div>
        </div>
      )}

      {/* รอบก่อนติดลบ (ไม่หักจากรอบใหม่) */}
      {showNegNote && activeOpening && activeOpening.leftover !== null && (
        <div className="bg-white rounded-xl p-4 shadow-sm mb-3 md:mb-4 flex items-start gap-3">
          <TriangleAlert size={18} className="text-[#D85A30] shrink-0 mt-0.5" />
          <p className="flex-1 text-sm text-gray-700">
            รอบก่อนติดลบ ฿{formatMoney(Math.abs(activeOpening.leftover))} อาจลืมจดรายรับ
          </p>
          <button
            type="button"
            aria-label="ปิด"
            onClick={() => {
              if (negNoteKey) {
                try {
                  localStorage.setItem(negNoteKey, "1")
                } catch {
                  // บันทึกไม่ได้ก็ปิดแค่ในรอบนี้
                }
              }
              setNoteDismissedKey(negNoteKey)
            }}
            className="p-2 -mr-2 -mt-2 text-gray-400 hover:text-gray-600 rounded-lg shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* จดย้อนหลังเสร็จแล้ว ให้เช็คยอดจริง */}
      {showBackfillCard && (
        <div className="bg-white rounded-xl p-4 shadow-sm mb-3 md:mb-4 flex items-start md:items-center gap-3">
          <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-3">
            <p className="flex-1 text-sm text-gray-700">จดย้อนหลังเสร็จแล้ว? เช็คยอดจริงตอนนี้</p>
            <button
              type="button"
              onClick={() => setAdjustOpen(true)}
              className="self-start bg-[#1D9E75] text-white rounded-lg px-4 min-h-11 text-sm font-medium hover:bg-[#178a64] transition-colors"
            >
              ปรับยอดเงิน
            </button>
          </div>
          <button
            type="button"
            aria-label="ปิด"
            onClick={() => {
              if (dismissKey) {
                try {
                  localStorage.setItem(dismissKey, "1")
                } catch {
                  // บันทึกไม่ได้ก็ปิดแค่ในรอบนี้
                }
              }
              setDismissedId(dismissKey)
            }}
            className="p-2 -mr-2 -mt-1 md:mt-0 text-gray-400 hover:text-gray-600 rounded-lg shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Hero + บันทึกด่วน — mobile เรียงบนลงล่าง, desktop (md+) แบ่ง 2 คอลัมน์ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-3 md:mb-4">
        {/* Hero: ใช้ได้วันนี้ */}
        <div
          className="rounded-2xl p-4 md:p-6 text-white shadow-sm flex flex-col justify-between"
          style={{ backgroundColor: !spend ? (openingError ? "#6B7280" : "#378ADD") : zeroBalance ? "#378ADD" : spend.state === "ok" ? "#1D9E75" : "#D85A30" }}
        >
          {!spend && openingError ? (
            <>
              <p className="text-sm opacity-90">ใช้ได้วันนี้</p>
              <p className="text-[2rem] leading-tight font-bold mt-1">โหลดยอดเงินไม่สำเร็จ</p>
              <button
                type="button"
                onClick={() => { setOpeningError(false); fetchOpening() }}
                className="self-start mt-3 bg-white text-gray-700 rounded-lg px-4 min-h-11 text-sm font-semibold hover:bg-white/90 transition-colors"
              >
                ลองใหม่
              </button>
            </>
          ) : !spend ? (
            <>
              <p className="text-sm opacity-90">ใช้ได้วันนี้</p>
              <p className="text-[2rem] leading-tight font-bold mt-1">ตั้งยอดเงินก่อน</p>
              <p className="text-sm opacity-90 mt-2">ตั้งยอดเงินเพื่อดูว่าวันนี้ใช้ได้เท่าไหร่</p>
              {openingLoaded && (
                <button
                  type="button"
                  onClick={() => setAdjustOpen(true)}
                  className="self-start mt-3 bg-white text-[#378ADD] rounded-lg px-4 min-h-11 text-sm font-semibold hover:bg-white/90 transition-colors"
                >
                  ตั้งยอดเงิน
                </button>
              )}
            </>
          ) : spend.state === "negative" ? (
            zeroBalance ? (
              <>
                <p className="text-sm opacity-90">ใช้ได้วันนี้</p>
                <p className="text-[2rem] leading-tight font-bold mt-1">ยังไม่มีเงินรอบนี้</p>
                <p className="text-sm opacity-90 mt-3">จดรายรับเมื่อเงินเข้า</p>
              </>
            ) : (
              <>
                <p className="text-sm opacity-90">ใช้เกินไปแล้ว</p>
                <p className="text-[2.5rem] tabular-nums leading-tight font-bold mt-1">
                  {`฿${formatMoney(spend.overBy)}`}
                </p>
                <p className="text-sm opacity-90 mt-3">ถ้าตัวเลขไม่ตรงกับเงินจริง กด ปรับยอดเงิน ได้</p>
              </>
            )
          ) : (
            <>
              <p className="text-sm opacity-90">{spend.state === "over" ? "วันนี้ใช้เกินไป" : "ใช้ได้วันนี้"}</p>
              <p className="text-[2.5rem] leading-tight font-bold tabular-nums mt-1">
                {spend.state === "over"
                  ? `-฿${formatMoney(Math.max(1, spend.overBy))}`
                  : `฿${formatMoney(Math.max(0, spend.availableToday))}`}
              </p>
              <div className="h-2 bg-white/30 rounded-full mt-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(spentPct)}>
                <div className="h-2 rounded-full bg-white transition-all" style={{ width: `${spentPct}%` }} />
              </div>
              <p className="text-sm mt-3">
                วันนี้ใช้ไป <span className="font-semibold tabular-nums">฿{formatMoney(spend.todayExpense)}</span>
                {" "}จาก <span className="font-semibold tabular-nums">฿{formatMoney(Math.max(0, spend.todayBudget))}</span>
              </p>
              {spend.state === "over" && (
                <p className="text-sm opacity-90 mt-1">
                  {spend.tomorrowBudget === null
                    ? "วันนี้เป็นวันสุดท้ายของรอบ"
                    : spend.tomorrowBudget > 0
                      ? <>พรุ่งนี้ใช้ได้ <span className="font-semibold tabular-nums">฿{formatMoney(spend.tomorrowBudget)}</span>/วัน</>
                      : "พรุ่งนี้ยังไม่มีงบเหลือ"}
                </p>
              )}
            </>
          )}
          {spend && activeOpening && activeOpening.source === "carryover" && activeOpening.leftover !== null && activeOpening.leftover > 0 && activeOpening.opening_date === period.start && (
            <p className="text-xs opacity-90 mt-3">
              เหลือจากรอบที่แล้ว ({formatThaiShortDate(activeOpening.leftover_from ?? prevStart)} – {formatThaiShortDate(prevEnd)}){" "}
              <span className="font-semibold tabular-nums">฿{formatMoney(activeOpening.leftover)}</span>
            </p>
          )}
          {spend && (
            <p className="text-xs opacity-90 mt-3">
              รอบนี้ {formatThaiShortDate(period.start)} – {formatThaiShortDate(period.end)} (เหลือ {spend.daysLeftInclToday} วัน)
              {next.source === "month_end" && (
                <>
                  {" · "}
                  <Link href="/settings?tab=paycycles" className="underline underline-offset-2 hover:text-white">ยังไม่ได้ตั้งวันเงินเข้า</Link>
                </>
              )}
            </p>
          )}
          {activeOpening && (
            <button
              type="button"
              onClick={() => setAdjustOpen(true)}
              className="self-start mt-3 text-xs text-white/90 underline underline-offset-2 hover:text-white inline-flex items-center gap-1"
            >
              <Scale size={12} /> ปรับยอดเงิน
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3 md:gap-4">
          {/* บันทึกรายจ่ายด่วน */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-3">บันทึกรายจ่ายด่วน</p>
            <div className="grid grid-cols-4 gap-2">
              {[50, 100, 200].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("openQuickAdd", { detail: { amount: amt, type: "expense" } }))}
                  className="min-h-12 rounded-lg bg-gray-50 border border-gray-200 text-sm font-semibold text-gray-800 tabular-nums hover:bg-gray-100 transition-colors"
                >
                  ฿{amt}
                </button>
              ))}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("openQuickAdd", { detail: { amount: null, type: "expense" } }))}
                className="min-h-12 rounded-lg border border-[#1D9E75] text-[#1D9E75] text-sm font-semibold flex items-center justify-center gap-1 hover:bg-green-50 transition-colors"
              >
                <Plus size={16} /> อื่นๆ
              </button>
            </div>
          </div>

          {/* Insight */}
          {insight && (
            <div className="bg-white rounded-xl p-4 shadow-sm flex items-start gap-3">
              <span className="w-9 h-9 rounded-full bg-blue-50 text-[#378ADD] flex items-center justify-center shrink-0">
                <Lightbulb size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-gray-700">
                  {insight.parts.map((p, i) => (
                    p.bold ? <span key={i} className="font-bold text-gray-900">{p.text}</span> : <span key={i}>{p.text}</span>
                  ))}
                </p>
                {insight.caption && <p className="text-xs text-gray-400 mt-1">{insight.caption}</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* รายรับ/รายจ่ายรอบนี้ */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6">
        {[
          { label: "รายรับรอบนี้", value: cycleIncome, color: "text-[#1D9E75]", pct: pctChange(cycleIncome, prevIncome) },
          { label: "รายจ่ายรอบนี้", value: cycleExpense, color: "text-[#D85A30]", pct: pctChange(cycleExpense, prevExpense) },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-lg md:text-xl font-bold tabular-nums ${card.color}`}>฿{formatMoney(card.value)}</p>
            {card.pct !== null && (
              <p className={`text-xs mt-1 ${Number(card.pct) >= 0 ? "text-[#1D9E75]" : "text-[#D85A30]"}`}>
                {Number(card.pct) >= 0 ? "▲" : "▼"} {Math.abs(Number(card.pct))}% จากรอบก่อน
              </p>
            )}
          </div>
        ))}
      </div>

      {/* รายการวันนี้ (ไม่มีรายการ -> ไม่แสดง เพราะ insight บอกอยู่แล้ว) */}
      {todayTop5.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">รายการวันนี้</h2>
            <Link href="/transaction" className="text-xs text-[#378ADD] hover:underline">ดูทั้งหมด</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {todayTop5.map(t => {
              const cat = t.category ? categoryByName.get(t.category) : undefined
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 md:px-5 py-3">
                  <CategoryIcon icon={cat?.icon} color={cat?.color} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{t.name || t.category || (t.type === "income" ? "รายรับ" : "รายจ่าย")}</p>
                    {t.category && <p className="text-xs text-gray-400 truncate">{t.category}</p>}
                  </div>
                  <p className={`text-sm font-semibold tabular-nums ${t.type === "income" ? "text-[#1D9E75]" : "text-[#D85A30]"}`}>
                    {t.type === "income" ? "+" : "-"}฿{formatMoney(Number(t.amount))}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Financial Score — แก้ให้ fit มือถือ */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">คะแนนสุขภาพการเงิน</h2>

        {/* วงกลมคะแนน + label อยู่บนสุด กึ่งกลาง */}
        <div className="flex flex-col items-center mb-4">
          <div className="relative w-24 h-24">
            <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3"
                strokeDasharray={`${financialScore} 100`} strokeLinecap="round"
                style={{ stroke: financialScore >= 80 ? "#1D9E75" : financialScore >= 60 ? "#378ADD" : financialScore >= 40 ? "#F59E0B" : "#D85A30" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className={`text-2xl font-bold ${scoreColor.text}`}>{financialScore}</p>
              <p className="text-xs text-gray-400">/ 100</p>
            </div>
          </div>
          <p className={`text-base font-bold ${scoreColor.text} mt-2`}>{scoreColor.label}</p>
        </div>

        {/* progress bars แต่ละด้าน */}
        <div className="flex flex-col gap-3">
          {scoreDetails.map(d => (
            <div key={d.label}>
              <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                <span>{d.label}</span>
                <span>{d.score}/{d.max}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full">
                <div className="h-1.5 rounded-full transition-all"
                  style={{
  width: `${Math.max(0, Math.min(100, (d.score / d.max) * 100))}%`,
                    backgroundColor: d.score === d.max ? "#1D9E75" : d.score >= d.max * 0.5 ? "#F59E0B" : "#D85A30"
                  }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{d.tip}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* กราฟรายจ่ายแบ่งหมวด */}
        <div className="md:col-span-2 bg-white rounded-xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">รายจ่ายแบ่งหมวด</h2>
            <div className="flex gap-1">
              {(["bar", "donut", "column", "table"] as const).map((mode) => (
                <button key={mode} onClick={() => setChartMode(mode)}
                  className={`px-2 py-1 text-xs rounded-lg transition-colors ${chartMode === mode ? "bg-[#1D9E75] text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                  {mode === "bar" ? "≡" : mode === "donut" ? "◎" : mode === "column" ? "▐" : "⊞"}
                </button>
              ))}
            </div>
          </div>
          {expenseByCategory.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">ยังไม่มีรายจ่ายในรอบนี้</p>
              <p className="text-xs text-gray-400 mt-1">กดปุ่ม + เพื่อบันทึกรายจ่ายแรกของคุณ</p>
            </div>
          ) : (
            <>
              {chartMode === "bar" && (
                <div className="flex flex-col gap-2">
                  {expenseByCategory.map((c, i) => (
                    <div key={c.name}>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>{c.name}</span><span>฿{c.value.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full">
                        <div className="h-2 rounded-full" style={{ width: `${(c.value / totalExpenseForPct) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {chartMode === "donut" && (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={expenseByCategory} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value">
                      {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip formatter={(v) => `฿${Number(v ?? 0).toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {chartMode === "column" && (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={expenseByCategory}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `฿${Number(v ?? 0).toLocaleString()}`} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {chartMode === "table" && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b">
                      <th className="text-left py-2">หมวด</th>
                      <th className="text-right py-2">จำนวน</th>
                      <th className="text-right py-2">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseByCategory.map((c, i) => (
                      <tr key={c.name} className="border-b border-gray-50">
                        <td className="py-2 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          {c.name}
                        </td>
                        <td className="py-2 text-right">฿{c.value.toLocaleString()}</td>
                        <td className="py-2 text-right text-gray-500">{((c.value / totalExpenseForPct) * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>

        {/* นับถอยหลังรอบเงินเดือน */}
        <div className="bg-white rounded-xl p-4 md:p-5 shadow-sm flex flex-col justify-between">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">รอบเงินเดือน</h2>
          <div className="text-center py-4">
            <p className="text-5xl font-bold text-[#378ADD]">{dayDiff(next.date, today)}</p>
            <p className="text-sm text-gray-500 mt-1">วันถึงเงินเข้า</p>
            {next.source === "month_end" ? (
              <p className="text-xs text-gray-400 mt-1">ยังไม่ได้ตั้งวันเงินเข้า</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">
                เงินเข้าครั้งถัดไป {formatThaiShortDate(next.date)}
              </p>
            )}
            <Link href="/settings?tab=paycycles" className="text-xs text-[#378ADD] hover:underline mt-2 block">ตั้งค่ารายได้และรอบเงิน →</Link>
          </div>
          {spend && (
            <div className="mt-4 bg-gray-50 rounded-xl p-3 text-sm">
              <div className="flex justify-between text-gray-600 mb-1">
                <span>คงเหลือ</span>
                <span className={`font-semibold ${spend.balanceNow >= 0 ? "text-[#1D9E75]" : "text-[#D85A30]"}`}>{signedMoney(spend.balanceNow)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>ใช้ได้/วัน</span>
                <span className="font-semibold text-[#378ADD]">฿{formatMoney(Math.max(0, spend.todayBudget))}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* กราฟย้อนหลัง 6 เดือน */}
      <div className="bg-white rounded-xl p-4 md:p-5 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">รายรับ vs รายจ่าย ย้อนหลัง 6 เดือน</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={last6Months} barGap={4}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => `฿${Number(v ?? 0).toLocaleString()}`} />
            <Bar dataKey="income" name="รายรับ" fill="#1D9E75" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="รายจ่าย" fill="#D85A30" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ตารางรายการล่าสุด — mobile แสดงแบบ card แทนตาราง */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">รายการล่าสุด</h2>
          <Link href="/transaction" className="text-xs text-[#378ADD] hover:underline">ดูทั้งหมด →</Link>
        </div>

        {latest5WithBalance.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-400 text-sm">ยังไม่มีรายการ</p>
            <p className="text-xs text-gray-400 mt-1">เริ่มบันทึกรายรับ-รายจ่ายแรกของคุณผ่านปุ่ม + ด้านล่าง</p>
          </div>
        ) : (
          <>
            {/* Desktop — ตาราง */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["วันที่", "รายการ", "ประเภท", "จำนวน", "คงเหลือ"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {latest5WithBalance.map((t) => (
                    <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">{formatDate(t.date)}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{t.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${t.type === "income" ? "bg-green-100 text-[#1D9E75]" : "bg-red-100 text-[#D85A30]"}`}>
                          {t.type === "income" ? "รายรับ" : "รายจ่าย"}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-semibold ${t.type === "income" ? "text-[#1D9E75]" : "text-[#D85A30]"}`}>
                        {t.type === "income" ? "+" : "-"}฿{Number(t.amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-700">฿{t.balance.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile — card list แทนตาราง */}
            <div className="md:hidden divide-y divide-gray-100">
              {latest5WithBalance.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{t.name}</p>
                    <p className="text-xs text-gray-400">{formatDate(t.date)}</p>
                  </div>
                  <div className="text-right ml-3">
                    <p className={`text-sm font-semibold ${t.type === "income" ? "text-[#1D9E75]" : "text-[#D85A30]"}`}>
                      {t.type === "income" ? "+" : "-"}฿{Number(t.amount).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">คงเหลือ ฿{t.balance.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <AdjustBalanceModal open={adjustOpen} onClose={() => setAdjustOpen(false)} />

      <CarryOverModal
        open={!!askCarry && carryModalClosedFor !== askCarry.payday}
        leftover={askCarry?.leftover ?? 0}
        prevRangeLabel={askCarry ? `${formatThaiShortDate(askCarry.prevStart)} – ${formatThaiShortDate(askCarry.prevEnd)}` : ""}
        saving={carrySaving}
        onCarry={(remember) => handleCarryChoice("mark", remember)}
        onReset={(remember) => handleCarryChoice("reset", remember)}
        onClose={() => { if (askCarry) setCarryModalClosedFor(askCarry.payday) }}
      />
    </div>
  )
}