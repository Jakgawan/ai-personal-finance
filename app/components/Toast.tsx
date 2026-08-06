"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"

type ToastType = "success" | "error"
type ToastMessage = { id: number; message: string; type: ToastType }

let idCounter = 0

export function showToast(message: string, type: ToastType = "success") {
  window.dispatchEvent(new CustomEvent("showToast", { detail: { message, type } }))
}

export default function Toast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string; type?: ToastType }>).detail
      const toast: ToastMessage = { id: ++idCounter, message: detail.message, type: detail.type || "success" }
      setToasts((prev) => [...prev, toast])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, 2500)
    }
    window.addEventListener("showToast", handler)
    return () => window.removeEventListener("showToast", handler)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center px-4 w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm text-white max-w-sm ${
            t.type === "success" ? "bg-gray-800" : "bg-[#D85A30]"
          }`}
        >
          {t.type === "success" ? <CheckCircle2 size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
          {t.message}
        </div>
      ))}
    </div>
  )
}
