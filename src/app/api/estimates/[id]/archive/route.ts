import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

/** 下書きを手動アーカイブ（失注フラグ）*/
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const estimate = await prisma.estimate.findUnique({ where: { id } })
  if (!estimate) {
    return NextResponse.json({ error: "見積が見つかりません" }, { status: 404 })
  }

  await prisma.estimate.update({
    where: { id },
    data: { isArchived: true, archivedAt: new Date() },
  })

  return NextResponse.json({ success: true })
}

/** アーカイブ解除 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  await prisma.estimate.update({
    where: { id },
    data: { isArchived: false, archivedAt: null },
  })

  return NextResponse.json({ success: true })
}
