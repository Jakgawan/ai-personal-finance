"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Transaction = {
  name: string
  amount: number
  date: string
  type: string
  category: string
}

export default function ExportPDF() {
  const [loading, setLoading] = useState(false)

  const generatePDF = async () => {
    setLoading(true)

    const { jsPDF } = await import("jspdf")
    const autoTable = (await import("jspdf-autotable")).default

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })

    const transactions: Transaction[] = tx || []

    const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0)
    const totalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0)
    const balance = totalIncome - totalExpense

    const doc = new jsPDF()

    // Header
    doc.setFontSize(18)
    doc.setTextColor(29, 158, 117)
    doc.text("Personal Finance Report", 14, 20)

    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28)

    // Summary
    doc.setFontSize(13)
    doc.setTextColor(50)
    doc.text("Summary", 14, 40)

    autoTable(doc, {
      startY: 44,
      head: [["", "Amount"]],
      body: [
        ["Total Income", `฿${totalIncome.toLocaleString()}`],
        ["Total Expense", `฿${totalExpense.toLocaleString()}`],
        ["Balance", `฿${balance.toLocaleString()}`],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [29, 158, 117] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 60, halign: "right" },
      },
    })

    // Transactions
    const finalY = (doc as any).lastAutoTable.finalY + 10

    doc.setFontSize(13)
    doc.setTextColor(50)
    doc.text("Transactions", 14, finalY)

    autoTable(doc, {
      startY: finalY + 4,
      head: [["Date", "Name", "Category", "Type", "Amount"]],
      body: transactions.map(t => [
        t.date,
        t.name,
        t.category || "-",
        t.type === "income" ? "Income" : "Expense",
        `${t.type === "income" ? "+" : "-"}฿${Number(t.amount).toLocaleString()}`,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [55, 138, 221] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        4: { halign: "right" },
      },
    })

    doc.save(`finance-report-${new Date().toISOString().split("T")[0]}.pdf`)
    setLoading(false)
  }

  return (
    <button
      onClick={generatePDF}
      disabled={loading}
      className="flex items-center gap-2 border border-gray-300 text-gray-600 rounded-lg px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 transition-colors"
    >
      {loading ? "⏳ กำลัง Export..." : "📄 Export PDF"}
    </button>
  )
}