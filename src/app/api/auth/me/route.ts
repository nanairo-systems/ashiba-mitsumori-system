/**
 * [API] 現在のユーザー情報を取得 - GET /api/auth/me
 */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
    select: { id: true, name: true },
  })

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

  return NextResponse.json(dbUser)
}
