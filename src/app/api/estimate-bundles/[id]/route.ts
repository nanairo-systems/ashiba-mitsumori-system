/**
 * [API] 見積セット詳細・削除 - GET/DELETE /api/estimate-bundles/:id
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const bundle = await prisma.estimateBundle.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          branch: { include: { company: true } },
          contact: true,
        },
      },
      items: {
        include: {
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
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(bundle)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await prisma.estimateBundle.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
