import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1, "会社名は必須です"),
  furigana: z.string().nullable().optional(),
  alias: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  taxRate: z.number().min(0).max(1).default(0.1),
  paymentClosingDay: z.number().nullable().optional(),
  paymentMonthOffset: z.number().optional(),
  paymentPayDay: z.number().nullable().optional(),
  paymentNetDays: z.number().nullable().optional(),
})

/** Zod エラーを人が読める文字列に変換 */
function zodErrorMessage(err: z.ZodError): string {
  const msgs = err.issues.map((i) => i.message)
  return msgs.join("、") || "入力内容に誤りがあります"
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
  }

  const { name, phone } = parsed.data

  // 会社名 重複チェック
  const sameName = await prisma.company.findFirst({
    where: { name, isActive: true },
  })
  if (sameName) {
    return NextResponse.json(
      { error: `「${name}」はすでに登録されています。会社名が重複しています。` },
      { status: 409 }
    )
  }

  // 電話番号 重複チェック（電話番号がある場合のみ）
  if (phone) {
    const samePhone = await prisma.company.findFirst({
      where: { phone, isActive: true },
    })
    if (samePhone) {
      return NextResponse.json(
        { error: `電話番号「${phone}」はすでに「${samePhone.name}」で登録されています。` },
        { status: 409 }
      )
    }
  }

  // 会社と「本社」支店をトランザクションで同時作成
  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({ data: parsed.data })
    await tx.branch.create({
      data: { companyId: created.id, name: "本社" },
    })
    return created
  })
  return NextResponse.json(company, { status: 201 })
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

  const companies = await prisma.company.findMany({
    where: { isActive: true },
    include: {
      branches: { where: { isActive: true } },
      contacts: { where: { isActive: true } },
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(companies)
}
