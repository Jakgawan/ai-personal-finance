"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
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

const COLORS = ["#1D9E75", "#D85A30", "#378ADD", "#F59E0B", "#8B5CF6", "#EC4899", "#6B7280"]

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cycles, setCycles] = useState<PayCycle[]>([])
  const [chartMode, setChartMode] = useState<"bar" | "donut" | "column" | "table">("bar")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: txData }, { data: cycleData }] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }),
        supabase.from("pay_cycles").select("*").eq("user_id", user.id),
      ])

      setTransactions(txData || [])
      setCycles(cycleData || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  // --- คำนวณรอบเงินเดือนปัจจุบัน ---
  const today = new Date()
  const currentDay = today.getDate()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()

  const activeCycle = cycles.find(c => {
  if (c.start_day > c.end_day) {
    return currentDay >= c.start_day || currentDay <= c.end_day
  }
  return currentDay >= c.start_day && currentDay <= c.end_day
}) || cycles[0] || null
  let daysLeft = 0
  let cycleStart: Date | null = null
  let cycleEnd: Date | null = null

  if (activeCycle) {
    const s = activeCycle.start_day
    const e = activeCycle.end_day

    if (s > e) {
      // รอบข้ามเดือน เช่น วันที่ 21 ถึง 5
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

  // --- รายการในรอบปัจจุบัน ---
  const cycleTransactions = cycleStart && cycleEnd
    ? transactions.filter(t => {
        const d = new Date(t.date)
        return d >= cycleStart! && d <= cycleEnd!
      })
    : transactions.filter(t => t.date?.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`))

  const cycleIncome = cycleTransactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0)
  const cycleExpense = cycleTransactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0)
  const cycleBalance = cycleIncome - cycleExpense
  const dailyBudget = daysLeft > 0 ? cycleBalance / daysLeft : 0

  // --- รอบก่อนหน้า (เพื่อเปรียบเทียบ %) ---
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear
  const prevTx = transactions.filter(t => t.date?.startsWith(`${prevYear}-${String(prevMonth + 1).padStart(2, "0")}`))
  const prevIncome = prevTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0)
  const prevExpense = prevTx.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0)

  const pctChange = (current: number, prev: number) => {
    if (prev === 0) return null
    return ((current - prev) / prev * 100).toFixed(1)
  }

  // --- กราฟรายจ่ายแบ่งหมวด ---
  const expenseByCategory = Object.entries(
    cycleTransactions
      .filter(t => t.type === "expense")
      .reduce((acc, t) => {
        const key = t.category || "อื่นๆ"
        acc[key] = (acc[key] || 0) + Number(t.amount)
        return acc
      }, {} as Record<string, number>)
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const totalExpenseForPct = expenseByCategory.reduce((s, c) => s + c.value, 0)

  // --- กราฟย้อนหลัง 6 เดือน ---
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - 5 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString(undefined, { month: "short" })
    const monthTx = transactions.filter(t => t.date?.startsWith(key))
    return {
      label,
      key,
      income: monthTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
      expense: monthTx.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
      isCurrent: i === 5,
    }
  })

  // --- 5 รายการล่าสุด ---
  const latest5 = transactions.slice(0, 5)
  let runningBalance = transactions.reduce((s, t) => t.type === "income" ? s + Number(t.amount) : s - Number(t.amount), 0)
  const latest5WithBalance = latest5.map((t) => {
    const bal = runningBalance
    runningBalance -= t.type === "income" ? Number(t.amount) : -Number(t.amount)
    return { ...t, balance: bal }
  })

  if (loading) return <div className="p-8 text-gray-400">กำลังโหลด...</div>

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">ภาพรวม</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "รายรับรอบนี้", value: cycleIncome, color: "text-[#1D9E75]",
            pct: pctChange(cycleIncome, prevIncome)
          },
          {
            label: "รายจ่ายรอบนี้", value: cycleExpense, color: "text-[#D85A30]",
            pct: pctChange(cycleExpense, prevExpense)
          },
          {
            label: "คงเหลือสุทธิ", value: cycleBalance,
            color: cycleBalance >= 0 ? "text-[#1D9E75]" : "text-[#D85A30]",
            pct: null
          },
          {
            label: "ใช้ได้/วัน", value: dailyBudget,
            color: "text-[#378ADD]", pct: null, suffix: "/วัน"
          },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-xl font-bold ${card.color}`}>
              ฿{Number(card.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              {card.suffix && <span className="text-sm font-normal">{card.suffix}</span>}
            </p>
            {card.pct !== null && (
              <p className={`text-xs mt-1 ${Number(card.pct) >= 0 ? "text-[#1D9E75]" : "text-[#D85A30]"}`}>
                {Number(card.pct) >= 0 ? "▲" : "▼"} {Math.abs(Number(card.pct))}% จากรอบก่อน
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* กราฟรายจ่ายแบ่งหมวด */}
        <div className="md:col-span-2 bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">รายจ่ายแบ่งหมวด</h2>
            <div className="flex gap-1">
              {(["bar", "donut", "column", "table"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setChartMode(mode)}
                  className={`px-2 py-1 text-xs rounded-lg transition-colors ${chartMode === mode ? "bg-[#1D9E75] text-white" : "text-gray-500 hover:bg-gray-100"}`}
                >
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
                        <span>{c.name}</span>
                        <span>฿{c.value.toLocaleString()}</span>
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
                    <Tooltip formatter={(v: number) => `฿${v.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              )}

              {chartMode === "column" && (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={expenseByCategory}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `฿${v.toLocaleString()}`} />
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
        <div className="bg-white rounded-xl p-5 shadow-sm flex flex-col justify-between">
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
      <div className="bg-white rounded-xl p-5 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">รายรับ vs รายจ่าย ย้อนหลัง 6 เดือน</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={last6Months} barGap={4}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `฿${v.toLocaleString()}`} />
            <Bar dataKey="income" name="รายรับ" fill="#1D9E75" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="รายจ่าย" fill="#D85A30" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ตารางรายการล่าสุด */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">รายการล่าสุด</h2>
          <Link href="/transaction" className="text-xs text-[#378ADD] hover:underline">ดูทั้งหมด →</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["วันที่", "รายการ", "ประเภท", "จำนวน", "คงเหลือ"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {latest5WithBalance.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-6 text-gray-400">ยังไม่มีรายการ</td></tr>
            ) : (
              latest5WithBalance.map((t) => (
                <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{t.date}</td>
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}