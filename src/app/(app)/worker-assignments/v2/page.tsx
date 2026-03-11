/**
 * [PAGE] 人員配置管理 V2 (/worker-assignments/v2)
 *
 * 新デザインシステム対応の人員配置管理画面。
 * 開発用モックデータで動作する独立版。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { WorkerAssignmentV2 } from "@/components/worker-assignments/WorkerAssignmentV2"

export default async function WorkerAssignmentsV2Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (!dbUser) redirect("/login")
  if (dbUser.role !== "ADMIN" && dbUser.role !== "DEVELOPER") redirect("/")

  return <WorkerAssignmentV2 />
}
