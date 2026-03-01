import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { generateShortProjectId } from "@/lib/utils"

const schema = z.object({
  companyId: z.string().optional(),
  branchId: z.string().min(1, "支店IDが必要です"),
  contactId: z.string().optional(),
  name: z.string().min(1, "現場名を入力してください"),
  address: z.string().nullable().optional(),
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
    const msg = parsed.error.issues.map((i) => i.message).join("、") || "入力内容に誤りがあります"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { branchId, contactId, name, address } = parsed.data

  // 表示用短IDの連番を計算（既存の最大番号 + 1）
  const now = new Date()
  const yearMonth = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`
  const prefix = `P-${yearMonth}-`

  const latest = await prisma.project.findFirst({
    where: { shortId: { startsWith: prefix } },
    orderBy: { shortId: "desc" },
    select: { shortId: true },
  })

  let seq = 1
  if (latest?.shortId) {
    const num = parseInt(latest.shortId.slice(prefix.length), 10)
    if (!isNaN(num)) seq = num + 1
  }
  const shortId = generateShortProjectId(now, seq)

  try {
    const project = await prisma.project.create({
      data: {
        shortId,
        branchId,
        contactId: contactId || null,
        name,
        address: address || null,
      },
    })
    return NextResponse.json(project, { status: 201 })
  } catch (err) {
    console.error("[POST /api/projects] Prisma error:", err)
    const msg = err instanceof Error ? err.message : "現場の登録に失敗しました"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
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
