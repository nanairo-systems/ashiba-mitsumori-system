/**
 * [API] 会社編集 - PATCH /api/companies/:id
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1, "会社名は必須です"),
  furigana: z.string().optional().nullable(),
  alias: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  taxRate: z.number().min(0).max(1).optional(),
  // 支払条件設定
  paymentClosingDay: z.number().int().min(1).max(31).optional().nullable(),
  paymentMonthOffset: z.number().int().min(1).max(6).optional(),
  paymentPayDay: z.number().int().min(1).max(31).optional().nullable(),
  paymentNetDays: z.number().int().min(1).max(365).optional().nullable(),
})

/** Zod エラーを人が読める文字列に変換 */
function zodErrorMessage(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join("、") || "入力内容に誤りがあります"
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
  }

  const company = await prisma.company.findUnique({ where: { id } })
  if (!company) return NextResponse.json({ error: "会社が見つかりません" }, { status: 404 })

  // 名前変更時の重複チェック
  if (parsed.data.name !== company.name) {
    const dup = await prisma.company.findFirst({ where: { name: parsed.data.name, isActive: true } })
    if (dup) {
      return NextResponse.json(
        { error: `「${parsed.data.name}」はすでに登録されています。会社名が重複しています。` },
        { status: 409 }
      )
    }
  }

  // 電話番号変更時の重複チェック
  if (parsed.data.phone && parsed.data.phone !== company.phone) {
    const dupPhone = await prisma.company.findFirst({
      where: { phone: parsed.data.phone, isActive: true, NOT: { id } },
    })
    if (dupPhone) {
      return NextResponse.json(
        { error: `電話番号「${parsed.data.phone}」はすでに「${dupPhone.name}」で登録されています。` },
        { status: 409 }
      )
    }
  }

  const d = parsed.data
  const updated = await prisma.company.update({
    where: { id },
    data: {
      name: d.name,
      furigana: d.furigana ?? null,
      alias: d.alias ?? null,
      phone: d.phone ?? null,
      ...(d.taxRate !== undefined ? { taxRate: d.taxRate } : {}),
      // 支払条件: undefined は「変更しない」、null は「クリア」
      ...(d.paymentClosingDay !== undefined  ? { paymentClosingDay:  d.paymentClosingDay  } : {}),
      ...(d.paymentMonthOffset !== undefined ? { paymentMonthOffset: d.paymentMonthOffset } : {}),
      ...(d.paymentPayDay !== undefined      ? { paymentPayDay:      d.paymentPayDay      } : {}),
      ...(d.paymentNetDays !== undefined     ? { paymentNetDays:     d.paymentNetDays     } : {}),
    },
  })

  return NextResponse.json(updated)
}
