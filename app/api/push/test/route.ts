import { NextRequest, NextResponse } from "next/server"
import { getAuthUser, createUserClient } from "@/lib/supabase-server"
import { getWebPush, sendPush } from "@/lib/push"

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const supabase = createUserClient(req)
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
  if (error) return NextResponse.json({ error: "db" }, { status: 500 })
  if (!subs || subs.length === 0) return NextResponse.json({ error: "no_subscription" }, { status: 400 })

  const wp = getWebPush()
  if (!wp) return NextResponse.json({ error: "not_configured" }, { status: 500 })

  const payload = {
    title: "ทดสอบการแจ้งเตือน",
    body: "ถ้าเห็นข้อความนี้ แปลว่าการแจ้งเตือนใช้งานได้แล้ว",
    url: "/?quickadd=1",
  }

  let sent = 0
  for (const sub of subs) {
    const result = await sendPush(wp, sub, payload)
    if (result === "ok") sent++
    if (result === "gone") {
      // subscription หมดอายุ/ถูกยกเลิกแล้ว — ลบทิ้ง
      const { error: delError } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", sub.endpoint)
      if (delError) console.error("push cleanup failed")
    }
  }

  if (sent === 0) return NextResponse.json({ error: "send_failed" }, { status: 502 })
  return NextResponse.json({ sent })
}
