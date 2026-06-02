"use client"

import { useState } from "react"
import ProfileSection from "./components/ProfileSection"
import PayCyclesSection from "./components/PayCyclesSection"
import CategoriesSection from "./components/CategoriesSection"
import RecurringSection from "./components/RecurringSection"

const menuItems = [
  { id: "profile", label: "โปรไฟล์", icon: "👤" },
  { id: "paycycles", label: "รอบเงินเดือน", icon: "📅" },
  { id: "categories", label: "หมวดหมู่", icon: "🏷️" },
  { id: "recurring", label: "รายการซ้ำ", icon: "🔄" },
  { id: "goals", label: "เป้าหมาย", icon: "🎯" },
  { id: "notifications", label: "แจ้งเตือน", icon: "🔔" },
  { id: "display", label: "การแสดงผล", icon: "🌐" },
]

export default function SettingsPage() {
  const [active, setActive] = useState("profile")

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Tabs แนวนอน — ทั้ง mobile และ desktop */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex min-w-max px-4">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
                  active === item.id
                    ? "border-[#1D9E75] text-[#1D9E75] font-semibold"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="p-4 md:p-8">
        {active === "profile" && <ProfileSection />}
        {active === "paycycles" && <PayCyclesSection />}
        {active === "categories" && <CategoriesSection />}
        {active === "recurring" && <RecurringSection />}
        {["goals", "notifications", "display"].includes(active) && (
          <div className="text-gray-400 text-sm">🚧 Coming soon...</div>
        )}
      </main>

    </div>
  )
}