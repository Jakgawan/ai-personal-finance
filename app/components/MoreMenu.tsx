"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import {
  CalendarDays, Scale, Briefcase, MessageCircle, GraduationCap,
  Settings, LogOut, MoreHorizontal, ChevronRight, ChevronLeft,
  Tag, RefreshCw, Target, User, Bell, Globe,
  type LucideIcon,
} from "lucide-react"

type Props = {
  open: boolean
  onClose: () => void
  mode: "simple" | "full"
}

type PanelKey = "root" | "more" | "settings"

type Row =
  | { kind: "link"; label: string; icon: LucideIcon; href: string }
  | { kind: "panel"; label: string; icon: LucideIcon; panel: PanelKey }
  | { kind: "placeholder"; label: string; icon: LucideIcon }
  | { kind: "signout" }

const ROOT_FULL: Row[] = [
  { kind: "link", label: "วางแผน", icon: CalendarDays, href: "/planning" },
  { kind: "link", label: "งบการเงิน", icon: Scale, href: "/balance-sheet" },
  { kind: "link", label: "ธุรกิจ", icon: Briefcase, href: "/business" },
  { kind: "link", label: "ปรึกษาการเงิน", icon: MessageCircle, href: "/ai" },
  { kind: "link", label: "คอร์สการเงิน", icon: GraduationCap, href: "/courses" },
  { kind: "panel", label: "เพิ่มเติม", icon: MoreHorizontal, panel: "more" },
  { kind: "panel", label: "ตั้งค่า", icon: Settings, panel: "settings" },
  { kind: "signout" },
]

const ROOT_SIMPLE: Row[] = [
  { kind: "panel", label: "เพิ่มเติม", icon: MoreHorizontal, panel: "more" },
  { kind: "panel", label: "ตั้งค่า", icon: Settings, panel: "settings" },
  { kind: "signout" },
]

const MORE_FULL: Row[] = [
  { kind: "link", label: "รอบเงินเดือน", icon: CalendarDays, href: "/settings?tab=paycycles" },
  { kind: "link", label: "หมวดหมู่", icon: Tag, href: "/settings?tab=categories" },
  { kind: "link", label: "รายการซ้ำ", icon: RefreshCw, href: "/settings?tab=recurring" },
  { kind: "placeholder", label: "เป้าหมาย", icon: Target },
]

const MORE_SIMPLE: Row[] = [
  { kind: "link", label: "รอบเงินเดือน", icon: CalendarDays, href: "/settings?tab=paycycles" },
  { kind: "link", label: "หมวดหมู่", icon: Tag, href: "/settings?tab=categories" },
]

const SETTINGS_ROWS: Row[] = [
  { kind: "link", label: "โปรไฟล์", icon: User, href: "/settings?tab=profile" },
  { kind: "placeholder", label: "แจ้งเตือน", icon: Bell },
  { kind: "link", label: "การแสดงผล", icon: Globe, href: "/settings?tab=display" },
]

export default function MoreMenu({ open, onClose, mode }: Props) {
  const [panel, setPanel] = useState<PanelKey>("root")

  useEffect(() => {
    if (!open) setPanel("root")
  }, [open])

  if (!open) return null

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  const panels: Record<PanelKey, { title: string | null; rows: Row[] }> = {
    root: { title: null, rows: mode === "full" ? ROOT_FULL : ROOT_SIMPLE },
    more: { title: "เพิ่มเติม", rows: mode === "full" ? MORE_FULL : MORE_SIMPLE },
    settings: { title: "ตั้งค่า", rows: SETTINGS_ROWS },
  }

  const { title, rows } = panels[panel]

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[70] flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-sm md:rounded-2xl rounded-t-2xl shadow-xl pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center gap-2 px-2 pt-2">
            <button
              onClick={() => setPanel("root")}
              className="flex items-center gap-1 px-2 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-lg"
            >
              <ChevronLeft size={18} />
              กลับ
            </button>
            <span className="text-sm font-semibold text-gray-700">{title}</span>
          </div>
        )}

        <div className="flex flex-col gap-1 p-2">
          {rows.map((row, i) => {
            if (row.kind === "signout") {
              return (
                <button
                  key="signout"
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-red-500 hover:bg-red-50 text-left"
                >
                  <LogOut size={18} className="shrink-0" />
                  ออกจากระบบ
                </button>
              )
            }
            if (row.kind === "placeholder") {
              return (
                <div
                  key={row.label}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-300 cursor-not-allowed"
                >
                  <row.icon size={18} className="shrink-0" />
                  {row.label}
                  <span className="ml-auto text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">เร็วๆ นี้</span>
                </div>
              )
            }
            if (row.kind === "panel") {
              return (
                <button
                  key={row.label}
                  onClick={() => setPanel(row.panel)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-700 hover:bg-gray-50 text-left"
                >
                  <row.icon size={18} className="shrink-0 text-gray-500" />
                  {row.label}
                  <ChevronRight size={16} className="ml-auto text-gray-300" />
                </button>
              )
            }
            return (
              <Link
                key={row.href + i}
                href={row.href}
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                <row.icon size={18} className="shrink-0 text-gray-500" />
                {row.label}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
