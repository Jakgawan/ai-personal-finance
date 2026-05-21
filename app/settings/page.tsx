"use client"

import { useState } from "react"
import ProfileSection from "./components/ProfileSection"
import PayCyclesSection from "./components/PayCyclesSection"
import CategoriesSection from "./components/CategoriesSection"

const menuItems = [
  { id: "profile", label: "บัญชีและโปรไฟล์", icon: "👤" },
  { id: "paycycles", label: "รอบเงินเดือน", icon: "📅" },
  { id: "categories", label: "หมวดหมู่รายการ", icon: "🏷️" },
  { id: "goals", label: "เป้าหมายการเงิน", icon: "🎯" },
  { id: "notifications", label: "การแจ้งเตือน", icon: "🔔" },
  { id: "display", label: "ภาษาและการแสดงผล", icon: "🌐" },
]

export default function SettingsPage() {
  const [active, setActive] = useState("profile")

  return (
    <div className="flex h-full min-h-screen">
      {/* Settings Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Settings
        </h2>
        <nav className="flex flex-col gap-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                active === item.id
                  ? "bg-[#1D9E75] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 p-8 bg-gray-50">
        {active === "profile" && <ProfileSection />}
        {active === "paycycles" && <PayCyclesSection />}
        {active === "categories" && <CategoriesSection />}
        {!["profile", "paycycles", "categories"].includes(active) && (
          <div className="text-gray-400 text-sm">🚧 Coming soon...</div>
        )}
      </main>
    </div>
  )
}