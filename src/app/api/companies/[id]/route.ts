/**
 * [API] 会社編集 - PATCH /api/companies/:id
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1, "会社名は必須です"),
  furigana: z.string().optional().nullable(),
  alias: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  taxRate: z.number().min(0).max(1).optional(),
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
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const company = await prisma.company.findUnique({ where: { id } })
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // 名前変更時の重複チェック
  if (parsed.data.name !== company.name) {
    const dup = await prisma.company.findUnique({ where: { name: parsed.data.name } })
    if (dup) {
      return NextResponse.json({ error: "同じ会社名がすでに存在します" }, { status: 409 })
    }
  }

  const updated = await prisma.company.update({
    where: { id },
    data: {
      name: parsed.data.name,
      furigana: parsed.data.furigana ?? null,
      alias: parsed.data.alias ?? null,
      phone: parsed.data.phone ?? null,
      ...(parsed.data.taxRate !== undefined ? { taxRate: parsed.data.taxRate } : {}),
    },
  })

  return NextResponse.json(updated)
}
