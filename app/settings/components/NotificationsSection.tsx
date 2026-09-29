"use client"

import { useState, useEffect } from "react"
import { BellRing } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { showToast } from "@/app/components/Toast"

type Status = "loading" | "unsupported" | "denied" | "ready"

const VAPID_PUBLIC_KEY: string = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""

// แปลง VAPID public key (base64url) เป็น bytes ที่ pushManager.subscribe ต้องการ
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export default function NotificationsSection() {
  const [status, setStatus] = useState<Status>("loading")
  const [unsupportedMsg, setUnsupportedMsg] = useState("")
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const supported =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
      if (!supported) {
        const ua = navigator.userAgent
        const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
        const standalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone === true
        if (cancelled) return
        setUnsupportedMsg(
          isIOS && !standalone
            ? "บน iPhone/iPad ต้องเพิ่มแอปลงหน้าจอโฮมก่อน: เปิดใน Safari กดปุ่มแชร์ แล้วเลือก 'เพิ่มลงหน้าจอโฮม' จากนั้นเปิดแอปจากไอคอน"
            : "เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน"
        )
        if (cancelled) return
        setStatus("unsupported")
        return
      }
      if (Notification.permission === "denied") {
        if (cancelled) return
        setStatus("denied")
        return
      }
      let reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        // production: SW อาจยังลงทะเบียนไม่เสร็จ — รอสูงสุด ~3 วินาที
        reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 3000)),
        ])
      }
      if (cancelled) return
      if (!reg) {
        // SW ลงทะเบียนเฉพาะ production
        if (cancelled) return
        setUnsupportedMsg("การแจ้งเตือนใช้ได้เฉพาะแอปเวอร์ชันที่ deploy แล้ว")
        if (cancelled) return
        setStatus("unsupported")
        return
      }
      const sub = await reg.pushManager.getSubscription()
      let hasOwnRow = false
      if (sub) {
        // เปิดเฉพาะเมื่อมีแถวของผู้ใช้คนนี้สำหรับ endpoint นี้ด้วย
        const { data } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("endpoint", sub.endpoint)
          .maybeSingle()
        hasOwnRow = data !== null
      }
      if (cancelled) return
      setEnabled(hasOwnRow)
      if (cancelled) return
      setStatus("ready")
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  const enable = async () => {
    setBusy(true)
    let sub: PushSubscription | null = null
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        if (permission === "denied") setStatus("denied")
        return
      }
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) throw new Error("no registration")
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const json = sub.toJSON()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("missing data")
      }
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        { onConflict: "user_id,endpoint" }
      )
      if (error) throw error
      setEnabled(true)
      showToast("เปิดการแจ้งเตือนแล้ว")
    } catch {
      if (sub) await sub.unsubscribe().catch(() => false)
      setEnabled(false)
      showToast("เปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (sub) {
        const { error } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint)
        if (error) {
          showToast("ปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
          return
        }
        await sub.unsubscribe()
      }
      setEnabled(false)
    } catch {
      showToast("ปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง", "error")
    } finally {
      setBusy(false)
    }
  }

  const handleToggle = () => {
    if (busy) return
    if (enabled) disable()
    else enable()
  }

  const sendTest = async () => {
    setTesting(true)
    try {
      const res = await fetch("/api/push/test", { method: "POST" })
      if (res.ok) {
        showToast("ส่งแล้ว รอสักครู่")
        return
      }
      const body: { error?: string } = await res.json().catch(() => ({}))
      if (body.error === "no_subscription") {
        showToast("ไม่พบการสมัครรับแจ้งเตือน ลองปิดแล้วเปิดใหม่", "error")
      } else if (body.error === "not_configured") {
        showToast("ยังไม่ได้ตั้งค่าการแจ้งเตือนบนเซิร์ฟเวอร์", "error")
      } else {
        showToast("ส่งแจ้งเตือนทดสอบไม่สำเร็จ", "error")
      }
    } catch {
      showToast("ส่งแจ้งเตือนทดสอบไม่สำเร็จ", "error")
    } finally {
      setTesting(false)
    }
  }

  const noKey = VAPID_PUBLIC_KEY === ""

  return (
    <div className="max-w-lg">
      <h2 className="text-heading-token text-gray-800 mb-6">แจ้งเตือน</h2>

      {status === "loading" && <div className="h-20 bg-white rounded-xl shadow-sm animate-pulse" />}

      {status === "unsupported" && (
        <div className="bg-white rounded-xl card-padding-token shadow-sm">
          <p className="text-sm text-gray-600">{unsupportedMsg}</p>
        </div>
      )}

      {status === "denied" && (
        <div className="bg-white rounded-xl card-padding-token shadow-sm">
          <p className="text-sm text-gray-600">
            คุณปิดการแจ้งเตือนของแอปนี้ไว้ในเบราว์เซอร์ เปิดได้ที่การตั้งค่าเบราว์เซอร์/เครื่อง
          </p>
        </div>
      )}

      {status === "ready" && (
        <>
          <div className="bg-white rounded-xl card-padding-token shadow-sm flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-800">แจ้งเตือนให้บันทึกรายจ่าย</p>
              <p className="text-xs text-gray-400 mt-1">
                ถ้าวันไหนยังไม่ได้บันทึกรายการ แอปจะเตือนตอนประมาณ 2 ทุ่ม
              </p>
              {noKey && (
                <p className="text-xs text-[#D85A30] mt-1">ยังไม่ได้ตั้งค่าการแจ้งเตือนบนเซิร์ฟเวอร์</p>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="แจ้งเตือนให้บันทึกรายจ่าย"
              onClick={handleToggle}
              disabled={busy || noKey}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
                enabled ? "bg-[#1D9E75]" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {enabled && (
            <button
              type="button"
              onClick={sendTest}
              disabled={testing}
              className="mt-4 w-full btn-height-token flex items-center justify-center gap-2 rounded-xl border border-[#1D9E75] text-[#1D9E75] text-sm font-medium bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <BellRing size={16} />
              {testing ? "กำลังส่ง..." : "ส่งแจ้งเตือนทดสอบ"}
            </button>
          )}
        </>
      )}
    </div>
  )
}
