/**
 * [API] 請求 GET/POST - /api/invoices
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { format } from "date-fns"

const createSchema = z.object({
  contractId: z.string().uuid(),
  invoiceType: z.enum(["FULL", "ASSEMBLY", "DISASSEMBLY", "PROGRESS"]),
  amount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  totalAmount: z.number().positive(),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

async function generateInvoiceNumber(): Promise<string> {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const prefix = `INV-${yy}${mm}-`

  const latest = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  })

  let seq = 1
  if (latest?.invoiceNumber) {
    const num = parseInt(latest.invoiceNumber.slice(prefix.length), 10)
    if (!isNaN(num)) seq = num + 1
  }
  return `${prefix}${String(seq).padStart(3, "0")}`
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const invoices = await prisma.invoice.findMany({
    include: {
      contract: {
        include: {
          project: {
            include: {
              branch: { include: { company: { select: { id: true, name: true } } } },
            },
          },
          estimate: { select: { user: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: { invoiceDate: "desc" },
  })

  return NextResponse.json(invoices)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("、")
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const d = parsed.data
  const contract = await prisma.contract.findUnique({ where: { id: d.contractId } })
  if (!contract) return NextResponse.json({ error: "契約が見つかりません" }, { status: 404 })

  const invoiceNumber = await generateInvoiceNumber()

  const invoice = await prisma.invoice.create({
    data: {
      contractId: d.contractId,
      invoiceNumber,
      invoiceType: d.invoiceType,
      amount: d.amount,
      taxAmount: d.taxAmount,
      totalAmount: d.totalAmount,
      invoiceDate: new Date(d.invoiceDate),
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      notes: d.notes ?? null,
      status: "DRAFT",
    },
  })

  return NextResponse.json(invoice, { status: 201 })
}
