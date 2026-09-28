// คำนวณ "ใช้ได้วันนี้" และ insight แบบ rule-based (ไม่ใช้ AI) — pure functions ไม่แตะ Supabase
// วันที่ทั้งหมดเป็น string 'YYYY-MM-DD' เทียบด้วยการเทียบ string ตรงๆ (รูปแบบนี้เรียงตามลำดับเวลาได้อยู่แล้ว)
// การบวก/ลบวันใช้เลขปี/เดือน/วันล้วนๆ ผ่าน Date.UTC เพื่อไม่ให้ timezone ทำวันเลื่อน

export type BudgetTransaction = {
  date: string
  type: string
  amount: number | string
  category?: string | null
}

// over = วันนี้ใช้เกินงบ (มีรายจ่ายวันนี้), cycle-negative = ไม่ได้ใช้วันนี้แต่รอบติดลบจากวันก่อนๆ
export type BudgetState = "ok" | "over" | "cycle-negative" | "no-income"

export type InsightPart = { text: string; bold?: boolean }
export type Insight = { parts: InsightPart[]; caption?: string }

export type DailyBudget = {
  cycleStart: string
  cycleEnd: string
  daysLeftInclToday: number
  cycleIncome: number
  cycleExpense: number
  cycleBalance: number
  todayExpense: number
  expenseBeforeToday: number
  startOfTodayBalance: number
  todayBudget: number
  availableToday: number
  state: BudgetState
  // งบต่อวันตั้งแต่พรุ่งนี้ถึงสิ้นรอบ — null เมื่อวันนี้เป็นวันสุดท้ายของรอบ (ไม่มี "พรุ่งนี้" ในรอบ), อาจ <= 0 ได้
  tomorrowBudget: number | null
}

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

// แปลงจำนวนเงินเป็นตัวเลขที่ปลอดภัย — NaN/Infinity/ค่าว่าง กลายเป็น 0
function safeAmount(v: number | string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// ค่าที่ปัดแล้วเป็น 0 (|x| < 0.5) ถือเป็น 0 กันการโชว์ "-฿0"
function roundZero(x: number): number {
  return Math.abs(x) < 0.5 ? 0 : x
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

// แปลง 'YYYY-MM-DD' เป็นเลขลำดับวัน (นับจาก epoch) แบบไม่ผูก timezone
function toDayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86400000)
}

function fromDayNumber(n: number): string {
  const dt = new Date(n * 86400000)
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

export function addDays(dateStr: string, days: number): string {
  return fromDayNumber(toDayNumber(dateStr) + days)
}

function monthBounds(todayStr: string): { start: string; end: string } {
  const [y, m] = todayStr.split("-").map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { start: `${y}-${pad2(m)}-01`, end: `${y}-${pad2(m)}-${pad2(lastDay)}` }
}

export function formatMoney(n: number): string {
  return Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 })
}

// 'YYYY-MM-DD' -> '25 ต.ค.'
export function formatThaiShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number)
  return `${d} ${THAI_MONTHS_SHORT[m - 1]}`
}

function sumBy(txs: BudgetTransaction[], type: string, from: string, to: string): number {
  return txs
    .filter(t => t.type === type && t.date >= from && t.date <= to)
    .reduce((s, t) => s + safeAmount(t.amount), 0)
}

// สร้างช่วงรอบเงินเดือนของ "รอบที่วันนี้อยู่" เป็น string โดยบีบวันที่ให้ไม่เกินจำนวนวันของเดือน
// (เช่น วันที่ 31 ในเดือน 30 วัน/ก.พ. จะไม่ล้นไปเดือนถัดไป)
// คืน null ถ้าวันนี้ไม่อยู่ในช่วงนั้น -> ผู้เรียกจะใช้เดือนปฏิทินแทน
export function resolveCycleRange(startDay: number, endDay: number, todayStr: string): { start: string; end: string } | null {
  const [y, m, d] = todayStr.split("-").map(Number)
  const clampIn = (yy: number, mm: number, day: number): string => {
    const dt = new Date(Date.UTC(yy, mm - 1, 1)) // normalize เดือนที่ล้น/ติดลบ
    const ny = dt.getUTCFullYear()
    const nm = dt.getUTCMonth() + 1
    const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
    return `${ny}-${pad2(nm)}-${pad2(Math.min(Math.max(1, day), last))}`
  }
  let start: string
  let end: string
  if (startDay > endDay) {
    // รอบข้ามเดือน: ถ้าวันนี้ >= วันเริ่ม รอบเริ่มเดือนนี้จบเดือนหน้า ไม่งั้นเริ่มเดือนก่อนจบเดือนนี้
    if (d >= startDay) { start = clampIn(y, m, startDay); end = clampIn(y, m + 1, endDay) }
    else { start = clampIn(y, m - 1, startDay); end = clampIn(y, m, endDay) }
  } else {
    start = clampIn(y, m, startDay)
    end = clampIn(y, m, endDay)
  }
  return todayStr >= start && todayStr <= end ? { start, end } : null
}

