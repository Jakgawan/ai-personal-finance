const KEY = "slipOcrConsentV1"

// อ่านค่าไม่ได้ (เช่น storage ถูกปิด) = ถือว่ายังไม่ยินยอม
export function hasSlipConsent(): boolean {
  try {
    return localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

// บันทึกไม่ได้ไม่ควรบล็อกการสแกนครั้งนี้
export function setSlipConsent(): void {
  try {
    localStorage.setItem(KEY, "1")
  } catch {
    // ignore
  }
}
