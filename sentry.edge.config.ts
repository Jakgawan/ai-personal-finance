import * as Sentry from "@sentry/nextjs"

// ทำงานฝั่ง Edge runtime (proxy.ts / middleware, edge API routes) — เปิดเฉพาะตอนมี DSN
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // ไม่ส่งข้อมูลส่วนตัว/ข้อมูลอ่อนไหวแนบไปกับ event โดยอัตโนมัติ
  // (แพ็กเกจ @sentry/nextjs v11 เปลี่ยนจาก `sendDefaultPii` เดี่ยวๆ เป็น `dataCollection` แยกย่อยแต่ละประเภท)
  // userInfo: ไม่เก็บ user.* (เช่น IP), cookies: ไม่เก็บคุกกี้, httpHeaders: ไม่เก็บ header คำขอ/ตอบกลับ,
  // httpBodies: [] ไม่เก็บ body ของคำขอ/ตอบกลับเลย (กันข้อมูลการเงินที่ผู้ใช้พิมพ์ไปหลุดเข้า Sentry),
  // urlQueryParams: ไม่เก็บ query string, stackFrameVariables: ไม่เก็บค่าตัวแปรใน stack trace
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    stackFrameVariables: false,
  },
})
