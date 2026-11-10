"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { computeSavingsTotals, isSavingKind, wouldOverdraw, type SavingsTx } from "@/lib/savings"

type Loaded = { txs: (SavingsTx & { id: string })[]; savingStart: number; investmentStart: number }

// เตือนเมื่อถอนเงินเก็บ/ลงทุนเกินยอดที่จดไว้ (ไม่บล็อกการบันทึก)
// โหลดข้อมูลครั้งเดียวต่อการเปิดฟอร์มที่ต้องใช้; query พลาด = ไม่เตือน ไม่ขึ้น toast
// คืนข้อความเตือน หรือ "" ถ้าไม่ต้องเตือน
export function useWithdrawWarning(params: {
  open: boolean
  type: "expense" | "income"
  kind: string
  amount: number
  excludeId?: string | null
}): string {
  const { open, type, kind, amount, excludeId } = params
  const needs = open && type === "income" && isSavingKind(kind)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  useEffect(() => {
    if (!needs) return
    let cancelled = false
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const [txRes, profRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, amount, type, kind")
          .eq("user_id", user.id)
          .in("kind", ["saving", "investment"]),
        supabase
          .from("financial_profile")
          .select("saving_start, investment_start")
          .eq("user_id", user.id)
          .maybeSingle(),
      ])
      if (cancelled) return
      if (txRes.error || profRes.error) return
      const prof = (profRes.data || {}) as { saving_start?: number | string | null; investment_start?: number | string | null }
      setLoaded({
        txs: (txRes.data || []) as (SavingsTx & { id: string })[],
        savingStart: Number(prof.saving_start ?? 0),
        investmentStart: Number(prof.investment_start ?? 0),
      })
    }
    load()
    // cleanup รันตอนฟอร์มปิด/เปิดใหม่ → ล้างตัวเลขเก่า กันฟอร์มที่เปิดใหม่เห็นยอดครั้งก่อน
    return () => { cancelled = true; setLoaded(null) }
  }, [needs])

  if (!needs || !loaded || !Number.isFinite(amount) || amount <= 0) return ""
  const totals = computeSavingsTotals(
    loaded.txs.filter(t => !excludeId || t.id !== excludeId),
    { savingStart: loaded.savingStart, investmentStart: loaded.investmentStart }
  )
  const raw = kind === "saving" ? totals.savingRaw : totals.investmentRaw
  if (!wouldOverdraw(raw, amount)) return ""
  const have = Math.max(0, raw)
  return `ถอนเกินยอดที่จดไว้ (มี ฿${have.toLocaleString("th-TH")}) — บันทึกได้ แต่ยอดสะสมจะแสดงเป็น ฿0`
}
