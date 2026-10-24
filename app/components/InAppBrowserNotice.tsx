"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Ellipsis, Share, X, ExternalLink } from "lucide-react"
import {
  detectBrowserKind,
  hasOpenExternalParam,
  addOpenExternalParam,
  removeOpenExternalParam,
  androidChromeIntentUrl,
} from "@/lib/in-app-browser"

type Platform = "android" | "ios"

export default function InAppBrowserNotice() {
  // null = ยังไม่ตัดสินใจ (ไม่ render เพื่อกัน SSR mismatch)
  const [platform, setPlatform] = useState<Platform | null>(null)
  const router = useRouter()

  useEffect(() => {
    const standalone: boolean =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    const kind = detectBrowserKind(navigator.userAgent, standalone)
    const isAndroid = /Android/.test(navigator.userAgent)

    if (kind === "normal") {
      // เปิดในเบราว์เซอร์หลักแล้ว: เอา param ที่ใช้เด้งออกจาก URL
      if (hasOpenExternalParam(window.location.href)) {
        try {
          // ใช้ router ของ Next เพื่อให้ state ตรงกับ URL (ใช้ path แบบ relative)
          const clean = new URL(removeOpenExternalParam(window.location.href))
          router.replace(clean.pathname + clean.search + clean.hash, { scroll: false })
        } catch {
          // ไม่เป็นไร
        }
      }
      return
    }

    if (kind === "line") {
      let redirected = false
      try {
        redirected = sessionStorage.getItem("inAppRedirected") !== null
      } catch {
        redirected = true // อ่านไม่ได้ = ไม่เด้งซ้ำ กันวนลูป
      }
      if (!hasOpenExternalParam(window.location.href) && !redirected) {
        let marked = false
        try {
          sessionStorage.setItem("inAppRedirected", "1")
          marked = true
        } catch {
          // จดไม่ได้ = ไม่เด้ง (กันวนลูป) แสดงแบนเนอร์แทน
        }
        if (marked) {
          window.location.replace(addOpenExternalParam(window.location.href))
          return
        }
      }
      // LINE ไม่ส่งต่อให้ -> แสดงแบนเนอร์แทน
    }

    try {
      if (localStorage.getItem("inAppNoticeDismissed") === "1") return
    } catch {
      // อ่านไม่ได้ก็แสดงต่อ
    }
    const android = kind === "android-webview" || (kind === "line" && isAndroid)
    // เลื่อนการ set state ออกจากตัว effect โดยตรง
    const timer = setTimeout(() => setPlatform(android ? "android" : "ios"), 0)
    return () => clearTimeout(timer)
  }, [router])

  function dismiss(): void {
    try {
      localStorage.setItem("inAppNoticeDismissed", "1")
    } catch {
      // ไม่เป็นไร
    }
    setPlatform(null)
  }

  if (platform === null) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[1000] bg-white border-b border-gray-200 flex items-start gap-2 px-3 pb-2"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}
    >
      <ExternalLink size={18} className="shrink-0 mt-0.5" color="#378ADD" />
      <div className="flex-1 min-w-0">
        <p className="text-[0.8125rem] text-gray-700 leading-snug">
          เปิดในเบราว์เซอร์หรือเพิ่มลงหน้าจอโฮม เพื่อไม่ต้องเข้าสู่ระบบบ่อย
        </p>
        {platform === "android" ? (
          <button
            type="button"
            onClick={() => {
              window.location.href = androidChromeIntentUrl(window.location.href)
            }}
            className="mt-1.5 px-3 py-1.5 rounded-lg text-[0.8125rem] font-medium text-white"
            style={{ backgroundColor: "#1D9E75" }}
          >
            เปิดใน Chrome
          </button>
        ) : (
          <p className="mt-1 text-[0.75rem] text-gray-500 leading-snug">
            กดปุ่ม <Ellipsis size={14} className="inline align-text-bottom" aria-label="จุดสามจุด" /> หรือปุ่มแชร์{" "}
            <Share size={14} className="inline align-text-bottom" aria-label="แชร์" /> แล้วเลือก &quot;เปิดใน Safari&quot;
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="ปิด"
        className="shrink-0 flex items-center justify-center w-11 h-11 -mt-1 -mr-2 text-gray-500"
      >
        <X size={20} />
      </button>
    </div>
  )
}
