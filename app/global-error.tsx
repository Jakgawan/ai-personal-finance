"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"
import { RotateCcw } from "lucide-react"
import "./globals.css"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // ส่ง error ไปที่ Sentry ทันทีที่หน้านี้แสดงผล (useEffect รันหลัง render ครั้งแรก)
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    // global-error.tsx ต้องมี <html>/<body> เอง เพราะมันแทนที่ root layout ทั้งหมดตอนเกิด error
    <html lang="th">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-4 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">เกิดข้อผิดพลาด</h1>
          <p className="text-gray-500">ขออภัย มีบางอย่างผิดพลาด ลองใหม่อีกครั้งได้เลย</p>
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 rounded-lg bg-[#1D9E75] px-6 py-3 font-medium text-white transition hover:opacity-90"
          >
            <RotateCcw className="h-5 w-5" />
            ลองใหม่อีกครั้ง
          </button>
        </div>
      </body>
    </html>
  )
}
