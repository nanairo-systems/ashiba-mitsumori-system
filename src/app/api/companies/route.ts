import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1, "会社名は必須です"),
  furigana: z.string().optional(),
  alias: z.string().optional(),
  phone: z.string().optional(),
  taxRate: z.number().min(0).max(1).default(0.1),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // 会社名重複チェック
  const existing = await prisma.company.findUnique({
    where: { name: parsed.data.name },
  })
  if (existing) {
    return NextResponse.json(
      { error: "同じ会社名がすでに存在します" },
      { status: 409 }
    )
  }

  const company = await prisma.company.create({ data: parsed.data })
  return NextResponse.json(company, { status: 201 })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const companies = await prisma.company.findMany({
    where: { isActive: true },
    include: {
      branches: { where: { isActive: true } },
      contacts: { where: { isActive: true } },
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(companies)
}
