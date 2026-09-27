import * as Sentry from "@sentry/nextjs"

// Next.js เรียกฟังก์ชันนี้ครั้งเดียวตอนเซิร์ฟเวอร์เริ่มทำงาน (ทั้ง Node.js และ Edge runtime)
export async function register() {
  // เลือก config ให้ตรงกับ runtime ที่กำลังรันอยู่ (แยกเพราะ Edge ใช้ API บางอย่างของ Node ไม่ได้)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

// Next.js เรียกฟังก์ชันนี้อัตโนมัติเมื่อเกิด error ใน server component/route handler ที่ไม่ถูกจับไว้
export const onRequestError = Sentry.captureRequestError
