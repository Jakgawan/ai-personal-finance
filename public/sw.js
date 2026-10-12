// Service worker — ทำให้ติดตั้งแอปได้ และรับ push notification
// handlers: install/activate (เข้าควบคุมหน้าทันที), push (แสดงการแจ้งเตือน), notificationclick (เปิด/โฟกัสแอปแล้วไปที่ url)
// ไม่มี fetch handler และไม่ cache อะไรเลย (กันข้อมูลการเงินเก่า/ของบัญชีอื่นค้างในเครื่อง)
self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let title = "Finance"
  let body = ""
  let url = "/"
  let tag
  try {
    const data = event.data ? event.data.json() : null
    if (data) {
      title = data.title || title
      body = data.body || body
      url = data.url || url
      tag = data.tag || undefined
    }
  } catch {
    // payload ไม่ใช่ JSON — ใช้ค่าเริ่มต้น
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
      lang: "th",
      tag,
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const raw = (event.notification.data && event.notification.data.url) || "/"
  const url = new URL(raw, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => new URL(c.url).origin === self.location.origin)
      if (!existing) return self.clients.openWindow(url)
      // navigate ไม่มี หรือ reject -> เปิดหน้าต่างใหม่แทน
      return existing
        .focus()
        .then(() => (typeof existing.navigate === "function" ? existing.navigate(url) : Promise.reject(new Error("no navigate"))))
        .catch(() => self.clients.openWindow(url))
    })
  )
})
