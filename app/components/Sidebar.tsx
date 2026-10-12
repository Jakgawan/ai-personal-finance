"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { LayoutDashboard, ListOrdered, CalendarDays, Scale, Briefcase, MessageCircle, GraduationCap, Settings, LogOut, Menu, Wallet, ChevronLeft } from "lucide-react"
import QuickAddModal from "./QuickAddModal"
import BottomNav from "./BottomNav"
import MoreMenu from "./MoreMenu"
import FloatingMenuButton from "./FloatingMenuButton"

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

// หน้าที่เข้าถึงผ่าน MoreMenu เท่านั้น (ไม่ได้อยู่ใน bottom nav) — โชว์ปุ่ม back แทนโลโก้บนมือถือ
const MOBILE_PAGE_TITLES: Record<string, string> = {
  "/planning": "วางแผน",
  "/balance-sheet": "งบการเงิน",
  "/business": "ธุรกิจ",
  "/ai": "ปรึกษาการเงิน",
  "/courses": "คอร์สการเงิน",
}

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const pathname = usePathname()

  const [categories, setCategories] = useState<{ id: string; name: string; type: string; icon: string }[]>([])
  const [cycles, setCycles] = useState<{ id: string; name: string }[]>([])
  const [profileMode, setProfileMode] = useState<"simple" | "full">("full")
  const [showFloatingMenu, setShowFloatingMenu] = useState(true)

  const hideSidebar = pathname === "/login" || pathname === "/register" || pathname === "/forgot-password" || pathname === "/reset-password"

  useEffect(() => {
    setShowMoreMenu(false)
  }, [pathname])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ show: boolean }>).detail
      setShowFloatingMenu(detail.show)
    }
    window.addEventListener("floatingMenuToggled", handler)
    return () => window.removeEventListener("floatingMenuToggled", handler)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: catData }, { data: cycleData }, { data: profileData }] = await Promise.all([
        supabase.from("categories").select("*").eq("user_id", user.id),
        supabase.from("pay_cycles").select("*").eq("user_id", user.id),
        supabase.from("financial_profile").select("mode, show_floating_menu").eq("user_id", user.id).maybeSingle(),
      ])
      setCategories(catData || [])
      setCycles(cycleData || [])
      setProfileMode(profileData?.mode === "simple" ? "simple" : "full")
      setShowFloatingMenu(profileData?.show_floating_menu !== false)
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (hideSidebar) return

    let active = true

    // getSession() อ่านจาก localStorage ที่ supabase-js sync ไว้ในเครื่องอยู่แล้ว
    // เร็วกว่า getUser() มาก (getUser() ต้องยิง request ไปเช็คกับ server ทุกครั้ง)
    // จึงไม่มีปัญหา session ยังโหลดไม่ทันหลัง redirect แบบที่เจอก่อนหน้านี้
   const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (!session) {
        window.location.href = "/login"
      }
    }
    checkAuth()

    // ฟัง event การเปลี่ยนสถานะ auth แบบ real-time (login, logout, token refresh)
    // เพื่อกันเคสที่ session หมดอายุ/ถูกล็อกเอาต์ระหว่างที่ผู้ใช้อยู่ในหน้าอื่นอยู่แล้ว
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        window.location.href = "/login"
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [pathname, hideSidebar])

  if (hideSidebar) return <>{children}</>

  const fabPages = ["/", "/transaction", "/business"]
  const showFAB = fabPages.includes(pathname)

  const handleFAB = () => {
    if (pathname === "/business") {
      window.dispatchEvent(new CustomEvent("openBusinessTxModal"))
    } else {
      setShowQuickAdd(true)
    }
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        {!collapsed && <span className="flex items-center gap-1.5 text-sm font-bold text-[#1D9E75]">
          <Wallet size={18} /> Finance
        </span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
        >
          <Menu size={18} />
        </button>
      </div>

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
    <>
      <div className="flex h-screen bg-gray-50">

        <aside className={`hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${collapsed ? "w-11" : "w-40"}`}>
          <SidebarContent />
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          {!pathname.startsWith("/settings") && (
            <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
              {MOBILE_PAGE_TITLES[pathname] ? (
                <span className="flex items-center gap-2">
                  <Link href="/" className="p-1.5 -ml-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
                    <ChevronLeft size={20} />
                  </Link>
                  <h1 className="text-sm font-bold text-gray-800">{MOBILE_PAGE_TITLES[pathname]}</h1>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-bold text-[#1D9E75]">
                  <Wallet size={18} /> Finance
                </span>
              )}
              {!showFloatingMenu && (
                <button
                  onClick={() => setShowMoreMenu(true)}
                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                  <Menu size={18} />
                </button>
              )}
            </div>
          )}

          <main className="flex-1 overflow-auto pb-20 md:pb-6">
            {children}
          </main>
        </div>

        {showFAB && (
          <button
            onClick={handleFAB}
            className="hidden md:flex fixed bottom-6 right-6 w-14 h-14 bg-[#1D9E75] text-white rounded-full shadow-lg text-2xl hover:bg-[#178a64] transition-colors z-30 items-center justify-center"
          >
            +
          </button>
        )}

        <BottomNav onFabClick={handleFAB} />

        {showFloatingMenu && (
          <FloatingMenuButton onOpen={() => setShowMoreMenu(true)} />
        )}

        <MoreMenu
          open={showMoreMenu}
          onClose={() => setShowMoreMenu(false)}
          mode={profileMode}
        />

        <QuickAddModal
          open={showQuickAdd}
          onClose={() => setShowQuickAdd(false)}
          mode={profileMode}
          categories={categories}
          cycles={cycles}
        />

      </div>
    </>
  )
}