/**
 * [API] 請求 GET/PATCH/DELETE - /api/invoices/:id
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  invoiceType: z.enum(["FULL", "ASSEMBLY", "DISASSEMBLY", "PROGRESS"]).optional(),
  amount: z.number().nonnegative().optional(),
  taxAmount: z.number().nonnegative().optional(),
  totalAmount: z.number().positive().optional(),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(["DRAFT", "SENT", "PAID", "PARTIAL_PAID"]).optional(),
  paidAmount: z.number().nonnegative().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      contract: {
        include: {
          project: {
            include: {
              branch: { include: { company: true } },
              contact: true,
            },
          },
          estimate: {
            include: {
              user: { select: { id: true, name: true } },
              sections: {
                orderBy: { sortOrder: "asc" },
                include: {
                  groups: {
                    orderBy: { sortOrder: "asc" },
                    include: {
                      items: { orderBy: { sortOrder: "asc" }, include: { unit: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(invoice)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updateData: Record<string, unknown> = {}
  const d = parsed.data
  if (d.invoiceType !== undefined) updateData.invoiceType = d.invoiceType
  if (d.amount !== undefined) updateData.amount = d.amount
  if (d.taxAmount !== undefined) updateData.taxAmount = d.taxAmount
  if (d.totalAmount !== undefined) updateData.totalAmount = d.totalAmount
  if (d.invoiceDate !== undefined) updateData.invoiceDate = new Date(d.invoiceDate)
  if (d.dueDate !== undefined) updateData.dueDate = d.dueDate ? new Date(d.dueDate) : null
  if (d.status !== undefined) updateData.status = d.status
  if (d.paidAmount !== undefined) updateData.paidAmount = d.paidAmount
  if (d.paidAt !== undefined) updateData.paidAt = d.paidAt ? new Date(d.paidAt) : null
  if (d.notes !== undefined) updateData.notes = d.notes

  const updated = await prisma.invoice.update({ where: { id }, data: updateData })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.invoice.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
