/**
 * [PAGE] 新規見積作成ページ (/estimates/new)
 *
 * 現場を選択して見積を新規作成する。
 * テンプレートの選択も可能（任意）。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { NewEstimateForm } from "@/components/estimates/NewEstimateForm"

export default async function NewEstimatePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [projects, templates, companies, dbUser] = await Promise.all([
    prisma.project.findMany({
      where: { isArchived: false },
      include: {
        branch: { include: { company: true } },
        contact: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.template.findMany({
      where: { isArchived: false },
      orderBy: { name: "asc" },
    }),
    prisma.company.findMany({
      where: { isActive: true },
      include: {
        branches: { where: { isActive: true }, orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findUnique({ where: { authId: user.id } }),
  ])

  if (!dbUser) redirect("/login")

  return (
    <NewEstimateForm
      projects={projects}
      templates={templates}
      companies={companies}
      currentUser={dbUser}
    />
  )
}
