/**
 * [PAGE] UIサンプル - ボタン・角丸・影・グラデーション・チェックボックス等
 */
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { UiSamplesPage } from "@/components/accounting/ui-samples/UiSamplesPage"

export default async function UiSamplesPageRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return <UiSamplesPage />
}
