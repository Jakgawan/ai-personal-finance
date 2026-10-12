import type { MetadataRoute } from "next"

// เปลี่ยนชื่อแอปที่นี่ที่เดียว (ชื่อยังไม่ตัดสินใจ — ใช้ชั่วคราว)
export const APP_NAME = "Finance"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "แอปบันทึกรายรับรายจ่าย",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F9FAFB",
    theme_color: "#1D9E75",
    lang: "th",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
