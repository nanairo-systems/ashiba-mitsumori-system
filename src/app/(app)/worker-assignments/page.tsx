/**
 * [PAGE] 人員配置管理 (/worker-assignments)
 *
 * 班ごとの作業員配置をカレンダー形式で管理する。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { WorkerAssignmentView } from "@/components/worker-assignments/WorkerAssignmentView"

export default async function WorkerAssignmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (!dbUser) redirect("/login")
  if (dbUser.role !== "ADMIN" && dbUser.role !== "DEVELOPER") redirect("/")

  return <WorkerAssignmentView />
}
