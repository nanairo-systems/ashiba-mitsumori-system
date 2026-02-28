import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { NewProjectForm } from "@/components/projects/NewProjectForm"

export default async function NewProjectPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [companies, dbUser] = await Promise.all([
    prisma.company.findMany({
      where: { isActive: true },
      include: {
        branches: { where: { isActive: true } },
        contacts: { where: { isActive: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findUnique({ where: { authId: user.id } }),
  ])

  if (!dbUser) redirect("/login")

  // Decimal を number に変換
  const serializedCompanies = companies.map((c) => ({
    ...c,
    taxRate: Number(c.taxRate),
  }))

  return <NewProjectForm companies={serializedCompanies} currentUser={dbUser} />
}
