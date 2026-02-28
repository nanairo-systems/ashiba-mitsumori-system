/**
 * [API] 支店 CRUD (/api/branches)
 *
 * POST: 新規支店登録
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const schema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(1, "支店名は必須です"),
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

  const branch = await prisma.branch.create({ data: parsed.data })
  return NextResponse.json(branch, { status: 201 })
}
