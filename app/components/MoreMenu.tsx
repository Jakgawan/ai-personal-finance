"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import {
  CalendarDays, Scale, Briefcase, MessageCircle, GraduationCap,
  Settings, LogOut, MoreHorizontal, ChevronLeft, X,
  Tag, RefreshCw, Target, User, Bell, Globe,
  type LucideIcon,
} from "lucide-react"

type PanelKey = "root" | "more" | "settings"

type Props = {
  open: boolean
  onClose: () => void
  mode: "simple" | "full"
}

type Tile =
  | { kind: "link"; label: string; icon: LucideIcon; href: string }
  | { kind: "panel"; label: string; icon: LucideIcon; panel: PanelKey }
  | { kind: "placeholder"; label: string; icon: LucideIcon }
  | { kind: "signout" }

const ROOT_FULL: Tile[] = [
  { kind: "link", label: "วางแผน", icon: CalendarDays, href: "/planning" },
  { kind: "link", label: "งบการเงิน", icon: Scale, href: "/balance-sheet" },
  { kind: "link", label: "ธุรกิจ", icon: Briefcase, href: "/business" },
  { kind: "link", label: "ปรึกษาการเงิน", icon: MessageCircle, href: "/ai" },
  { kind: "link", label: "คอร์สการเงิน", icon: GraduationCap, href: "/courses" },
  { kind: "panel", label: "เพิ่มเติม", icon: MoreHorizontal, panel: "more" },
  { kind: "panel", label: "ตั้งค่า", icon: Settings, panel: "settings" },
  { kind: "signout" },
]

const ROOT_SIMPLE: Tile[] = [
  { kind: "panel", label: "เพิ่มเติม", icon: MoreHorizontal, panel: "more" },
  { kind: "panel", label: "ตั้งค่า", icon: Settings, panel: "settings" },
  { kind: "signout" },
]

const MORE_FULL: Tile[] = [
  { kind: "link", label: "รอบเงินเดือน", icon: CalendarDays, href: "/settings?tab=paycycles" },
  { kind: "link", label: "หมวดหมู่", icon: Tag, href: "/settings?tab=categories" },
  { kind: "link", label: "รายการซ้ำ", icon: RefreshCw, href: "/settings?tab=recurring" },
  { kind: "placeholder", label: "เป้าหมาย", icon: Target },
]

const MORE_SIMPLE: Tile[] = [
  { kind: "link", label: "รอบเงินเดือน", icon: CalendarDays, href: "/settings?tab=paycycles" },
  { kind: "link", label: "หมวดหมู่", icon: Tag, href: "/settings?tab=categories" },
]

const SETTINGS_TILES: Tile[] = [
  { kind: "link", label: "โปรไฟล์", icon: User, href: "/settings?tab=profile" },
  { kind: "placeholder", label: "แจ้งเตือน", icon: Bell },
  { kind: "link", label: "การแสดงผล", icon: Globe, href: "/settings?tab=display" },
]

export default function MoreMenu({ open, onClose, mode }: Props) {
  const [panel, setPanel] = useState<PanelKey>("root")

  useEffect(() => {
    if (open) setPanel("root")
  }, [open])

  if (!open) return null

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  const panels: Record<PanelKey, { title: string | null; tiles: Tile[] }> = {
    root: { title: null, tiles: mode === "full" ? ROOT_FULL : ROOT_SIMPLE },
    more: { title: "เพิ่มเติม", tiles: mode === "full" ? MORE_FULL : MORE_SIMPLE },
    settings: { title: "ตั้งค่า", tiles: SETTINGS_TILES },
  }

  const { title, tiles } = panels[panel]

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-xs rounded-3xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center min-h-[2rem] pt-5 pb-1">
          {title && (
            <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {title}
            </p>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4 p-5 pt-4">
          {tiles.map((tile, i) => {
            if (tile.kind === "signout") {
              return (
                <button
                  key="signout"
                  onClick={handleSignOut}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
                    <LogOut size={22} className="text-red-500" />
                  </div>
                  <span className="text-xs text-gray-600 text-center leading-tight">ออกจากระบบ</span>
                </button>
              )
            }
            if (tile.kind === "placeholder") {
              return (
                <div key={tile.label} className="flex flex-col items-center gap-1 cursor-not-allowed">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <tile.icon size={22} className="text-gray-300" />
                  </div>
                  <span className="text-xs text-gray-300 text-center leading-tight">{tile.label}</span>
                  <span className="text-[9px] text-gray-300 text-center leading-none">เร็วๆ นี้</span>
                </div>
              )
            }
            if (tile.kind === "panel") {
              return (
                <button
                  key={tile.label}
                  onClick={() => setPanel(tile.panel)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <tile.icon size={22} className="text-gray-700" />
                  </div>
                  <span className="text-xs text-gray-600 text-center leading-tight">{tile.label}</span>
                </button>
              )
            }
            return (
              <Link
                key={tile.href + i}
                href={tile.href}
                onClick={onClose}
                className="flex flex-col items-center gap-1.5"
              >
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <tile.icon size={22} className="text-gray-700" />
                </div>
                <span className="text-xs text-gray-600 text-center leading-tight">{tile.label}</span>
              </Link>
            )
          })}
        </div>

        <div className="flex justify-center pb-5">
          <button
            onClick={() => (panel === "root" ? onClose() : setPanel("root"))}
            className="w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
          >
            {panel === "root" ? <X size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      </div>
    </div>
  )
}
