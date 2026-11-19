// ตรวจว่าเป็นวันที่จริงในปฏิทินรูปแบบ YYYY-MM-DD (ไม่ใช้เขตเวลา)
export function isValidDateString(s: unknown): s is string {
  if (typeof s !== "string") return false
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  // สร้างวันที่แบบ UTC แล้วอ่านกลับ ถ้าวัน/เดือน/ปีเปลี่ยนไป แปลว่าไม่มีวันนั้นจริง
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}
