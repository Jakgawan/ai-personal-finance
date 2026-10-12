import * as Sentry from "@sentry/nextjs"

// เปิด Sentry เฉพาะตอนมี DSN (ตั้งใน env NEXT_PUBLIC_SENTRY_DSN) — ถ้าไม่ตั้ง SDK จะไม่ส่ง event ใดๆ
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
  // ผู้ใช้เลือกจับเฉพาะ error ไม่เอา performance tracing — ตัด integration เริ่มต้นที่เกี่ยวกับ tracing/session
  // ออกเอง เพราะ Turbopack ไม่รองรับ flag treeshake ที่ตัดโค้ดพวกนี้ให้ตอน build
  integrations: (defaults) =>
    defaults.filter((i) => i.name !== "BrowserTracing" && i.name !== "BrowserSession"),
})

// export ให้ Next.js เรียกตอนเริ่มเปลี่ยนหน้า (App Router) — ป้องกัน build warning จาก @sentry/nextjs
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
