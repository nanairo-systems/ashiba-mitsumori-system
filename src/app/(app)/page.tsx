import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ProjectList } from "@/components/projects/ProjectList"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
  })

  if (!dbUser) redirect("/login")

  const projects = await prisma.project.findMany({
    where: { isArchived: false },
    include: {
      branch: { include: { company: true } },
      contact: true,
      estimates: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  return <ProjectList projects={projects} currentUser={dbUser} />
}
