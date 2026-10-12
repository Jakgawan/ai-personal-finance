import { supabase } from "@/lib/supabase"
import { showToast } from "@/app/components/Toast"

// รายการที่ถูกสร้างขึ้นจริงในรอบนี้ (ไว้โชว์ log ให้ผู้ใช้เห็น)
export type CreatedLog = {
  name: string
  amount: number
  type: string
  date: string
}

// ช่วย pad เลขวัน/เดือนให้เป็น 2 หลักเสมอ เช่น 5 -> "05"
function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

// จำนวนวันในเดือน m (1-12) ของปี y — ใช้เพื่อ clamp วันสิ้นเดือน (เช่น 31 ม.ค. + 1 เดือน ต้องได้ 28/29 ก.พ. ไม่ใช่ 3 มี.ค.)
function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

// วันนี้ตามเวลาเครื่อง (local) ไม่ใช่ toISOString ซึ่งเป็น UTC
// เหตุผล: toISOString() ทำให้ช่วงเที่ยงคืน-ตี 7 เวลาไทย ถูกตีความเป็น "เมื่อวาน" ของ UTC
export function todayLocal(): string {
  const now = new Date()
  return formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

// บวกรอบถัดไปให้ dateStr (YYYY-MM-DD) ตาม cycle โดยไม่แตะ timezone เลย (คำนวณจากตัวเลขปี/เดือน/วันตรงๆ)
// anchorDay = วันที่ "ควรจะเป็น" ของรายการนี้ (ปกติคือวันที่ของ start_date) ใช้กันวันเพี้ยนสะสมเวลาเดือนสั้นแล้วเดือนถัดไปยาวขึ้น
export function addCycle(dateStr: string, cycle: string, anchorDay?: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const day = anchorDay ?? d

  if (cycle === "weekly") {
    // ใช้ Date แบบ local (new Date(y, m-1, d)) ไม่ใช่ toISOString ดังนั้นไม่มีปัญหา timezone shift
    const date = new Date(y, m - 1, d)
    date.setDate(date.getDate() + 7)
    return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
  }

  if (cycle === "monthly") {
    let ny = y
    let nm = m + 1
    if (nm > 12) {
      nm = 1
      ny += 1
    }
    const nd = Math.min(day, daysInMonth(ny, nm))
    return formatDate(ny, nm, nd)
  }

  if (cycle === "yearly") {
    const ny = y + 1
    // เผื่อ 29 ก.พ. ปีอธิกสุรทิน -> ปีถัดไปไม่ใช่ปีอธิกสุรทิน clamp เป็น 28 ก.พ.
    const nd = Math.min(day, daysInMonth(ny, m))
    return formatDate(ny, m, nd)
  }

  // cycle ที่ไม่รู้จัก ห้ามปล่อยให้ loop วนไม่จบ ให้ throw ออกไปเลย
  throw new Error(`ไม่รู้จัก cycle: ${cycle}`)
}

// เช็ครูปแบบ YYYY-MM-DD คร่าวๆ (กันค่าว่าง/รูปแบบเพี้ยนก่อนเอาไปคำนวณ)
function isValidDateStr(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !Number.isNaN(new Date(dateStr).getTime())
}

// หา next_date แรกที่ "หลังวันนี้จริงๆ" (ถ้าวันนั้นตรงกับวันนี้หรือในอดีต ยังไม่นับเป็นรอบแรก)
export function firstNextDate(startDate: string, cycle: string): string {
  // startDate รูปแบบผิด (เช่น ค่าว่าง) ห้ามเข้า loop เพราะจะได้ "0-NaN-NaN" แล้ววนไม่จบ/ไม่มีความหมาย
  // เลือกคืนค่า startDate เดิมกลับไปเฉยๆ (ปลอดภัยสุด — ไม่ throw ทำให้หน้าจอ save พัง, ผู้ใช้เห็นค่าที่กรอกเองแล้วแก้ไขได้)
  if (!isValidDateStr(startDate)) return startDate

  const today = todayLocal()
  const rawAnchor = Number(startDate.split("-")[2])
  const anchor = Number.isFinite(rawAnchor) ? rawAnchor : undefined
  let current = startDate
  let iterations = 0

  while (current <= today && iterations < 1000) {
    current = addCycle(current, cycle, anchor)
    iterations++
  }

  return current
}

// กันเรียกซ้ำซ้อนภายในแท็บเดียวกัน — ถ้ามีรอบที่กำลังรันอยู่ ให้ใช้ผลลัพธ์เดียวกัน ไม่เริ่มรอบใหม่ซ้อน
let inFlight: Promise<{ created: CreatedLog[]; errors: number }> | null = null

export function processDueRecurring(): Promise<{ created: CreatedLog[]; errors: number }> {
  if (inFlight) return inFlight
  inFlight = runProcessDueRecurring().finally(() => {
    inFlight = null
  })
  return inFlight
}

async function runProcessDueRecurring(): Promise<{ created: CreatedLog[]; errors: number }> {
  const created: CreatedLog[] = []
  let errors = 0

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { created, errors }

  const today = todayLocal()
  const { data: items, error: selectError } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .lte("next_date", today)

  // ดึงรายการที่ถึงกำหนดไม่สำเร็จ -> ไม่รู้ว่ามีอะไรต้องทำบ้าง หยุดทั้งรอบ นับเป็น error
  if (selectError) {
    errors++
    notifyErrorsOnce(errors)
    return { created, errors }
  }

  for (const item of items || []) {
    let current: string = item.next_date
    const rawAnchor = Number(String(item.start_date).split("-")[2])
    const anchor = Number.isFinite(rawAnchor) ? rawAnchor : undefined
    let count = 0

    // งวดค้างสร้างครบทุกงวด แต่มีเพดานกันวนไม่จบ (สูงสุด 24 งวดต่อรายการต่อรอบ)
    while (current <= today && count < 24) {
      count++

      let next: string
      try {
        next = addCycle(current, item.cycle, anchor)
      } catch {
        errors++
        break
      }

      // ขั้นตอน "จอง" งวดนี้ (compare-and-swap): update next_date เฉพาะเมื่อ next_date ยังเป็นค่าเดิม (current)
      // ถ้าแท็บ/โปรเซสอื่นจองไปก่อนแล้ว next_date จะไม่ตรงกับ current อีกต่อไป -> ไม่มีแถวไหนถูก update
      // .select("id") ทำให้รู้ว่า "จองสำเร็จ" จริงหรือไม่ จากจำนวนแถวที่ได้กลับมา ป้องกันการสร้างรายการซ้ำ
      const { data: claimed, error: claimError } = await supabase
        .from("recurring_transactions")
        .update({ next_date: next })
        .eq("id", item.id)
        .eq("next_date", current)
        .select("id")

      if (claimError || !claimed || claimed.length === 0) {
        // ที่อื่นจองงวดนี้ไปแล้ว หรือเกิด error ตอน update -> หยุดทำรายการนี้ต่อ ไม่ต้อง insert ซ้ำ
        break
      }

      // จองสำเร็จแล้ว ค่อย insert ธุรกรรมจริงของงวดนี้ (วันที่ current)
      let insertError = null
      if (item.business_id) {
        const { error } = await supabase.from("business_transactions").insert({
          user_id: user.id,
          business_id: item.business_id,
          name: item.name,
          amount: item.amount,
          type: item.type,
          category: item.category,
          date: current,
        })
        insertError = error
      } else {
        const { error } = await supabase.from("transactions").insert({
          user_id: user.id,
          name: item.name,
          amount: item.amount,
          type: item.type,
          category: item.category,
          date: current,
          note: "สร้างอัตโนมัติจากรายการซ้ำ",
        })
        insertError = error
      }

      if (insertError) {
        errors++
        // insert พลาด -> คืน next_date กลับเป็น current (เงื่อนไข next_date = next กันไม่ให้ทับของรอบถัดไปที่อาจถูกจองไปแล้ว)
        // ถ้า revert เองก็ error อีก (เช่น หลุด connection) ก็ไม่ throw ต่อ แค่ปล่อยผ่าน — รอบถัดไปที่ next_date <= today จะดึงรายการนี้มาลองใหม่เองอยู่ดี
        await supabase
          .from("recurring_transactions")
          .update({ next_date: current })
          .eq("id", item.id)
          .eq("next_date", next)
        break
      }

      created.push({ name: item.name, amount: item.amount, type: item.type, date: current })
      current = next
    }
  }

  notifyErrorsOnce(errors)
  return { created, errors }
}

// โชว์ toast แจ้งเตือนครั้งเดียวต่อการรันหนึ่งรอบ (เรียกจากในนี้ที่เดียว ไม่ใช่จากผู้เรียก processDueRecurring
// เพราะ layout + settings page ใช้ inFlight promise ร่วมกัน ถ้าไปโชว์ toast ที่ผู้เรียกแต่ละจุดจะซ้ำกัน)
function notifyErrorsOnce(errors: number) {
  if (errors > 0 && typeof window !== "undefined") {
    showToast("สร้างรายการอัตโนมัติจากรายการซ้ำไม่สำเร็จบางรายการ ลองเปิดแอปใหม่อีกครั้ง", "error")
  }
}
