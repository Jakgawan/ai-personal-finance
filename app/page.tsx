"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { formatDate } from "@/lib/utils"
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

type Asset = {
  id: string
  name: string
  asset_group: string
  value: number
}

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
  const debtRate = annualIncome > 0 ? (liabilities / annualIncome) * 100 : 0
  const debtScore = debtRate <= 35 ? 25 : debtRate <= 50 ? 15 : debtRate <= 70 ? 8 : 0
  details.push({
  label: "ภาระหนี้สิน", score: debtScore, max: 25,
  tip: debtRate <= 35 ? "ภาระหนี้อยู่ในเกณฑ์ดี" : `หนี้ ${debtRate.toFixed(1)}% ของรายได้ทั้งปี เป้า < 35%`
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

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: txData }, { data: cycleData }, { data: assetData }, { data: liabData }] = await Promise.all([
  supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }),
  supabase.from("pay_cycles").select("*").eq("user_id", user.id),
  supabase.from("assets").select("*").eq("user_id", user.id),
  supabase.from("liabilities_long").select("balance").eq("user_id", user.id),  // เพิ่มบรรทัดนี้
])
      setTransactions(txData || [])
setCycles(cycleData || [])
setAssets(assetData || [])
setLiabilities(liabData || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const today = new Date()
  const currentDay = today.getDate()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()

  const activeCycle = cycles.find(c => {
    if (c.start_day > c.end_day) return currentDay >= c.start_day || currentDay <= c.end_day
    return currentDay >= c.start_day && currentDay <= c.end_day
  }) || cycles[0] || null

  let daysLeft = 0
  let cycleStart: Date | null = null
  let cycleEnd: Date | null = null

  if (activeCycle) {
    const s = activeCycle.start_day
    const e = activeCycle.end_day
    if (s > e) {
      if (currentDay >= s) {
        cycleStart = new Date(currentYear, currentMonth, s)
        cycleEnd = new Date(currentYear, currentMonth + 1, e)
      } else {
        cycleStart = new Date(currentYear, currentMonth - 1, s)
        cycleEnd = new Date(currentYear, currentMonth, e)
      }
    } else {
      cycleStart = new Date(currentYear, currentMonth, s)
      cycleEnd = new Date(currentYear, currentMonth, e)
    }
    const diff = cycleEnd.getTime() - today.getTime()
    daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const cycleTransactions = cycleStart && cycleEnd
    ? transactions.filter(t => { const d = new Date(t.date); return d >= cycleStart! && d <= cycleEnd! })
    : transactions.filter(t => t.date?.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`))

  const cycleIncome = cycleTransactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0)
  const cycleExpense = cycleTransactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0)
  const cycleBalance = cycleIncome - cycleExpense
  const dailyBudget = daysLeft > 0 ? cycleBalance / daysLeft : 0

  const totalLiabilities = liabilities.reduce((s, l) => s + Number(l.balance), 0)
  const { score: financialScore, details: scoreDetails } = calcFinancialScore(cycleIncome, cycleExpense, cycleBalance, assets, transactions, totalLiabilities)
  const scoreColor = getScoreColor(financialScore)

  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear
  const prevTx = transactions.filter(t => t.date?.startsWith(`${prevYear}-${String(prevMonth + 1).padStart(2, "0")}`))
  const prevIncome = prevTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0)
  const prevExpense = prevTx.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0)

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
    const label = d.toLocaleDateString(undefined, { month: "short" })
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

  if (loading) return <div className="p-8 text-gray-400">กำลังโหลด...</div>

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">ภาพรวม</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[
          { label: "รายรับรอบนี้", value: cycleIncome, color: "text-[#1D9E75]", pct: pctChange(cycleIncome, prevIncome) },
          { label: "รายจ่ายรอบนี้", value: cycleExpense, color: "text-[#D85A30]", pct: pctChange(cycleExpense, prevExpense) },
          { label: "คงเหลือสุทธิ", value: cycleBalance, color: cycleBalance >= 0 ? "text-[#1D9E75]" : "text-[#D85A30]", pct: null },
          { label: "ใช้ได้/วัน", value: dailyBudget, color: "text-[#378ADD]", pct: null, suffix: "/วัน" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-lg md:text-xl font-bold ${card.color}`}>
              ฿{Number(card.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              {card.suffix && <span className="text-xs font-normal">{card.suffix}</span>}
            </p>
            {card.pct !== null && (
              <p className={`text-xs mt-1 ${Number(card.pct) >= 0 ? "text-[#1D9E75]" : "text-[#D85A30]"}`}>
                {Number(card.pct) >= 0 ? "▲" : "▼"} {Math.abs(Number(card.pct))}% จากรอบก่อน
              </p>
            )}
          </div>
        ))}
      </div>

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
            <p className="text-sm text-gray-400 text-center py-8">ยังไม่มีรายจ่าย</p>
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
          {activeCycle ? (
            <>
              <div className="text-center py-4">
                <p className="text-5xl font-bold text-[#378ADD]">{daysLeft}</p>
                <p className="text-sm text-gray-500 mt-1">วันที่เหลือ</p>
                <p className="text-xs text-gray-400 mt-1">รอบ {activeCycle.name} (วันที่ {activeCycle.start_day}–{activeCycle.end_day})</p>
              </div>
              <div className="mt-4 bg-gray-50 rounded-xl p-3 text-sm">
                <div className="flex justify-between text-gray-600 mb-1">
                  <span>คงเหลือ</span>
                  <span className="font-semibold text-[#1D9E75]">฿{cycleBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>ใช้ได้/วัน</span>
                  <span className="font-semibold text-[#378ADD]">฿{dailyBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">ยังไม่มีรอบเงินเดือน</p>
              <Link href="/settings" className="text-xs text-[#378ADD] hover:underline mt-1 block">ตั้งค่ารอบเงินเดือน →</Link>
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
          <p className="text-center py-6 text-gray-400 text-sm">ยังไม่มีรายการ</p>
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

    </div>
  )
}