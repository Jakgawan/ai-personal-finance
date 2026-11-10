import { kindLabel } from "@/lib/kind-label"

// ป้ายเล็กข้างชื่อรายการ: จ่ายบิล / เก็บเงิน / ลงทุน / ถอนเงินเก็บ / ถอนเงินลงทุน (รายการปกติ = ไม่แสดง)
export default function KindBadge({ kind, type }: { kind: string | null | undefined; type: string }) {
  const label = kindLabel(kind, type)
  if (!label) return null
  const color = kind === "saving" || kind === "investment"
    ? "bg-blue-50 text-[#378ADD] border-blue-100"
    : "bg-orange-50 text-[#D85A30] border-orange-100"
  return (
    <span className={`inline-block shrink-0 text-[0.6875rem] leading-none px-1.5 py-1 rounded-full border font-medium ${color}`}>
      {label}
    </span>
  )
}
