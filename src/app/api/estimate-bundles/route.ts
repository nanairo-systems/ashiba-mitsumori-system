/**
 * [API] 見積セット一覧・作成 - GET/POST /api/estimate-bundles
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  projectId: z.string(),
  estimateIds: z.array(z.string()).min(1, "見積を1件以上選択してください"),
  title: z.string().optional(),
  note: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get("projectId")
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 })

  const bundles = await prisma.estimateBundle.findMany({
    where: { projectId },
    include: {
      items: {
        include: {
          estimate: {
            select: {
              id: true, estimateNumber: true, title: true, status: true,
              estimateType: true,
              discountAmount: true,
              sections: {
                include: { groups: { include: { items: true } } },
              },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serialized = bundles.map((b: any) => ({
    id: b.id,
    bundleNumber: b.bundleNumber,
    title: b.title,
    note: b.note,
    createdAt: b.createdAt.toISOString(),
    estimateCount: b.items.length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: b.items.map((bi: any) => {
      let subtotal = 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const sec of bi.estimate.sections) for (const grp of sec.groups) for (const item of grp.items) subtotal += Number(item.quantity) * Number(item.unitPrice)
      const discount = bi.estimate.discountAmount ? Number(bi.estimate.discountAmount) : 0
      return {
        id: bi.id,
        estimateId: bi.estimateId,
        estimateNumber: bi.estimate.estimateNumber,
        title: bi.estimate.title,
        status: bi.estimate.status,
        estimateType: bi.estimate.estimateType,
        subtotal,
        discountAmount: discount,
      }
    }),
  }))

  return NextResponse.json(serialized)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
  }

  const { projectId, estimateIds, title, note } = parsed.data

  // 番号生成
  const now = new Date()
  const prefix = `B-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`
  const last = await prisma.estimateBundle.findFirst({
    where: { bundleNumber: { startsWith: prefix } },
    orderBy: { bundleNumber: "desc" },
  })
  const seq = last?.bundleNumber
    ? parseInt(last.bundleNumber.split("-")[2] || "0", 10) + 1
    : 1
  const bundleNumber = `${prefix}-${String(seq).padStart(3, "0")}`

  try {
    const bundle = await prisma.estimateBundle.create({
      data: {
        projectId,
        bundleNumber,
        title: title || null,
        note: note || null,
        items: {
          create: estimateIds.map((eid, i) => ({
            estimateId: eid,
            sortOrder: i,
          })),
        },
      },
    })

    return NextResponse.json({ id: bundle.id, bundleNumber: bundle.bundleNumber })
  } catch (err) {
    console.error("[estimate-bundles POST] Error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
