/**
 * [API] 見積 詳細・更新 (/api/estimates/:id)
 *
 * PATCH: 見積の内容を全て保存（明細・備考・値引き）
 *   - DRAFT のみ直接上書き保存
 *   - CONFIRMED / SENT は 改訂API (/revise) を使うこと
 *
 * 保存するデータ構造:
 * {
 *   note?: string
 *   discountAmount?: number
 *   validDays?: number
 *   sections: [
 *     {
 *       id?: string   // 既存セクションはIDあり、新規はなし
 *       name: string
 *       sortOrder: number
 *       groups: [
 *         {
 *           id?: string
 *           name: string
 *           sortOrder: number
 *           items: [
 *             {
 *               id?: string
 *               name: string
 *               quantity: number
 *               unitId: string
 *               unitPrice: number
 *               sortOrder: number
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

// ─── バリデーションスキーマ ───────────────────────────────

const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "項目名は必須です"),
  quantity: z.number().min(0),
  unitId: z.string().min(1, "単位は必須です"),
  unitPrice: z.number().min(0),
  sortOrder: z.number().int(),
})

const groupSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "グループ名は必須です"),
  sortOrder: z.number().int(),
  items: z.array(itemSchema),
})

const sectionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "セクション名は必須です"),
  sortOrder: z.number().int(),
  groups: z.array(groupSchema),
})

const patchSchema = z.object({
  note: z.string().optional().nullable(),
  discountAmount: z.number().optional().nullable(),
  validDays: z.number().int().optional(),
  sections: z.array(sectionSchema),
})

// ─── GET ハンドラー ─────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const [estimate, units] = await Promise.all([
    prisma.estimate.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            branch: {
              include: {
                company: {
                  include: {
                    contacts: { where: { isActive: true }, orderBy: { name: "asc" } },
                  },
                },
              },
            },
            contact: true,
          },
        },
        user: { select: { id: true, name: true } },
        sections: {
          orderBy: { sortOrder: "asc" },
          include: {
            groups: {
              orderBy: { sortOrder: "asc" },
              include: {
                items: {
                  orderBy: { sortOrder: "asc" },
                  include: { unit: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
      },
    }),
    prisma.unit.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ])

  if (!estimate) {
    return NextResponse.json({ error: "見積が見つかりません" }, { status: 404 })
  }

  const taxRate = Number(estimate.project.branch.company.taxRate)
  const contacts = estimate.project.branch.company.contacts.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? "",
    email: c.email ?? "",
  }))

  const serialized = {
    ...estimate,
    discountAmount: estimate.discountAmount ? Number(estimate.discountAmount) : null,
    project: {
      id: estimate.project.id,
      shortId: estimate.project.shortId,
      name: estimate.project.name,
      address: estimate.project.address,
      startDate: estimate.project.startDate,
      endDate: estimate.project.endDate,
      branch: { name: estimate.project.branch.name, company: { name: estimate.project.branch.company.name } },
      contact: estimate.project.contact
        ? { id: estimate.project.contact.id, name: estimate.project.contact.name }
        : null,
    },
    sections: estimate.sections.map((sec) => ({
      ...sec,
      groups: sec.groups.map((grp) => ({
        ...grp,
        items: grp.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      })),
    })),
  }

  return NextResponse.json({ estimate: serialized, taxRate, units, contacts })
}

// ─── PATCH ハンドラー ────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: {
      sections: {
        include: {
          groups: { include: { items: true } },
        },
      },
    },
  })

  if (!estimate) {
    return NextResponse.json({ error: "見積が見つかりません" }, { status: 404 })
  }

  // DRAFT のみ直接編集可。それ以外は /revise で改訂版を作ること
  if (estimate.status !== "DRAFT") {
    return NextResponse.json(
      { error: "下書き状態の見積のみ直接編集できます。確定・送付済の場合は改訂版を作成してください。" },
      { status: 400 }
    )
  }

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { note, discountAmount, validDays, sections } = parsed.data

  // ── トランザクションで全削除→再作成（シンプルで確実な方法）──
  await prisma.$transaction(async (tx) => {
    // 既存の明細を全削除
    for (const sec of estimate.sections) {
      for (const grp of sec.groups) {
        await tx.estimateItem.deleteMany({ where: { groupId: grp.id } })
      }
      await tx.estimateGroup.deleteMany({ where: { sectionId: sec.id } })
    }
    await tx.estimateSection.deleteMany({ where: { estimateId: id } })

    // 見積本体の更新（備考・値引き・有効期限）
    await tx.estimate.update({
      where: { id },
      data: {
        note: note ?? null,
        discountAmount: discountAmount ?? null,
        validDays: validDays ?? estimate.validDays,
        updatedAt: new Date(),
      },
    })

    // セクション・グループ・明細を再作成
    for (const sec of sections) {
      const newSec = await tx.estimateSection.create({
        data: {
          estimateId: id,
          name: sec.name,
          sortOrder: sec.sortOrder,
        },
      })

      for (const grp of sec.groups) {
        const newGrp = await tx.estimateGroup.create({
          data: {
            sectionId: newSec.id,
            name: grp.name,
            sortOrder: grp.sortOrder,
          },
        })

        if (grp.items.length > 0) {
          await tx.estimateItem.createMany({
            data: grp.items.map((item) => ({
              groupId: newGrp.id,
              name: item.name,
              quantity: item.quantity,
              unitId: item.unitId,
              unitPrice: item.unitPrice,
              sortOrder: item.sortOrder,
            })),
          })
        }
      }
    }
  })

  // 保存後の最新データを返す
  const updated = await prisma.estimate.findUnique({
    where: { id },
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

  return NextResponse.json(updated)
}
