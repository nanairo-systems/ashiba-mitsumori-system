/**
 * [PAGE] 経理システム - ガソリンアラート一覧
 */
import type { Metadata } from "next"

export const metadata: Metadata = { title: "ガソリンアラート" }

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { FuelAlertPage } from "@/components/accounting/fuel/FuelAlertPage"

export default async function FuelAlertsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return <FuelAlertPage />
}
