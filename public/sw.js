// Service worker ขั้นต่ำ — ทำให้ติดตั้งแอปได้เท่านั้น
// ไม่มี fetch handler และไม่ cache อะไรเลย (กันข้อมูลการเงินเก่า/ของบัญชีอื่นค้างในเครื่อง)
// push handler จะเพิ่มในงาน 3b
self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})
