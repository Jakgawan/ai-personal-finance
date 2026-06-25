"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { FileText, Loader2 } from "lucide-react"

type Transaction = {
  name: string
  amount: number
  date: string
  type: string
  category: string
  note?: string
}

export default function ExportPDF() {
  const [loading, setLoading] = useState(false)

  const generatePDF = async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })

    const transactions: Transaction[] = tx || []

    const totalIncome = transactions
      .filter(t => t.type === "income")
      .reduce((s, t) => s + Number(t.amount), 0)
    const totalExpense = transactions
      .filter(t => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0)
    const balance = totalIncome - totalExpense

    // สร้าง HTML string แล้วแปลงเป็น PDF
    // html2pdf รองรับภาษาไทยได้เต็มที่ เพราะใช้ font จาก browser
    const html = `
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: 'Sarabun', sans-serif; padding: 24px; color: #333; font-size: 13px; }
          h1 { color: #1D9E75; font-size: 20px; margin-bottom: 4px; }
          p { color: #888; font-size: 11px; margin-bottom: 20px; }
          h2 { font-size: 14px; margin-bottom: 8px; color: #444; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #1D9E75; color: white; padding: 8px 10px; text-align: left; font-size: 12px; }
          td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; font-size: 12px; }
          tr:nth-child(even) { background: #f9f9f9; }
          .income { color: #1D9E75; font-weight: bold; }
          .expense { color: #D85A30; font-weight: bold; }
          .summary-table th:last-child,
          .summary-table td:last-child { text-align: right; }
          .tx-income { color: #1D9E75; font-weight: 600; }
          .tx-expense { color: #D85A30; font-weight: 600; }
          .footer-row td { background: #f0f0f0; font-weight: bold; border-top: 2px solid #ddd; }
        </style>
      </head>
      <body>
        <h1>รายงานการเงินส่วนตัว</h1>
        <p>สร้างเมื่อ: ${new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}</p>

        <h2>สรุปภาพรวม</h2>
        <table class="summary-table">
          <thead>
            <tr><th>รายการ</th><th>จำนวน (บาท)</th></tr>
          </thead>
          <tbody>
            <tr><td>รายรับทั้งหมด</td><td class="tx-income" style="text-align:right">฿${totalIncome.toLocaleString()}</td></tr>
            <tr><td>รายจ่ายทั้งหมด</td><td class="tx-expense" style="text-align:right">฿${totalExpense.toLocaleString()}</td></tr>
            <tr><td><b>ยอดคงเหลือ</b></td><td style="text-align:right; font-weight:bold; color:${balance >= 0 ? "#1D9E75" : "#D85A30"}">฿${balance.toLocaleString()}</td></tr>
          </tbody>
        </table>

        <h2>รายการทั้งหมด</h2>
        <table>
          <thead>
            <tr>
              <th>วันที่</th>
              <th>รายการ</th>
              <th>หมวด</th>
              <th>หมายเหตุ</th>
              <th style="text-align:right">รายรับ (บาท)</th>
              <th style="text-align:right">รายจ่าย (บาท)</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(t => `
              <tr>
                <td>${t.date}</td>
                <td>${t.name}</td>
                <td>${t.category || "-"}</td>
                <td>${t.note || "-"}</td>
                <td class="tx-income" style="text-align:right">${t.type === "income" ? "฿" + Number(t.amount).toLocaleString() : ""}</td>
                <td class="tx-expense" style="text-align:right">${t.type === "expense" ? "฿" + Number(t.amount).toLocaleString() : ""}</td>
              </tr>
            `).join("")}
          </tbody>
          <tfoot>
            <tr class="footer-row">
              <td colspan="4">รวมทั้งหมด</td>
              <td class="tx-income" style="text-align:right">฿${totalIncome.toLocaleString()}</td>
              <td class="tx-expense" style="text-align:right">฿${totalExpense.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>
    `

    // สร้าง element ชั่วคราวใน DOM แล้วแปลงเป็น PDF
    const element = document.createElement("div")
    element.innerHTML = html

    // html2pdf ไม่มี type definition จึงต้องใช้ require แบบ dynamic
    const html2pdf = (await import("html2pdf.js" as any)).default

    await html2pdf()
      .set({
        margin: 10,
        filename: `finance-report-${new Date().toISOString().split("T")[0]}.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        // scale: 2 = ความละเอียด 2x ทำให้ข้อความคมชัดขึ้น
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        // landscape = แนวนอน เพราะตารางมีหลายคอลัมน์
      })
      .from(element)
      .save()

    setLoading(false)
  }

  return (
    <button
      onClick={generatePDF}
      disabled={loading}
      className="flex items-center gap-2 border border-gray-300 text-gray-600 rounded-lg px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 transition-colors"
    >
      {loading ? (
  <span className="flex items-center gap-1.5">
    <Loader2 size={14} className="animate-spin" />
    PDF...
  </span>
) : (
  <span className="flex items-center gap-1.5">
    <FileText size={14} />
    PDF
  </span>
)}
    </button>
  )
}