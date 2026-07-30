"use client"

import { useState, useRef, useEffect } from "react"
import { Menu } from "lucide-react"

type Props = {
  onOpen: () => void
}

const SIZE = 48
const MARGIN = 16

export default function FloatingMenuButton({ onOpen }: Props) {
  const [top, setTop] = useState<number | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const startYRef = useRef(0)
  const startTopRef = useRef(0)
  const topRef = useRef(0)
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen

  useEffect(() => {
    const initial = window.innerHeight * 0.5
    topRef.current = initial
    setTop(initial)
  }, [])

  const clamp = (y: number) => {
    const max = window.innerHeight - SIZE - MARGIN
    return Math.min(Math.max(y, MARGIN), max)
  }

  const start = (clientY: number) => {
    draggingRef.current = true
    movedRef.current = false
    startYRef.current = clientY
    startTopRef.current = topRef.current
  }

  const move = (clientY: number) => {
    if (!draggingRef.current) return
    const delta = clientY - startYRef.current
    if (Math.abs(delta) > 4) movedRef.current = true
    const next = clamp(startTopRef.current + delta)
    topRef.current = next
    setTop(next)
  }

  const end = () => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (!movedRef.current) onOpenRef.current()
  }

  // touch listener ต้องผูกผ่าน addEventListener({ passive: false }) เอง เพราะ React
  // ผูก onTouchStart/onTouchMove ที่มาจาก JSX prop เป็น passive โดย default ทำให้
  // preventDefault() ไม่มีผลจริง เบราว์เซอร์เลยยังเลื่อน/bounce หน้าเว็บทับปุ่มอยู่ดี
  useEffect(() => {
    const el = btnRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      start(e.touches[0].clientY)
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      move(e.touches[0].clientY)
    }
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      end()
    }

    el.addEventListener("touchstart", onTouchStart, { passive: false })
    el.addEventListener("touchmove", onTouchMove, { passive: false })
    el.addEventListener("touchend", onTouchEnd, { passive: false })
    el.addEventListener("touchcancel", onTouchEnd, { passive: false })

    return () => {
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("touchend", onTouchEnd)
      el.removeEventListener("touchcancel", onTouchEnd)
    }
    // ผูกใหม่ทุกครั้งที่ top เปลี่ยนจาก null เป็นตัวเลข (ตอนปุ่มเพิ่ง mount จริงครั้งแรก)
    // เพราะ component คืน null ตอน top ยังไม่ถูกตั้งค่า ทำให้ btnRef.current เป็น null
    // ถ้าผูกด้วย deps [] เฉยๆ effect จะรันครั้งแรกตอนยังไม่มีปุ่มแล้วไม่รันซ้ำอีกเลย
  }, [top])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => move(e.clientY)
    const onMouseUp = () => end()
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [])

  if (top === null) return null

  return (
    <button
      ref={btnRef}
      type="button"
      style={{ top, right: 12 }}
      className="fixed w-12 h-12 rounded-full bg-[#1D9E75] text-white shadow-lg flex items-center justify-center z-50 md:hidden touch-none active:scale-95 transition-transform"
      onMouseDown={(e) => start(e.clientY)}
    >
      <Menu size={20} />
    </button>
  )
}
