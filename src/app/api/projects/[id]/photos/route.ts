/**
 * [API] 現場写真 GET/POST/DELETE /api/projects/[id]/photos
 *
 * GET: プロジェクトの写真一覧（署名付きURL付き）
 * POST: 画像アップロード（Supabase Storage）
 * DELETE: 画像削除（Storage + DB）
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"

const BUCKET_NAME = "site-photos"
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]

type RouteContext = { params: Promise<{ id: string }> }

/** GET: 写真一覧取得 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  const { id: projectId } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // カテゴリフィルター
  const category = req.nextUrl.searchParams.get("category")

  const where: { projectId: string; category?: string } = { projectId }
  if (category) where.category = category

  const photos = await prisma.sitePhoto.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  // 署名付きURLを生成（1時間有効）
  const photosWithUrls = await Promise.all(
    photos.map(async (photo) => {
      const { data } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(photo.storagePath, 3600)
      return {
        ...photo,
        url: data?.signedUrl ?? null,
      }
    })
  )

  return NextResponse.json(photosWithUrls)
}

/** POST: 画像アップロード */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: projectId } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  const category = (formData.get("category") as string) || "other"
  if (!file) {
    return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "画像ファイル（JPEG, PNG, WebP, HEIC）のみアップロード可能です" }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "ファイルサイズは10MB以下にしてください" }, { status: 400 })
  }

  // 保存パス: sites/{projectId}/{category}/{uuid}.{ext}
  const ext = file.name.split(".").pop() || "jpg"
  const fileName = `${randomUUID()}.${ext}`
  const storagePath = `sites/${projectId}/${category}/${fileName}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json(
      { error: `アップロードに失敗しました: ${uploadError.message}` },
      { status: 500 }
    )
  }

  // DBに記録
  const photo = await prisma.sitePhoto.create({
    data: {
      projectId,
      category,
      fileName: file.name,
      storagePath,
      mimeType: file.type,
      fileSize: file.size,
    },
  })

  // 署名付きURL
  const { data: urlData } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, 3600)

  return NextResponse.json({
    ...photo,
    url: urlData?.signedUrl ?? null,
  }, { status: 201 })
}

/** DELETE: 画像削除 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { id: projectId } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { photoId } = await req.json().catch(() => ({ photoId: null }))
  if (!photoId) {
    return NextResponse.json({ error: "photoId が必要です" }, { status: 400 })
  }

  const photo = await prisma.sitePhoto.findFirst({
    where: { id: photoId, projectId },
  })
  if (!photo) {
    return NextResponse.json({ error: "写真が見つかりません" }, { status: 404 })
  }

  // Storageから削除
  await supabase.storage.from(BUCKET_NAME).remove([photo.storagePath])

  // DBから削除
  await prisma.sitePhoto.delete({ where: { id: photoId } })

  return NextResponse.json({ success: true })
}
