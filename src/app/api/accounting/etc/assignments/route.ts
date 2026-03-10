import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  driverId: z.string().min(1),
  cardId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  note: z.string().optional(),
})

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const cardId = searchParams.get("cardId")
  const driverId = searchParams.get("driverId")

  try {
    const assignments = await prisma.etcDriverAssignment.findMany({
      where: {
        ...(cardId ? { cardId } : {}),
        ...(driverId ? { driverId } : {}),
      },
      include: {
        driver: {
          include: {
            department: { include: { company: true } },
            store: true,
          },
        },
        card: {
          include: { vehicle: true },
        },
      },
      orderBy: { startDate: "desc" },
    })
    return NextResponse.json(assignments)
  } catch {
    // EtcDriverAssignmentテーブルがDB未適用の場合
    return NextResponse.json([])
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    // 既存の終了日なしの配車を終了させる
    if (!parsed.data.endDate) {
      const existing = await prisma.etcDriverAssignment.findFirst({
        where: {
          cardId: parsed.data.cardId,
          endDate: null,
        },
      })
      if (existing) {
        await prisma.etcDriverAssignment.update({
          where: { id: existing.id },
          data: { endDate: new Date(parsed.data.startDate) },
        })
      }
    }

    const assignment = await prisma.etcDriverAssignment.create({
      data: {
        driverId: parsed.data.driverId,
        cardId: parsed.data.cardId,
        startDate: new Date(parsed.data.startDate),
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        note: parsed.data.note,
      },
      include: {
        driver: {
          include: {
            department: { include: { company: true } },
            store: true,
          },
        },
        card: { include: { vehicle: true } },
      },
    })

    // カードの現在のドライバーも更新
    if (!parsed.data.endDate) {
      await prisma.etcCard.update({
        where: { id: parsed.data.cardId },
        data: { driverId: parsed.data.driverId },
      })
    }

    return NextResponse.json(assignment, { status: 201 })
  } catch (e) {
    // テーブル未作成の場合
    return NextResponse.json(
      { error: "配車履歴テーブルが未作成です。DDLを適用してください。" },
      { status: 500 }
    )
  }
}
