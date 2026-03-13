/**
 * [PAGE] 経理システム - ETCアラート一覧
 */
import type { Metadata } from "next"

export const metadata: Metadata = { title: "ETCアラート" }

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { EtcAlertPage } from "@/components/accounting/etc/EtcAlertPage"

export default async function AlertsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return <EtcAlertPage />
}
