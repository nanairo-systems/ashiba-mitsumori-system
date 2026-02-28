/**
 * [API] 現場アーカイブ - PATCH /api/projects/:id/archive
 *
 * 現場を失注としてアーカイブする。
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.project.update({
    where: { id },
    data: { isArchived: true, archivedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
