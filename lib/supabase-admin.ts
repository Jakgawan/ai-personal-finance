import { createClient } from "@supabase/supabase-js"

// ข้าม RLS (ใช้ service role key) — ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น
// ใช้เฉพาะใน cron route ห้าม import จาก client component เด็ดขาด
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
