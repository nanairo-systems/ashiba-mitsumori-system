import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const schema = z.object({
  companyId: z.string(),
  name: z.string().min(1),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
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

  const contact = await prisma.contact.create({ data: parsed.data })
  return NextResponse.json(contact, { status: 201 })
}
