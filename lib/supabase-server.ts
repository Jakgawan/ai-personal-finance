import { createServerClient } from "@supabase/ssr"
import type { NextRequest } from "next/server"
import type { User } from "@supabase/supabase-js"

export async function getAuthUser(req: NextRequest): Promise<User | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        // setAll is a no-op: route handlers here only need to read the
        // session to check auth, they don't return a response that can
        // carry refreshed cookies back to the browser
        setAll() {},
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}
