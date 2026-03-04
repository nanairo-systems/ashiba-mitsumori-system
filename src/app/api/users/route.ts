/**
 * [API] ユーザー管理
 *
 * GET  /api/users        - 全ユーザー一覧（ADMIN のみ）
 * POST /api/users        - 新規ユーザー作成（ADMIN のみ）
 *   Supabase Auth にアカウントを作成 → Prisma User レコードを作成
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1, "名前は必須です"),
  email: z.string().email("正しいメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上にしてください"),
  role: z.enum(["ADMIN", "STAFF", "DEVELOPER"]).default("STAFF"),
})

/** 管理者権限チェック */
async function requireAdmin(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (!dbUser || (dbUser.role !== "ADMIN" && dbUser.role !== "DEVELOPER")) return null
  return dbUser
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, email, password, role } = parsed.data

  // メール重複チェック
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "このメールアドレスはすでに使用されています" }, { status: 409 })
  }

  // Supabase Auth にユーザーを作成
  const supabaseAdmin = createAdminClient()
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // メール確認をスキップ（即ログイン可能）
  })

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message ?? "Supabase アカウントの作成に失敗しました" },
      { status: 500 }
    )
  }

  // Prisma に User レコードを作成
  try {
    const user = await prisma.user.create({
      data: {
        authId: authData.user.id,
        name,
        email,
        role,
        isActive: true,
      },
    })
    return NextResponse.json(user, { status: 201 })
  } catch (e) {
    // Prisma 作成失敗時は Supabase Auth のユーザーを削除してロールバック
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    console.error("Prisma user creation failed:", e)
    return NextResponse.json({ error: "ユーザーの作成に失敗しました" }, { status: 500 })
  }
}
