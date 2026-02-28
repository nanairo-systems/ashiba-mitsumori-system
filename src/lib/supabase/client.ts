/**
 * [LIB] Supabase ブラウザ側クライアント
 *
 * Client Components（"use client"）で使用。
 * ログイン・ログアウトなどのブラウザ上の認証操作に利用。
 */
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
