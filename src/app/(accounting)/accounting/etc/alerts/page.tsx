/**
 * [PAGE] 経理システム - ETCアラート一覧
 */
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { EtcAlertPage } from "@/components/accounting/etc/EtcAlertPage"

export default async function AlertsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return <EtcAlertPage />
}
