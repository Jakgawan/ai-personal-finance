import { timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { getWebPush, sendPush } from "@/lib/push"

export const dynamic = "force-dynamic"
export const maxDuration = 60

type SubRow = { user_id: string; endpoint: string; p256dh: string; auth: string }

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const expected = Buffer.from(`Bearer ${secret ?? ""}`)
  const given = Buffer.from(req.headers.get("authorization") ?? "")
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const wp = getWebPush()
  if (!admin || !wp) return NextResponse.json({ error: "not_configured" }, { status: 500 })

  // วันนี้ตามเวลาไทย (YYYY-MM-DD) และเที่ยงคืนของวันนี้ในเขตเวลาไทย
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date())
  const startIso = `${today}T00:00:00+07:00`

  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
  if (subsError) return NextResponse.json({ error: "db" }, { status: 500 })
  const rows: SubRow[] = subs ?? []
  if (rows.length === 0) {
    return NextResponse.json({ subscriptions: 0, usersSkipped: 0, sent: 0, gone: 0, failed: 0 })
  }

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)))
  const recorded = new Set<string>()
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200)
    const { data, error } = await admin
      .from("transactions")
      .select("user_id")
      .in("user_id", chunk)
      .or(`date.eq.${today},created_at.gte.${startIso}`)
    // ถ้าตรวจไม่ได้ ไม่ส่งอะไรเลย กันเตือนคนที่บันทึกแล้ว
    if (error) return NextResponse.json({ error: "db" }, { status: 500 })
    for (const t of data ?? []) recorded.add(t.user_id as string)
  }

  const targets = rows.filter((r) => !recorded.has(r.user_id))
  const usersSkipped = userIds.filter((id) => recorded.has(id)).length

  const payload = {
    title: "อย่าลืมบันทึกรายจ่ายวันนี้",
    body: "วันนี้ยังไม่มีรายการ กดเพื่อบันทึกด่วน",
    url: "/?quickadd=1",
    tag: "daily-reminder",
  }

  let sent = 0
  let gone = 0
  let failed = 0
  for (let i = 0; i < targets.length; i += 10) {
    const batch = targets.slice(i, i + 10)
    const results = await Promise.all(
      batch.map(async (t) => {
        const result = await sendPush(wp, t, payload)
        if (result === "gone") {
          const { error } = await admin
            .from("push_subscriptions")
            .delete()
            .eq("user_id", t.user_id)
            .eq("endpoint", t.endpoint)
          if (error) console.error("cron cleanup failed")
        }
        return result
      })
    )
    for (const r of results) {
      if (r === "ok") sent++
      else if (r === "gone") gone++
      else failed++
    }
  }

  return NextResponse.json({ subscriptions: rows.length, usersSkipped, sent, gone, failed })
}
