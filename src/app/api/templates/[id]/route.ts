import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const patchSchema = z.object({
  estimateType: z.enum(["INITIAL", "ADDITIONAL", "BOTH"]).optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  isArchived: z.boolean().optional(),
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const template = await prisma.template.findUnique({ where: { id } })
  if (!template) {
    return NextResponse.json({ error: "テンプレートが見つかりません" }, { status: 404 })
  }

  const updated = await prisma.template.update({
    where: { id },
    data: {
      ...parsed.data,
      updatedAt: new Date(),
    },
  })

  return NextResponse.json(updated)
}
