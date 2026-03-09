/**
 * [API] 経理 - PDFアップロード POST /api/accounting/upload
 *
 * PDFファイルをSupabase Storage（accounting-documents）にアップロード。
 * 保存パス: invoices/{year}/{month}/{uuid}.pdf
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { randomUUID } from "crypto"

const BUCKET_NAME = "accounting-documents"
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME = "application/pdf"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  if (!file) {
    return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 })
  }

  // ファイル形式チェック
  if (file.type !== ALLOWED_MIME) {
    return NextResponse.json({ error: "PDFファイルのみアップロード可能です" }, { status: 400 })
  }

  // ファイルサイズチェック
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "ファイルサイズは10MB以下にしてください" }, { status: 400 })
  }

  // 保存パス生成: invoices/{year}/{month}/{uuid}.pdf
  const now = new Date()
  const year = now.getFullYear().toString()
  const month = (now.getMonth() + 1).toString().padStart(2, "0")
  const fileName = `${randomUUID()}.pdf`
  const filePath = `invoices/${year}/${month}/${fileName}`

  // Supabase Storageにアップロード
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, {
      contentType: ALLOWED_MIME,
      upsert: false,
    })

  if (error) {
    return NextResponse.json(
      { error: `アップロードに失敗しました: ${error.message}` },
      { status: 500 }
    )
  }

  // 署名付きURLを生成（1時間有効）
  const { data: urlData } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(data.path, 3600)

  return NextResponse.json({
    path: data.path,
    url: urlData?.signedUrl ?? null,
  }, { status: 201 })
}
