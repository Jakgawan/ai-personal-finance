// คำนวณ "เงินก้อนถัดไปเข้าวันไหน" — pure functions ไม่แตะ Supabase
// ความหมายของ getNextIncomeDate: คืนวันที่เงินครั้งถัดไปเข้า "หลังวันนี้เท่านั้น" (strictly after today)
// ถ้าเงินเข้าวันนี้ แปลว่าเงินนั้นอยู่ในยอดของวันนี้แล้ว จึงคืนรอบถัดไปแทน
// งาน 5 จะใช้งบตั้งแต่วันนี้ ถึง "วันก่อนวันที่นี้"
// วันที่เป็น string 'YYYY-MM-DD' เทียบด้วย string ตรงๆ ได้ และคำนวณวันผ่าน Date.UTC เพื่อไม่ให้ timezone ทำวันเลื่อน

export type IncomeSourceSchedule = { schedule_type: string; monthly_days: number[] | null }
export type PayCycleLike = { start_day: number }
export type NextIncome = {
  date: string
  source: "income_sources" | "pay_cycles" | "target_date" | "month_end"
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

// วันที่ปัจจุบันตามเวลาไทย (en-CA ให้รูปแบบ YYYY-MM-DD)
export function todayInBangkok(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now)
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function isValidDay(d: unknown): d is number {
  return typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= 31
}

// วันเงินเข้าแบบรายเดือน คืนวันที่ที่ใกล้ที่สุดซึ่งอยู่หลัง today; ไม่มีวันที่ใช้ได้ -> null
export function nextMonthlyDate(days: number[], today: string): string | null {
  const valid = days.filter(isValidDay)
  if (valid.length === 0) return null
  const [ty, tm] = today.split("-").map(Number)
  let best: string | null = null
  for (let offset = 0; offset <= 2; offset++) {
    const idx = tm - 1 + offset
    const y = ty + Math.floor(idx / 12)
    const m = (idx % 12) + 1
    const last = daysInMonth(y, m)
    for (const day of valid) {
      const date = `${y}-${pad2(m)}-${pad2(Math.min(day, last))}`
      if (date > today && (best === null || date < best)) best = date
    }
  }
  return best
}

// วันเงินเข้าแบบรายเดือน คืนวันที่ "ล่าสุดที่ไม่เกิน today" (วันนี้เงินเข้า = คืนวันนี้)
// ดูย้อนหลัง 3 เดือน (เดือนนี้ เดือนก่อน และก่อนหน้านั้น) ข้ามปีได้; ไม่มีวันที่ใช้ได้ -> null
export function prevMonthlyDate(days: number[], today: string): string | null {
  const valid = days.filter(isValidDay)
  if (valid.length === 0) return null
  const [ty, tm] = today.split("-").map(Number)
  let best: string | null = null
  for (let offset = 0; offset <= 2; offset++) {
    const idx = tm - 1 - offset
    const y = ty + Math.floor(idx / 12) // idx ติดลบ -> floor ให้ปีลดลง
    const m = (((idx % 12) + 12) % 12) + 1
    const last = daysInMonth(y, m)
    for (const day of valid) {
      const date = `${y}-${pad2(m)}-${pad2(Math.min(day, last))}`
      if (date <= today && (best === null || date > best)) best = date
    }
  }
  return best
}

function isValidDateString(s: string | null | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

function minDate(dates: (string | null)[]): string | null {
  let best: string | null = null
  for (const d of dates) {
    if (d !== null && (best === null || d < best)) best = d
  }
  return best
}

export function getNextIncomeDate(
  today: string,
  input: {
    incomeSources?: IncomeSourceSchedule[] | null
    payCycles?: PayCycleLike[] | null
    targetDate?: string | null
  }
): NextIncome {
  // 1) รายได้ประจำ
  const fromSources = minDate(
    (input.incomeSources ?? [])
      .filter((s) => s.schedule_type === "monthly_days")
      .map((s) => nextMonthlyDate(s.monthly_days ?? [], today))
  )
  if (fromSources) return { date: fromSources, source: "income_sources" }

  // 2) รอบเงินเดือนแบบเดิม — ถือ start_day เป็นวันเงินเดือนออกรายเดือน
  const fromCycles = minDate((input.payCycles ?? []).map((c) => nextMonthlyDate([c.start_day], today)))
  if (fromCycles) return { date: fromCycles, source: "pay_cycles" }

  // 3) วันที่ตั้งเอง (ถ้าเลยมาแล้วถือว่าเก่า ไม่ใช้)
  if (isValidDateString(input.targetDate) && input.targetDate > today) {
    return { date: input.targetDate, source: "target_date" }
  }

  // 4) เงินอยู่ได้ถึงสิ้นเดือนนี้ ดังนั้นเส้นแบ่งถัดไป = วันแรกของเดือนหน้า
  const [y, m] = today.split("-").map(Number)
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return { date: `${ny}-${pad2(nm)}-01`, source: "month_end" }
}

function maxDate(dates: (string | null)[]): string | null {
  let best: string | null = null
  for (const d of dates) {
    if (d !== null && (best === null || d > best)) best = d
  }
  return best
}

// วันเงินเข้า "ครั้งล่าสุดที่ไม่เกินวันนี้" — ลำดับความสำคัญเหมือน getNextIncomeDate
// ไม่มีทั้ง income_sources และ pay_cycles -> null (target_date / สิ้นเดือน ไม่มีความหมายของ "วันเงินเข้าครั้งก่อน")
export function getPreviousIncomeDate(
  today: string,
  input: {
    incomeSources?: IncomeSourceSchedule[] | null
    payCycles?: PayCycleLike[] | null
  }
): { date: string; source: "income_sources" | "pay_cycles" } | null {
  const fromSources = maxDate(
    (input.incomeSources ?? [])
      .filter((s) => s.schedule_type === "monthly_days")
      .map((s) => prevMonthlyDate(s.monthly_days ?? [], today))
  )
  if (fromSources) return { date: fromSources, source: "income_sources" }

  const fromCycles = maxDate((input.payCycles ?? []).map((c) => prevMonthlyDate([c.start_day], today)))
  if (fromCycles) return { date: fromCycles, source: "pay_cycles" }

  return null
}

// 'YYYY-MM-DD' -> '25 ต.ค. 2569' (ปี พ.ศ.) สร้าง Date ที่เที่ยง UTC กันวันเลื่อน
export function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  })
}

// บวก/ลบวันจาก 'YYYY-MM-DD'
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}
