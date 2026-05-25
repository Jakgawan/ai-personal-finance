"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"

const menuItems = [
  { href: "/", label: "ภาพรวม", icon: "🏠" },
  { href: "/transaction", label: "รายการ", icon: "📋" },
  { href: "/planning", label: "วางแผน", icon: "📅" },
  { href: "/balance-sheet", label: "งบการเงิน", icon: "⚖️" },
  { href: "/business", label: "ธุรกิจ", icon: "🏢" },
  { href: "/ai", label: "ปรึกษาการเงิน", icon: "💬" },
  { href: "/courses", label: "คอร์สการเงิน", icon: "🎓" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
  { href: "/recurring", label: "รายการซ้ำ", icon: "🔄" },
]

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const pathname = usePathname()

  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [type, setType] = useState("expense")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const hideSidebar = pathname === "/login" || pathname === "/register"
  if (hideSidebar) return <>{children}</>

  const handleQuickAdd = async () => {
    if (!name || !amount) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from("transactions").insert({
      user_id: user.id,
      name,
      amount: Number(amount),
      date,
      type,
    })

    setName("")
    setAmount("")
    setDate(new Date().toISOString().split("T")[0])
    setType("expense")
    setLoading(false)
    setShowQuickAdd(false)
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo + hamburger */}
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        {!collapsed && <span className="text-sm font-bold text-[#1D9E75]">💰 Finance</span>}
        <button
          onClick={() => {
            if (window.innerWidth < 768) {
              setMobileOpen(false)
            } else {
              setCollapsed(!collapsed)
            }
          }}
          className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
        >
          ☰
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1 flex flex-col gap-1 px-1 mt-2 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm transition-colors ${isActive ? "bg-[#1D9E75] text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              <span className="text-base shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50">

      {/* Sidebar — desktop */}
      <aside className={`hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${collapsed ? "w-11" : "w-40"}`}>
        <SidebarContent />
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white z-50 shadow-xl transition-transform duration-300 md:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            ☰
          </button>
          <span className="text-sm font-bold text-[#1D9E75]">💰 Finance</span>
          <div className="w-8" />
        </div>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* FAB ปุ่ม + ลอย */}
      <button
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#1D9E75] text-white rounded-full shadow-lg text-2xl hover:bg-[#178a64] transition-colors z-30 flex items-center justify-center"
      >
        +
      </button>

      {/* Quick Add Modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="text-lg font-semibold text-gray-800">บันทึกรายการ</h2>
              <button onClick={() => setShowQuickAdd(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="px-6 pb-6 flex flex-col gap-3">
              <div className="flex gap-3">
                <button onClick={() => setType("expense")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${type === "expense" ? "bg-[#D85A30] text-white border-[#D85A30]" : "border-gray-200 text-gray-600"}`}>
                  รายจ่าย
                </button>
                <button onClick={() => setType("income")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${type === "income" ? "bg-[#1D9E75] text-white border-[#1D9E75]" : "border-gray-200 text-gray-600"}`}>
                  รายรับ
                </button>
              </div>

              <input
                placeholder="ชื่อรายการ เช่น ข้าวเที่ยง"
                value={name}
                onChange={e => setName(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
              />
              <input
                placeholder="จำนวน (฿)"
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
              />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
              />

              <button
                onClick={handleQuickAdd}
                disabled={loading || !name || !amount}
                className="w-full bg-[#1D9E75] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#178a64] disabled:opacity-50 transition-colors"
              >
                {loading ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
      <button
         onClick={() => {
        if (pathname === "/business") {
          // dispatch event ให้หน้า business รับรู้
           window.dispatchEvent(new CustomEvent("openBusinessTxModal"))
          } else {
           setShowQuickAdd(true)
          }
  }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-[#1D9E75] text-white rounded-full shadow-lg text-2xl hover:bg-[#178a64] transition-colors z-30 flex items-center justify-center"
>
  +
      </button>
    </div>
  )
}