"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import ProfileSection from "./components/ProfileSection"
import PayCyclesSection from "./components/PayCyclesSection"
import CategoriesSection from "./components/CategoriesSection"
import RecurringSection from "./components/RecurringSection"
import DisplaySection from "./components/DisplaySection"
import { ChevronLeft } from "lucide-react"

const SECTION_LABELS: Record<string, string> = {
  profile: "โปรไฟล์",
  paycycles: "รอบเงินเดือน",
  categories: "หมวดหมู่",
  recurring: "รายการซ้ำ",
  goals: "เป้าหมาย",
  notifications: "แจ้งเตือน",
  display: "การแสดงผล",
}

const validTabs = Object.keys(SECTION_LABELS)

function SettingsContent() {
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab")
  const active = tab && validTabs.includes(tab) ? tab : "profile"

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
        <Link
          href="/"
          className="p-1.5 -ml-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-base font-semibold text-gray-800">{SECTION_LABELS[active]}</h1>
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
