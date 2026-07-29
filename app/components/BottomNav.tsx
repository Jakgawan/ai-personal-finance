"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ListOrdered, Plus } from "lucide-react"

type Props = {
  onFabClick: () => void
}

export default function BottomNav({ onFabClick }: Props) {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-40 md:hidden flex items-center justify-around px-6 pb-[env(safe-area-inset-bottom)]">
      <Link
        href="/"
        className={`flex flex-col items-center gap-0.5 text-xs w-16 ${pathname === "/" ? "text-[#1D9E75]" : "text-gray-500"}`}
      >
        <LayoutDashboard size={20} />
        ภาพรวม
      </Link>

      <button
        onClick={onFabClick}
        className="w-14 h-14 -mt-8 bg-[#1D9E75] text-white rounded-full shadow-lg hover:bg-[#178a64] transition-colors flex items-center justify-center shrink-0"
      >
        <Plus size={24} />
      </button>

      <Link
        href="/transaction"
        className={`flex flex-col items-center gap-0.5 text-xs w-16 ${pathname === "/transaction" ? "text-[#1D9E75]" : "text-gray-500"}`}
      >
        <ListOrdered size={20} />
        รายการ
      </Link>
    </nav>
  )
}
