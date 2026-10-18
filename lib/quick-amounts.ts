import { addDays } from "./income-schedule"

type TxLike = { amount: number | string; type: string; date: string }

// ยอดที่ผู้ใช้จดบ่อยในช่วง N วันล่าสุด (ใช้เป็นตัวเลขแนะนำในฟอร์มจด)
// คืนเรียงน้อย -> มาก
export function topAmounts(
  txs: TxLike[],
  type: "expense" | "income",
  today: string,
  opts: { days?: number; limit?: number; minCount?: number } = {}
): number[] {
  const days = opts.days ?? 60
  const limit = opts.limit ?? 4
  const minCount = opts.minCount ?? 2
  const from = addDays(today, -(days - 1))

  const stats = new Map<number, { count: number; latest: string }>()
  for (const t of txs) {
    if (t.type !== type) continue
    if (typeof t.date !== "string" || t.date < from || t.date > today) continue
    const n = Number(t.amount)
    if (!Number.isFinite(n) || n <= 0) continue
    const v = Math.round(n * 100) / 100
    if (v <= 0) continue
    const s = stats.get(v)
    if (s) {
      s.count += 1
      if (t.date > s.latest) s.latest = t.date
    } else {
      stats.set(v, { count: 1, latest: t.date })
    }
  }

  return [...stats.entries()]
    .filter(([, s]) => s.count >= minCount)
    .sort((a, b) => b[1].count - a[1].count || (a[1].latest < b[1].latest ? 1 : a[1].latest > b[1].latest ? -1 : 0))
    .slice(0, limit)
    .map(([v]) => v)
    .sort((a, b) => a - b)
}
