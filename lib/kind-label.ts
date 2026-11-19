// ชื่อประเภทรายการ (kind) ที่แสดงให้ผู้ใช้ — แหล่งเดียวของข้อความ
// คืนค่าว่างถ้าเป็นรายการปกติ

export function kindLabel(kind: string | null | undefined, type: string): string {
  if (kind === "bill_payment") return "จ่ายบิล"
  if (kind === "saving") return type === "income" ? "ถอนเงินเก็บ" : "เก็บเงิน"
  if (kind === "investment") return type === "income" ? "ถอนเงินลงทุน" : "ลงทุน"
  return ""
}
