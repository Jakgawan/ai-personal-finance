"use client"

import { Circle, Receipt, PiggyBank, TrendingUp } from "lucide-react"
import type { ComponentType } from "react"

export type FormKind = "regular" | "bill_payment" | "saving" | "investment"

type Option = { value: FormKind; label: string; Icon: ComponentType<{ size?: number; className?: string }> }

const EXPENSE_OPTIONS: Option[] = [
  { value: "regular", label: "ใช้จ่ายปกติ", Icon: Circle },
  { value: "bill_payment", label: "จ่ายบิล", Icon: Receipt },
  { value: "saving", label: "เก็บเงิน", Icon: PiggyBank },
  { value: "investment", label: "ลงทุน", Icon: TrendingUp },
]

const INCOME_OPTIONS: Option[] = [
  { value: "regular", label: "รายรับปกติ", Icon: Circle },
  { value: "saving", label: "ถอนเงินเก็บ", Icon: PiggyBank },
  { value: "investment", label: "ถอนเงินลงทุน", Icon: TrendingUp },
]

function hintFor(type: "expense" | "income", kind: FormKind): string {
  if (kind === "bill_payment") return "ไม่นับเป็นค่าใช้จ่ายของวันนี้"
  if (kind === "saving" || kind === "investment") {
    return type === "expense"
      ? "หักจากเงินใช้ได้ แต่ไม่นับเป็นค่าใช้จ่าย"
      : "เพิ่มกลับเข้าเงินใช้ได้ ไม่นับเป็นรายรับ"
  }
  return ""
}

export default function KindSelector({
  type,
  kind,
  onChange,
}: {
  type: "expense" | "income"
  kind: FormKind
  onChange: (kind: FormKind) => void
}) {
  const options = type === "expense" ? EXPENSE_OPTIONS : INCOME_OPTIONS
  const hint = hintFor(type, kind)
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="ประเภทรายการ">
        {options.map(({ value, label, Icon }) => {
          const selected = kind === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(value)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-[0.875rem] ${
                selected
                  ? "bg-[#1D9E75] border-[#1D9E75] text-white"
                  : "bg-white border-[#1D9E75] text-[#1D9E75]"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          )
        })}
      </div>
      {hint && <p className="text-[0.75rem] text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}
