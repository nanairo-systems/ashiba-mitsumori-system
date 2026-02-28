/**
 * [API] 契約ステータス更新 - PATCH /api/contracts/:id
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  status: z.enum(["CONTRACTED", "COMPLETED", "CANCELLED"]),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  const contract = await prisma.contract.findUnique({ where: { id } })
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.contract.update({
    where: { id },
    data: { status: parsed.data.status, updatedAt: new Date() },
  })

  return NextResponse.json(updated)
}