export function calcDailyBudget(
  transactions: BudgetTransaction[],
  cycleStartIn: string | null,
  cycleEndIn: string | null,
  todayStr: string
): DailyBudget {
  const bounds = monthBounds(todayStr)
  const cycleStart = cycleStartIn && cycleEndIn ? cycleStartIn : bounds.start
  const cycleEnd = cycleStartIn && cycleEndIn ? cycleEndIn : bounds.end

  // นับวันแบบรวมวันนี้ (วันนี้ = สิ้นรอบ -> 1) ขั้นต่ำ 1 กัน หาร 0
  const daysLeftInclToday = Math.max(1, toDayNumber(cycleEnd) - toDayNumber(todayStr) + 1)

  const cycleIncome = sumBy(transactions, "income", cycleStart, cycleEnd)
  const cycleExpense = sumBy(transactions, "expense", cycleStart, cycleEnd)
  // รายจ่ายวันนี้ (นับเฉพาะที่อยู่ในรอบ) และรายจ่ายก่อนวันนี้ในรอบ
  const todayInCycle = todayStr >= cycleStart && todayStr <= cycleEnd
  const todayExpense = todayInCycle ? sumBy(transactions, "expense", todayStr, todayStr) : 0
  const expenseBeforeToday = cycleExpense - todayExpense

  const startOfTodayBalance = cycleIncome - expenseBeforeToday
  const todayBudget = startOfTodayBalance / daysLeftInclToday
  const availableToday = todayBudget - todayExpense

  const cycleBalance = cycleIncome - cycleExpense

  // ตัดสิน state หลังปัดค่า (|x| < 0.5 = 0) กันโชว์ "-฿0" สีแดง
  const state: BudgetState =
    cycleIncome <= 0 ? "no-income"
    : roundZero(availableToday) < 0 ? (roundZero(todayExpense) > 0 ? "over" : "cycle-negative")
    : "ok"

  const tomorrowBudget = daysLeftInclToday > 1 ? cycleBalance / (daysLeftInclToday - 1) : null

  return {
    cycleStart, cycleEnd, daysLeftInclToday,
    cycleIncome, cycleExpense, cycleBalance, todayExpense, expenseBeforeToday,
    startOfTodayBalance, todayBudget, availableToday, state, tomorrowBudget,
  }
}

// เลือก insight ได้สูงสุด 1 ข้อ เรียงตามความสำคัญ และต้องมีข้อมูลรองรับทุกข้อ (ไม่ชมลอยๆ)
export function pickInsight(
  transactions: BudgetTransaction[],
  budget: DailyBudget,
  todayStr: string
): Insight | null {
  // (a) ใช้เกินงบวันนี้ -> บอกว่าวันละเท่าไรถึงจะพอถึงสิ้นรอบ
  if (budget.state === "over" && budget.tomorrowBudget !== null && Math.floor(budget.tomorrowBudget) > 0) {
    return {
      parts: [
        { text: "ถ้าใช้ไม่เกินวันละ " },
        { text: `฿${formatMoney(Math.floor(budget.tomorrowBudget))}`, bold: true },
        { text: " จะมีเงินพอถึง " },
        { text: formatThaiShortDate(budget.cycleEnd), bold: true },
      ],
    }
  }

  // (b) หมวดที่ใช้มากสุดใน 7 วันล่าสุด เทียบ 7 วันก่อนหน้า
  const thisWeekFrom = addDays(todayStr, -6)
  const prevWeekFrom = addDays(todayStr, -13)
  const prevWeekTo = addDays(todayStr, -7)
  const byCat = (from: string, to: string): Record<string, number> => {
    const acc: Record<string, number> = {}
    transactions.forEach(t => {
      if (t.type !== "expense" || !t.category || t.date < from || t.date > to) return
      acc[t.category] = (acc[t.category] || 0) + safeAmount(t.amount)
    })
    return acc
  }
  const thisWeek = byCat(thisWeekFrom, todayStr)
  const prevWeek = byCat(prevWeekFrom, prevWeekTo)
  const top = Object.entries(thisWeek).sort((a, b) => b[1] - a[1])[0]
  if (top) {
    const [cat, a] = top
    const b = prevWeek[cat] || 0
    if (a - b >= 100 && a - b >= b * 0.2) {
      return {
        parts: [
          { text: "สัปดาห์นี้หมวด " },
          { text: cat, bold: true },
          { text: " ใช้ไป " },
          { text: `฿${formatMoney(a)}`, bold: true },
          { text: " มากกว่าสัปดาห์ก่อน " },
          { text: `฿${formatMoney(b)}`, bold: true },
        ],
        caption: "คำนวณจากรายการที่คุณบันทึก 7 วันล่าสุด",
      }
    }
  }

  // (c) วันนี้ยังไม่มีรายการเลย
  if (!transactions.some(t => t.date === todayStr)) {
    return { parts: [{ text: "วันนี้ยังไม่ได้บันทึกรายการ" }] }
  }

  return null
}
