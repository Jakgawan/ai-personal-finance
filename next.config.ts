import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // ไม่มี auth token/org/project ตอนนี้ — ปิดการอัปโหลด source map ทั้งหมด กัน build เตือน/พยายามอัปโหลด
  sourcemaps: {
    disable: true,
  },
  // ปิด log ของ Sentry ตอน build ให้เงียบ (ไม่มีอะไรให้อัปโหลดอยู่แล้ว)
  silent: true,
  // ส่ง event ผ่าน path นี้ของแอปเราเอง กัน ad blocker บล็อก request ไป sentry.io ตรงๆ
  tunnelRoute: "/monitoring",
});
