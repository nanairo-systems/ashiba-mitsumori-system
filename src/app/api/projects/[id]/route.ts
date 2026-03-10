/**
 * [API] 現場詳細 - GET/PATCH /api/projects/:id
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const [project, dbUser, templates, units, estimateBundles] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
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
        estimates: {
          orderBy: [{ estimateType: "asc" }, { createdAt: "asc" }],
          include: {
            user: { select: { id: true, name: true } },
            contract: { select: { id: true, status: true } },
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
        },
      },
    }),
    prisma.user.findUnique({ where: { authId: user.id } }),
    prisma.template.findMany({
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
    }),
    prisma.unit.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.estimateBundle.findMany({
      where: { projectId: id },
      include: {
        items: {
          include: {
            estimate: {
              select: { id: true, estimateNumber: true, title: true },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  if (!project || !dbUser) {
    return NextResponse.json({ error: "現場が見つかりません" }, { status: 404 })
  }

  const contacts = project.branch.company.contacts.map((c) => ({
    id: c.id, name: c.name, phone: c.phone ?? "", email: c.email ?? "",
  }))

  const serializedProject = {
    ...project,
    branch: {
      ...project.branch,
      company: {
        id: project.branch.company.id,
        name: project.branch.company.name,
        taxRate: Number(project.branch.company.taxRate),
      },
    },
    contact: project.contact
      ? { id: project.contact.id, name: project.contact.name, phone: project.contact.phone ?? "", email: project.contact.email ?? "" }
      : null,
    estimates: project.estimates.map((est) => ({
      ...est,
      discountAmount: est.discountAmount ? Number(est.discountAmount) : null,
      contract: est.contract ? { id: est.contract.id, status: est.contract.status } : null,
      sections: est.sections.map((sec) => ({
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
    })),
  }

  const serializedTemplates = templates.map((tpl) => ({
    ...tpl,
    sections: tpl.sections.map((sec) => ({
      ...sec,
      groups: sec.groups.map((grp) => ({
        ...grp,
        items: grp.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity ?? 1),
          unitPrice: Number(item.unitPrice),
        })),
      })),
    })),
  }))

  const taxRate = Number(project.branch.company.taxRate)

  const serializedBundles = estimateBundles.map((b) => ({
    id: b.id,
    bundleNumber: b.bundleNumber,
    title: b.title,
    createdAt: b.createdAt.toISOString(),
    items: b.items.map((bi) => ({
      estimateId: bi.estimateId,
      estimateNumber: bi.estimate.estimateNumber,
      title: bi.estimate.title,
    })),
  }))

  return NextResponse.json({
    project: serializedProject,
    templates: serializedTemplates,
    currentUser: dbUser,
    contacts,
    units,
    taxRate,
    estimateBundles: serializedBundles,
  })
}

const patchSchema = z.object({
  name: z.string().min(1, "現場名は必須です").optional(),
  address: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("、")
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: "現場が見つかりません" }, { status: 404 })

  const updateData: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.address !== undefined) updateData.address = parsed.data.address
  if (parsed.data.contactId !== undefined) updateData.contactId = parsed.data.contactId
  if (parsed.data.startDate !== undefined) {
    updateData.startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null
  }
  if (parsed.data.endDate !== undefined) {
    updateData.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null
  }

  const updated = await prisma.project.update({ where: { id }, data: updateData })
  return NextResponse.json(updated)
}
