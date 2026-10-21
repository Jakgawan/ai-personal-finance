import { addDays } from "./income-schedule"

type TxLike = {
  name: string | null
  amount: number | string
  type: string
  date: string
  category: string | null
  kind?: string | null
}

export type TopItem = { name: string; amount: number; category: string | null; count: number }

// รายการที่ผู้ใช้จดบ่อยในช่วง N วันล่าสุด (ชื่อ + ยอด + หมวดเหมือนกัน)
// คืนเรียงถี่สุดก่อน เสมอกันเอาที่จดล่าสุดก่อน
export function topItems(
  txs: TxLike[],
  type: "expense" | "income",
  today: string,
  opts: { days?: number; limit?: number; minCount?: number } = {}
): TopItem[] {
  const days = opts.days ?? 30
  const limit = opts.limit ?? 6
  const minCount = opts.minCount ?? 2
  const from = addDays(today, -(days - 1))

  const groups = new Map<string, { name: string; amount: number; category: string | null; count: number; latest: string }>()
  for (const t of txs) {
    if (t.type !== type) continue
    if (t.kind === "bill_payment") continue
    if (typeof t.date !== "string" || t.date < from || t.date > today) continue
    const n = Number(t.amount)
    if (!Number.isFinite(n) || n <= 0) continue
    const v = Math.round(n * 100) / 100
    if (v <= 0) continue
    const name = typeof t.name === "string" ? t.name.trim() : ""
    const category = t.category ? t.category : null
    const key = JSON.stringify([name, v, category ?? ""])
    const g = groups.get(key)
    if (g) {
      g.count += 1
      if (t.date > g.latest) g.latest = t.date
    } else {
      groups.set(key, { name, amount: v, category, count: 1, latest: t.date })
    }
  }

  return [...groups.values()]
    .filter(g => g.count >= minCount)
    .sort((a, b) => b.count - a.count || (a.latest < b.latest ? 1 : a.latest > b.latest ? -1 : 0))
    .slice(0, limit)
    .map(g => ({ name: g.name, amount: g.amount, category: g.category, count: g.count }))
}
