import webpush from "web-push"

export type PushPayload = { title: string; body: string; url: string }

export type PushSub = { endpoint: string; p256dh: string; auth: string }

type WebPush = typeof webpush

// คืน null ถ้ายังไม่ได้ตั้ง VAPID env ครบ (ไม่ log ค่าใดๆ)
export function getWebPush(): WebPush | null {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!pub || !priv || !subject) return null
  try {
    webpush.setVapidDetails(subject, pub, priv)
  } catch {
    console.error("invalid VAPID configuration")
    return null
  }
  return webpush
}

export async function sendPush(
  wp: WebPush,
  sub: PushSub,
  payload: PushPayload
): Promise<"ok" | "gone" | "error"> {
  try {
    await wp.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12 }
    )
    return "ok"
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode
    if (statusCode === 404 || statusCode === 410) return "gone"
    console.error("push send failed", statusCode)
    return "error"
  }
}
