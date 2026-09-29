import { supabase } from "@/lib/supabase"

// ลบ push subscription ของเครื่องนี้ก่อนออกจากระบบ (เครื่องที่ใช้ร่วมกันจะไม่ได้รับแจ้งเตือนของบัญชีเดิม)
// ต้องเรียกตอนยัง login อยู่ (RLS) — ไม่ throw และใช้เวลาไม่เกิน ~2 วินาที
export async function removePushSubscriptionOnSignOut(): Promise<void> {
  const work = async (): Promise<void> => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) return
      const sub = await reg.pushManager.getSubscription()
      if (!sub) return
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
      await sub.unsubscribe()
    } catch {
      // ไม่ขวางการออกจากระบบ
    }
  }
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2000))
  await Promise.race([work(), timeout])
}
