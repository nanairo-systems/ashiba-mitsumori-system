/**
 * [API] テンプレート - GET/POST /api/templates
 *
 * GET:  テンプレート一覧を取得（sections/groups/items含む）
 * POST: 見積（estimateId）の構造をそのままテンプレートとして保存する。
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const templates = await prisma.template.findMany({
    where: { isArchived: false },
    orderBy: { name: "asc" },
    include: {
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          groups: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
                include: { unit: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  })

  // Decimal → number 変換
  const serialized = templates.map((t) => ({
    ...t,
    sections: t.sections.map((sec) => ({
      ...sec,
      groups: sec.groups.map((grp) => ({
        ...grp,
        items: grp.items.map((item) => ({
          ...item,
          quantity: item.quantity instanceof Prisma.Decimal ? Number(item.quantity) : item.quantity,
          unitPrice: item.unitPrice instanceof Prisma.Decimal ? Number(item.unitPrice) : item.unitPrice,
        })),
      })),
    })),
  }))

  return NextResponse.json(serialized)
}

const schema = z.object({
  name: z.string().min(1, "テンプレート名は必須です"),
  description: z.string().optional().nullable(),
  estimateId: z.string().uuid(),
  estimateType: z.enum(["INITIAL", "ADDITIONAL", "BOTH"]).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, description, estimateId, estimateType } = parsed.data

  // 見積とその明細を取得
  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: {
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          groups: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
                include: { unit: true },
              },
            },
          },
        },
      },
    },
  })

  if (!estimate) {
    return NextResponse.json({ error: "見積が見つかりません" }, { status: 404 })
  }

  // テンプレートをトランザクションで一括作成
  const template = await prisma.$transaction(async (tx) => {
    const tmpl = await tx.template.create({
      data: {
        name,
        description: description ?? null,
        estimateType: estimateType ?? "BOTH",
      },
    })

    for (const sec of estimate.sections) {
      const tmplSec = await tx.templateSection.create({
        data: {
          templateId: tmpl.id,
          name: sec.name,
          sortOrder: sec.sortOrder,
        },
      })

      for (const grp of sec.groups) {
        const tmplGrp = await tx.templateGroup.create({
          data: {
            sectionId: tmplSec.id,
            name: grp.name,
            sortOrder: grp.sortOrder,
          },
        })

        for (const item of grp.items) {
          await tx.templateItem.create({
            data: {
              groupId: tmplGrp.id,
              name: item.name,
              quantity: item.quantity,
              unitId: item.unitId,
              unitPrice: item.unitPrice,
              sortOrder: item.sortOrder,
            },
          })
        }
      }
    }

    return tmpl
  })

  return NextResponse.json(template, { status: 201 })
}
