/**
 * [PAGE] 経理システム - 銀行入出金管理
 */
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { BankDashboard } from "@/components/accounting/bank/BankDashboard"

export default async function BankPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return <BankDashboard />
}
