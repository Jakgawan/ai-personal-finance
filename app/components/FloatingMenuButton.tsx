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
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const startYRef = useRef(0)
  const startTopRef = useRef(0)
  const topRef = useRef(0)

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
    if (!movedRef.current) onOpen()
  }

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => move(e.clientY)
    const onMouseUp = () => end()
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (top === null) return null

  return (
    <button
      style={{ top, right: 12 }}
      className="fixed w-12 h-12 rounded-full bg-[#1D9E75] text-white shadow-lg flex items-center justify-center z-50 md:hidden touch-none active:scale-95 transition-transform"
      onMouseDown={(e) => start(e.clientY)}
      onTouchStart={(e) => start(e.touches[0].clientY)}
      onTouchMove={(e) => move(e.touches[0].clientY)}
      onTouchEnd={end}
    >
      <Menu size={20} />
    </button>
  )
}
