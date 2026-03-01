/**
 * [API] 外注先マスター - GET/POST /api/subcontractors
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1, "会社名は必須です"),
  furigana: z.string().nullable().optional(),
  representative: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email("メール形式が不正です").nullable().optional(),
  bankInfo: z.string().nullable().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const subcontractors = await prisma.subcontractor.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(subcontractors)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("、")
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const d = parsed.data
  const sub = await prisma.subcontractor.create({
    data: {
      name: d.name,
      furigana: d.furigana ?? null,
      representative: d.representative ?? null,
      address: d.address ?? null,
      phone: d.phone ?? null,
      email: d.email ?? null,
      bankInfo: d.bankInfo ?? null,
    },
  })

  return NextResponse.json(sub, { status: 201 })
}
