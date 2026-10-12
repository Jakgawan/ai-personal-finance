"use client"

import { Tag } from "lucide-react"
import { getCategoryIcon } from "@/lib/category-icons"

type Props = {
  icon?: string | null
  color?: string | null
  size?: "sm" | "md" | "lg"
  // true เมื่อใช้แสดงใน chip ที่ถูกเลือกอยู่ (พื้นหลังเขียว) — ให้วงกลมเป็นสีขาวโปร่งแสงแทนสี category ปกติ กันปัญหาสีเขียวซ้อนสีเขียว
  selected?: boolean
}

// ขนาดวงกลม/ไอคอน/ตัวอักษร (legacy emoji) ตาม 3 ระดับที่ spec กำหนด — font-size ใช้ rem ตามกฎ design token
const SIZE_MAP = {
  sm: { circle: 22, icon: 13, text: "0.75rem" },
  md: { circle: 30, icon: 16, text: "0.95rem" },
  lg: { circle: 40, icon: 20, text: "1.25rem" },
}

export default function CategoryIcon({ icon, color, size = "md", selected = false }: Props) {
  const { circle, icon: iconSize, text } = SIZE_MAP[size]
  // ตัดช่องว่างก่อนเช็ค กัน icon เป็นแค่ " " แล้วถูกนับว่ามีค่า (แสดงวงกลมว่างเปล่า)
  const value = icon?.trim()
  const bg = selected ? "rgba(255, 255, 255, 0.25)" : color || "#6B7280"
  const entry = getCategoryIcon(value)

  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{ width: circle, height: circle, backgroundColor: bg }}
    >
      {entry ? (
        <entry.Icon size={iconSize} color="#fff" strokeWidth={2} />
      ) : value ? (
        <span className="leading-none" style={{ fontSize: text }}>
          {value}
        </span>
      ) : (
        <Tag size={iconSize} color="#fff" strokeWidth={2} />
      )}
    </span>
  )
}
