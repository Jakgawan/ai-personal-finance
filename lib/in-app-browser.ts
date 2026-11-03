// ตรวจว่าเปิดแอปอยู่ในเบราว์เซอร์ในแอปอื่น (LINE, Facebook, Instagram, webview) หรือไม่
// ไฟล์นี้เป็นฟังก์ชันล้วน ไม่แตะ window เพื่อให้เทสต์ง่าย

export type BrowserKind = "line" | "android-webview" | "ios-webview" | "normal"

const PARAM = "openExternalBrowser"

export function detectBrowserKind(ua: string, standalone: boolean): BrowserKind {
  // PWA ที่ติดตั้งแล้ว ต้องเช็คก่อนเสมอ (UA ของ iOS PWA ไม่มีคำว่า Safari/)
  if (standalone) return "normal"
  if (!ua) return "normal"
  // LINE in-app browser
  if (ua.includes("Line/")) return "line"
  const social = /FBAN|FBAV|FB_IAB|Instagram/.test(ua)
  // Android webview: มี "; wv)" หรือเป็นแอป Facebook/Instagram
  if (/Android/.test(ua) && (ua.includes("; wv)") || social)) return "android-webview"
  // iOS webview: แอป Facebook/Instagram หรือไม่มี Safari/ (Chrome/Firefox/Edge iOS มี Safari/ จึงเป็น normal)
  if (/iPhone|iPad|iPod/.test(ua) && (/FBAN|FBAV|Instagram/.test(ua) || !ua.includes("Safari/"))) {
    return "ios-webview"
  }
  // ไม่แน่ใจ = ไม่แสดงอะไร
  return "normal"
}

export function hasOpenExternalParam(url: string): boolean {
  try {
    return new URL(url).searchParams.has(PARAM)
  } catch {
    return false
  }
}

// ใส่ openExternalBrowser=1 (LINE จะเปิดลิงก์นี้ในเบราว์เซอร์หลักให้) เก็บ param อื่นและ hash ไว้
export function addOpenExternalParam(url: string): string {
  try {
    const u = new URL(url)
    u.searchParams.set(PARAM, "1")
    return u.toString()
  } catch {
    return url
  }
}

// เอาเฉพาะ param นี้ออก ถ้าไม่เหลือ param อื่นจะไม่มี "?" ค้าง
export function removeOpenExternalParam(url: string): string {
  try {
    const u = new URL(url)
    u.searchParams.delete(PARAM)
    return u.toString()
  } catch {
    return url
  }
}

// สร้างลิงก์ intent:// ให้ Android เปิดใน Chrome
export function androidChromeIntentUrl(url: string): string {
  try {
    const u = new URL(url)
    const scheme = u.protocol === "http:" ? "http" : "https"
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`
  } catch {
    return url
  }
}
