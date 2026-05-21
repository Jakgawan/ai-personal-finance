"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const menuItems = [
  { href: "/", label: "ภาพรวม", icon: "🏠" },
  { href: "/transaction", label: "รายการ", icon: "📋" },
  { href: "/planning", label: "วางแผน", icon: "📅" },
  { href: "/balance-sheet", label: "งบการเงิน", icon: "⚖️" },
  { href: "/ai", label: "ปรึกษาการเงิน", icon: "💬" },
  { href: "/courses", label: "คอร์สการเงิน", icon: "🎓" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
]

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  // ซ่อน sidebar ในหน้า login/register
  const hideSidebar = pathname === "/login" || pathname === "/register"
  if (hideSidebar) return <>{children}</>

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar — desktop only */}
      <aside
        className={`hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${
          collapsed ? "w-11" : "w-40"
        }`}
      >
        {/* Hamburger */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-3 text-gray-500 hover:text-gray-800 hover:bg-gray-100 text-left"
        >
          ☰
        </button>

        {/* Menu */}
        <nav className="flex-1 flex flex-col gap-1 px-1 mt-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-[#1D9E75] text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span className="text-base shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        {children}
      </main>

      {/* Bottom Navigation — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-gray-200 flex justify-around items-center h-14 z-50">
        <Link href="/" className={`flex flex-col items-center text-xs gap-0.5 ${pathname === "/" ? "text-[#1D9E75]" : "text-gray-500"}`}>
          <span>🏠</span><span>หน้าหลัก</span>
        </Link>
        <Link href="/transaction" className={`flex flex-col items-center text-xs gap-0.5 ${pathname === "/transaction" ? "text-[#1D9E75]" : "text-gray-500"}`}>
          <span>📋</span><span>รายการ</span>
        </Link>
        <Link href="/transaction?new=true" className="flex flex-col items-center text-xs gap-0.5">
          <span className="bg-[#1D9E75] text-white rounded-full w-10 h-10 flex items-center justify-center text-xl">+</span>
        </Link>
        <Link href="/planning" className={`flex flex-col items-center text-xs gap-0.5 ${pathname === "/planning" ? "text-[#1D9E75]" : "text-gray-500"}`}>
          <span>📅</span><span>วางแผน</span>
        </Link>
        <Link href="/settings" className={`flex flex-col items-center text-xs gap-0.5 ${pathname === "/settings" ? "text-[#1D9E75]" : "text-gray-500"}`}>
          <span>⚙️</span><span>เพิ่มเติม</span>
        </Link>
      </nav>
    </div>
  )
}