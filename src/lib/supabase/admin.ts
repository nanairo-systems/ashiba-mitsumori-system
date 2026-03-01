/**
 * [LIB] Supabase 管理者クライアント
 *
 * Service Role Key を使用するため、サーバーサイド（API Route）でのみ使用。
 * ユーザーの作成・削除など管理操作に使う。
 */
import { createClient } from "@supabase/supabase-js"

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
