"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import ProfileSection from "./components/ProfileSection"
import PayCyclesSection from "./components/PayCyclesSection"
import CategoriesSection from "./components/CategoriesSection"
import RecurringSection from "./components/RecurringSection"
import DisplaySection from "./components/DisplaySection"
import { ChevronLeft, User, CalendarDays, Tag, RefreshCw, Target, Bell, Globe } from "lucide-react"

const menuItems = [
  { id: "profile", label: "โปรไฟล์", icon: User },
  { id: "paycycles", label: "รอบเงินเดือน", icon: CalendarDays },
  { id: "categories", label: "หมวดหมู่", icon: Tag },
  { id: "recurring", label: "รายการซ้ำ", icon: RefreshCw },
  { id: "goals", label: "เป้าหมาย", icon: Target },
  { id: "notifications", label: "แจ้งเตือน", icon: Bell },
  { id: "display", label: "การแสดงผล", icon: Globe },
]

const SECTION_LABELS: Record<string, string> = Object.fromEntries(
  menuItems.map((m) => [m.id, m.label])
)

const validTabs = menuItems.map((m) => m.id)

function SettingsContent() {
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab")
  const active = tab && validTabs.includes(tab) ? tab : "profile"

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile: full-page ทีละหัวข้อ พร้อมปุ่ม back กลับ dashboard */}
      <div className="md:hidden flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
        <Link
          href="/"
          className="p-1.5 -ml-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-base font-semibold text-gray-800">{SECTION_LABELS[active]}</h1>
      </div>

      {/* Desktop: tab bar แนวนอน สลับหัวข้อในหน้าเดียว ไม่มี back button */}
      <div className="hidden md:block bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex min-w-max px-4">
            {menuItems.map((item) => (
              <Link
                key={item.id}
                href={`/settings?tab=${item.id}`}
                className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
                  active === item.id
                    ? "border-[#1D9E75] text-[#1D9E75] font-semibold"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <item.icon size={15} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <main className="p-4 md:p-8">
        {active === "profile" && <ProfileSection />}
        {active === "paycycles" && <PayCyclesSection />}
        {active === "categories" && <CategoriesSection />}
        {active === "recurring" && <RecurringSection />}
        {active === "display" && <DisplaySection />}
        {["goals", "notifications"].includes(active) && (
          <div className="text-gray-400 text-sm">Coming soon...</div>
        )}
      </main>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  )
}
