"use client"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"
export default function Dashboard(){
  const [income, setIncome] = useState(0)
  const [expense, setExpense] = useState(0)
  const [total, setTotal] = useState(0)
useEffect(() => {
  const fetchData = async () => {
    const { data } = await supabase
      .from("transactions")
      .select("*")
    
    if (data) {
      // วนลูปคำนวณ income และ expense
      let totalIncome = 0
      let totalExpense = 0
      
      data.forEach((item) => {
        if (item.type === "income") {
          totalIncome += Number(item.amount)
        } else {
          totalExpense += Number(item.amount)
        }
      })
      
      setIncome(totalIncome)
      setExpense(totalExpense)
      setTotal(totalIncome - totalExpense)
    }
  }
  fetchData()
}, [])
  return (

 <main className="p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
     <div className="bg-white rounded-lg p-6 shadow">
      <p className="text-sm text-gray-500">Total</p>
      <p className="text-3xl font-bold">฿ {total}</p>
     </div>
     <div className="grid grid-cols-2 gap-4 mt-4">
      <div className="bg-white rounded-lg p-6 shadow">
        <p className="text-sm text-gray-500">Income</p>
        <p className="text-3xl font-bold">฿ {income}</p>
      </div>
      <div className="bg-white rounded-lg p-6 shadow">
        <p className="text-sm text-gray-500">Expense</p>
        <p className="text-3xl font-bold">฿ {expense}</p>
      </div>
     </div>
  </main>
  
  )
}