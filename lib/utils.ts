// formatDate — แปลงวันที่จาก "2026-05-31" เป็น "31/05/26"
// รับ string format YYYY-MM-DD แล้วคืน DD/MM/YY
export function formatDate(dateStr: string): string {
  if (!dateStr) return "-"

  // split("-") แยก "2026-05-31" เป็น ["2026", "05", "31"]
  const [year, month, day] = dateStr.split("-")

  // ถ้าข้อมูลไม่ครบให้คืนของเดิม
  if (!year || !month || !day) return dateStr

  // year.slice(-2) ตัดเอาแค่ 2 ตัวท้าย "2026" → "26"
  return `${day}/${month}/${year.slice(-2)}`
}