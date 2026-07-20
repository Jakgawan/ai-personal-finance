"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { LayoutDashboard, ListOrdered, CalendarDays, Scale, Briefcase, MessageCircle, GraduationCap, Settings, LogOut, Menu, Wallet } from "lucide-react"

const menuItems = [
  { href: "/", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/transaction", label: "รายการ", icon: ListOrdered },
  { href: "/planning", label: "วางแผน", icon: CalendarDays },
  { href: "/balance-sheet", label: "งบการเงิน", icon: Scale },
  { href: "/business", label: "ธุรกิจ", icon: Briefcase },
  { href: "/ai", label: "ปรึกษาการเงิน", icon: MessageCircle },
  { href: "/courses", label: "คอร์สการเงิน", icon: GraduationCap },
  { href: "/settings", label: "Settings", icon: Settings },
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
  const [category, setCategory] = useState("")
  const [cycleId, setCycleId] = useState("")
  const [loading, setLoading] = useState(false)

  // เก็บรายการหมวดหมู่ + รอบเงินเดือน สำหรับ dropdown ในฟอร์ม Quick Add
  const [categories, setCategories] = useState<{ id: string; name: string; type: string; icon: string }[]>([])
  const [cycles, setCycles] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])
  // ดึงหมวดหมู่ + รอบเงินเดือน มาเก็บไว้ใช้ใน dropdown
  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: catData }, { data: cycleData }] = await Promise.all([
        supabase.from("categories").select("*").eq("user_id", user.id),
        supabase.from("pay_cycles").select("*").eq("user_id", user.id),
      ])
      setCategories(catData || [])
      setCycles(cycleData || [])
    }
    fetchData()
  }, [])

  useEffect(() => {
  const checkAuth = async () => {
    let user = null
    for (let i = 0; i < 5; i++) {
      const { data } = await supabase.auth.getUser()
      user = data.user
      if (user) break
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    if (!user && pathname !== "/login" && pathname !== "/register" && pathname !== "/forgot-password" && pathname !== "/reset-password") {
      window.location.href = "/login"
    }
  }
  checkAuth()
}, [pathname])

  const hideSidebar = pathname === "/login" || pathname === "/register" || pathname === "/forgot-password" || pathname === "/reset-password"
  if (hideSidebar) return <>{children}</>
  // หน้าที่จะแสดง FAB — มีแค่ Dashboard, รายการ, ธุรกิจ
  const fabPages = ["/", "/transaction", "/business"]
  const showFAB = fabPages.includes(pathname)

const handleQuickAdd = async () => {
  if (!amount) return
  if (!category) {
    alert("กรุณาเลือกหมวดหมู่")
    return
  }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    await supabase.from("transactions").insert({
      user_id: user.id,
      name,
      amount: Number(amount),
      date,
      type,
      category: category || null,
      cycle_id: cycleId || null,
    })
    // ยิง event บอกหน้า transaction ว่า "เพิ่มรายการแล้ว" → ให้มันโหลดใหม่ทันที
    window.dispatchEvent(new CustomEvent("transactionAdded"))
    setName("")
    setAmount("")
    setDate(new Date().toISOString().split("T")[0])
    setType("expense")
    setCategory("")
    setCycleId("")
    setLoading(false)
    setShowQuickAdd(false)
  }

  const handleFAB = () => {
    if (pathname === "/business") {
      window.dispatchEvent(new CustomEvent("openBusinessTxModal"))
    } else {
      setShowQuickAdd(true)
    }
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo + hamburger */}
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        {!collapsed && <span className="flex items-center gap-1.5 text-sm font-bold text-[#1D9E75]">
  <Wallet size={18} /> Finance
</span>}
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
          <Menu size={18} />
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1 flex flex-col gap-1 px-1 mt-2 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm transition-colors ${isActive ? "bg-[#1D9E75] text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              <item.icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-2 mb-2 border-t border-gray-100">
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            window.location.href = "/login"
          }}
          className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 w-full transition-colors"
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span className="truncate">ออกจากระบบ</span>}
        </button>
      </div>
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
            <Menu size={18} />
          </button>
          <span className="text-sm font-bold text-[#1D9E75]">💰 Finance</span>
          <div className="w-8" />
        </div>

        <main className="flex-1 overflow-auto pb-6">
          {children}
        </main>
      </div>

{/* FAB ปุ่ม + (แสดงเฉพาะบางหน้า) */}
      {showFAB && (
        <button
          onClick={handleFAB}
          className="fixed bottom-6 right-6 w-14 h-14 bg-[#1D9E75] text-white rounded-full shadow-lg text-2xl hover:bg-[#178a64] transition-colors z-30 flex items-center justify-center"
        >
          +
        </button>
      )}

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
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800"
              />
              <input
                placeholder="ชื่อรายการ เช่น ข้าวเที่ยง"
                value={name}
                onChange={e => setName(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800"
              />
              <input
                placeholder="จำนวน (฿)"
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800"
              />
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800"
              >
                <option value="">-- หมวดหมู่ --</option>
                {categories.filter(c => !c.type || c.type === type).map(c => (
                  <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                ))}
              </select>
              <select
                value={cycleId}
                onChange={e => setCycleId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800"
              >
                <option value="">-- รอบเงินเดือน --</option>
                {cycles.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={handleQuickAdd}
                disabled={loading || !amount}
                className="w-full bg-[#1D9E75] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#178a64] disabled:opacity-50 transition-colors"
              >
                {loading ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}