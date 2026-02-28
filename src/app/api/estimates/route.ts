import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { formatEstimateNumber } from "@/lib/utils"

const createSchema = z.object({
  projectId: z.string(),
  templateId: z.string().optional(),
  note: z.string().optional(),
  discountAmount: z.number().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { projectId, templateId, note, discountAmount } = parsed.data

  // テンプレから見積明細をコピー
  let sectionsData: {
    name: string
    sortOrder: number
    groups: {
      name: string
      sortOrder: number
      items: {
        name: string
        quantity: number
        unitId: string
        unitPrice: number
        sortOrder: number
      }[]
    }[]
  }[] = []

  if (templateId) {
    const template = await prisma.template.findUnique({
      where: { id: templateId },
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
          include: {
            groups: {
              orderBy: { sortOrder: "asc" },
              include: {
                items: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
      },
    })

    if (template) {
      sectionsData = template.sections.map((sec) => ({
        name: sec.name,
        sortOrder: sec.sortOrder,
        groups: sec.groups.map((grp) => ({
          name: grp.name,
          sortOrder: grp.sortOrder,
          items: grp.items.map((item) => ({
            name: item.name,
            quantity: item.quantity ? Number(item.quantity) : 1,
            unitId: item.unitId,
            unitPrice: Number(item.unitPrice),
            sortOrder: item.sortOrder,
          })),
        })),
      }))
    }
  }

  const estimate = await prisma.estimate.create({
    data: {
      projectId,
      userId: dbUser.id,
      status: "DRAFT",
      note,
      discountAmount,
      sections: {
        create: sectionsData.map((sec) => ({
          name: sec.name,
          sortOrder: sec.sortOrder,
          groups: {
            create: sec.groups.map((grp) => ({
              name: grp.name,
              sortOrder: grp.sortOrder,
              items: {
                create: grp.items,
              },
            })),
          },
        })),
      },
    },
    include: {
      sections: {
        include: {
          groups: {
            include: { items: { include: { unit: true } } },
          },
        },
      },
    },
  })

  return NextResponse.json(estimate, { status: 201 })
}
