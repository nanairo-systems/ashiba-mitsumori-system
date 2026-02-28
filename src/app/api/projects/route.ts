import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { generateShortProjectId } from "@/lib/utils"

const schema = z.object({
  companyId: z.string().optional(), // branchId があれば不要
  branchId: z.string(),
  contactId: z.string().optional(),
  name: z.string().min(1),
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

  const { branchId, contactId, name } = parsed.data

  // 表示用短IDの連番を計算
  const now = new Date()
  const yearMonth = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`
  const count = await prisma.project.count({
    where: {
      shortId: { startsWith: `P-${yearMonth}-` },
    },
  })
  const shortId = generateShortProjectId(now, count + 1)

  const project = await prisma.project.create({
    data: {
      shortId,
      branchId,
      contactId: contactId || null,
      name,
    },
  })

  return NextResponse.json(project, { status: 201 })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") ?? ""
  const archived = searchParams.get("archived") === "true"

  const projects = await prisma.project.findMany({
    where: {
      isArchived: archived,
      OR: search
        ? [
            { name: { contains: search, mode: "insensitive" } },
            { branch: { company: { name: { contains: search, mode: "insensitive" } } } },
          ]
        : undefined,
    },
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

  return NextResponse.json(projects)
}
