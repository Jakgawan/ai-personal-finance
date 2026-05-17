"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
export default function Planning() {
  const [month, setMonth] = useState("")
  const [income, setIncome] = useState("")
  const [fixedExpense, setFixedExpense] = useState("")
  const [debt, setDebt] = useState("")
  const [note, setNote] = useState("")
  const [savingGoal, setSavingGoal] = useState("")
  const [incomeExtra, setIncomeExtra] = useState("")
  const [planning, setPlanning] = useState<any[]>([])
  const [editId, setEditId] = useState<number | null>(null)
  const fetchPlanning = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
        .from("planning")
        .select("*")
        .eq("user_id", user?.id)
    
    if (data) {
        setPlanning(data as any[])
    }
}
  useEffect(() => {
    fetchPlanning()
}, [])
      const handleSubmit = async () => {
        
    const { data: { user } } = await supabase.auth.getUser()
    
if (editId) {
    await supabase
        .from("planning")
        .update({ month, income, income_extra: incomeExtra, fixed_expense: fixedExpense, debt, note, saving_goal: savingGoal })
        .eq("id", editId)
    setEditId(null)
} else {
    await supabase
        .from("planning")
        .insert({ month, income, income_extra: incomeExtra, fixed_expense: fixedExpense, debt, note, saving_goal: savingGoal, user_id: user?.id })
}

    setMonth("")
    setIncome("")
    setIncomeExtra("")
    setFixedExpense("")
    setDebt("")
    setNote("")
    setSavingGoal("")
    fetchPlanning()
}
   return (
    <main className="p-8">
        <h1 className="text-2xl font-bold">Planning</h1>
        
        <div className="mt-6">
            <label className="text-sm text-gray-500">เดือน</label>
            <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full border rounded-lg p-2 mt-1"
            />
        </div>

        <div className="mt-4">
            <label className="text-sm text-gray-500">รายรับหลัก (฿)</label>
            <input
                type="number"
                placeholder="0"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                className="w-full border rounded-lg p-2 mt-1"
            />
        </div>

        <div className="mt-4">
            <label className="text-sm text-gray-500">รายรับเสริม (฿)</label>
            <input
                type="number"
                placeholder="0"
                value={incomeExtra}
                onChange={(e) => setIncomeExtra(e.target.value)}
                className="w-full border rounded-lg p-2 mt-1"
            />
        </div>

        <div className="mt-4">
            <label className="text-sm text-gray-500">รายจ่ายคงที่ (฿)</label>
            <input
                type="number"
                placeholder="0"
                value={fixedExpense}
                onChange={(e) => setFixedExpense(e.target.value)}
                className="w-full border rounded-lg p-2 mt-1"
            />
        </div>

        <div className="mt-4">
            <label className="text-sm text-gray-500">หนี้สิน (฿)</label>
            <input
                type="number"
                placeholder="0"
                value={debt}
                onChange={(e) => setDebt(e.target.value)}
                className="w-full border rounded-lg p-2 mt-1"
            />
        </div>

        <div className="mt-4">
            <label className="text-sm text-gray-500">เป้าหมายออม (฿)</label>
            <input
                type="number"
                placeholder="0"
                value={savingGoal}
                onChange={(e) => setSavingGoal(e.target.value)}
                className="w-full border rounded-lg p-2 mt-1"
            />
        </div>

        <div className="mt-4">
            <label className="text-sm text-gray-500">หมายเหตุ</label>
            <input
                type="text"
                placeholder="หมายเหตุ"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full border rounded-lg p-2 mt-1"
            />
        </div>

        <button
            onClick={handleSubmit}
            className="mt-6 w-full bg-blue-500 text-white rounded-lg p-2 hover:bg-blue-600"
        >
            Save
        </button>

        <div className="mt-8">
            {planning.map((item, index) => (
                <div key={index} className="bg-white rounded-lg p-4 shadow mt-2">
                    <p className="font-bold">{item.month}</p>
                    <p>รายรับหลัก: ฿{item.income}</p>
                    <p>รายรับเสริม: ฿{item.income_extra}</p>
                    <p>รายจ่ายคงที่: ฿{item.fixed_expense}</p>
                    <p>หนี้สิน: ฿{item.debt}</p>
                    <p>เป้าหมายออม: ฿{item.saving_goal}</p>
                    <p className="text-sm text-gray-500">{item.note}</p>
                    <div className="flex gap-2 mt-2">
                        <button
                            onClick={() => {
                                setEditId(item.id)
                                setMonth(item.month)
                                setIncome(item.income)
                                setIncomeExtra(item.income_extra)
                                setFixedExpense(item.fixed_expense)
                                setDebt(item.debt)
                                setSavingGoal(item.saving_goal)
                                setNote(item.note)
                            }}
                            className="text-blue-500 hover:text-blue-700"
                        >
                            แก้ไข
                        </button>
                        <button
                            onClick={async () => {
                                await supabase.from("planning").delete().eq("id", item.id)
                                fetchPlanning()
                            }}
                            className="text-red-500 hover:text-red-700"
                        >
                            ลบ
                        </button>
                    </div>
                </div>
            ))}
        </div>
    </main>
)
}