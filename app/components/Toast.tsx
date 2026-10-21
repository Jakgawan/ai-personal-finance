"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"

type ToastType = "success" | "error"
type ToastAction = { label: string; onClick: () => void }
type ToastMessage = { id: number; message: string; type: ToastType; action?: ToastAction }

let idCounter = 0

export function showToast(message: string, type: ToastType = "success", action?: ToastAction) {
  window.dispatchEvent(new CustomEvent("showToast", { detail: { message, type, action } }))
}

export default function Toast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string; type?: ToastType; action?: ToastAction }>).detail
      const toast: ToastMessage = { id: ++idCounter, message: detail.message, type: detail.type || "success", action: detail.action }
      setToasts((prev) => [...prev, toast])
      // toast ที่มีปุ่มอยู่นานกว่า เพื่อให้มีเวลากด
      const timer = setTimeout(() => {
        timers.current.delete(timer)
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, toast.action ? 5000 : 2500)
      timers.current.add(timer)
    }
    window.addEventListener("showToast", handler)
    const activeTimers = timers.current
    return () => {
      window.removeEventListener("showToast", handler)
      activeTimers.forEach(clearTimeout)
      activeTimers.clear()
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div role="status" aria-live="polite" className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center px-4 w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm text-white max-w-sm ${
            t.action ? "pointer-events-auto" : ""
          } ${t.type === "success" ? "bg-gray-800" : "bg-[#D85A30]"}`}
        >
          {t.type === "success" ? <CheckCircle2 size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
          <span>{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                const action = t.action
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
                action?.onClick()
              }}
              className="shrink-0 min-h-[44px] px-3 -my-3 -mr-2 font-bold underline text-[#7FE0BC]"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
