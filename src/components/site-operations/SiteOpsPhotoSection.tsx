/**
 * [現操-05] 写真添付セクション
 *
 * 図面・安全書類・その他の写真アップロード・表示・削除。
 * projectId を渡して使う。他ページからも再利用可能。
 */
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ImagePlus, Camera, Trash2, Loader2, X, ZoomIn } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Dialog, DialogContent } from "@/components/ui/dialog"

// ─── 画像リサイズ・圧縮ユーティリティ ───────────────────
const MAX_DIMENSION = 1920
const JPEG_QUALITY = 0.8

/** Canvas APIで画像を長辺1920pxにリサイズし、JPEG 0.8で圧縮 */
function resizeImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    // HEIC/HEIFはブラウザのCanvas非対応の場合があるのでそのまま返す
    if (file.type === "image/heic" || file.type === "image/heif") {
      resolve(file)
      return
    }

    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      // リサイズ不要（既に小さい場合）
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        // サイズは小さいがJPEG圧縮だけ適用
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return }
            // 圧縮後のほうが大きくなった場合は元ファイルを使う
            if (blob.size >= file.size) { resolve(file); return }
            const ext = file.type === "image/png" ? ".png" : ".jpg"
            const name = file.name.replace(/\.[^.]+$/, ext)
            resolve(new File([blob], name, { type: blob.type }))
          },
          file.type === "image/png" ? "image/png" : "image/jpeg",
          file.type === "image/png" ? undefined : JPEG_QUALITY
        )
        return
      }

      // 長辺を1920pxに縮小
      if (width > height) {
        height = Math.round(height * (MAX_DIMENSION / width))
        width = MAX_DIMENSION
      } else {
        width = Math.round(width * (MAX_DIMENSION / height))
        height = MAX_DIMENSION
      }

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          const name = file.name.replace(/\.[^.]+$/, ".jpg")
          resolve(new File([blob], name, { type: "image/jpeg" }))
        },
        "image/jpeg",
        JPEG_QUALITY
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("画像の読み込みに失敗しました"))
    }

    img.src = url
  })
}

const PHOTO_TABS = [
  { key: "blueprint", label: "図面" },
  { key: "safety", label: "安全書類" },
  { key: "other", label: "その他" },
] as const

type PhotoTab = typeof PHOTO_TABS[number]["key"]

interface SitePhoto {
  id: string
  projectId: string
  category: string
  fileName: string
  storagePath: string
  mimeType: string
  fileSize: number
  createdAt: string
  url: string | null
}

interface SiteOpsPhotoSectionProps {
  projectId: string
  /** コンパクトモード（V2の右パネル用） */
  compact?: boolean
}

export function SiteOpsPhotoSection({ projectId, compact }: SiteOpsPhotoSectionProps) {
  const [activeTab, setActiveTab] = useState<PhotoTab>("blueprint")
  const [photos, setPhotos] = useState<SitePhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [previewPhoto, setPreviewPhoto] = useState<SitePhoto | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchPhotos = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/photos`)
      if (!res.ok) throw new Error()
      setPhotos(await res.json())
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  const filteredPhotos = photos.filter((p) => p.category === activeTab)

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return

    setUploading(true)
    let successCount = 0

    for (const file of Array.from(files)) {
      try {
        // リサイズ・圧縮
        const resized = await resizeImage(file)

        const formData = new FormData()
        formData.append("file", resized)
        formData.append("category", activeTab)

        const res = await fetch(`/api/projects/${projectId}/photos`, {
          method: "POST",
          body: formData,
        })
        if (!res.ok) {
          const data = await res.json()
          toast.error(data.error || "アップロードに失敗しました")
          continue
        }
        successCount++
      } catch {
        toast.error(`${file.name} のアップロードに失敗しました`)
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount}枚の画像をアップロードしました`)
      await fetchPhotos()
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleDelete(photoId: string) {
    if (!confirm("この画像を削除しますか？")) return
    setDeletingId(photoId)
    try {
      const res = await fetch(`/api/projects/${projectId}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      })
      if (!res.ok) throw new Error()
      toast.success("画像を削除しました")
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
      if (previewPhoto?.id === photoId) setPreviewPhoto(null)
    } catch {
      toast.error("削除に失敗しました")
    } finally {
      setDeletingId(null)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    handleUpload(e.dataTransfer.files)
  }

  const tabCounts = {
    blueprint: photos.filter((p) => p.category === "blueprint").length,
    safety: photos.filter((p) => p.category === "safety").length,
    other: photos.filter((p) => p.category === "other").length,
  }

  return (
    <div className="space-y-3">
      {/* セクションヘッダー */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <Camera className="w-3.5 h-3.5" />
        <span>画像登録</span>
      </div>

      {/* タブ切替 */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
        {PHOTO_TABS.map((tab) => (
          <button
            key={tab.key}
            className={cn(
              "flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-colors flex items-center justify-center gap-1",
              activeTab === tab.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tabCounts[tab.key] > 0 && (
              <span className={cn(
                "text-xs px-1.5 py-0 rounded-full font-bold min-w-[18px] text-center",
                activeTab === tab.key ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"
              )}>
                {tabCounts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 写真グリッド */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {filteredPhotos.length > 0 && (
            <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-4")}>
              {filteredPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                >
                  {photo.url ? (
                    <img
                      src={photo.url}
                      alt={photo.fileName}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setPreviewPhoto(photo)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImagePlus className="w-6 h-6" />
                    </div>
                  )}
                  {/* オーバーレイ */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    {photo.url && (
                      <button
                        onClick={() => setPreviewPhoto(photo)}
                        className="w-8 h-8 rounded-full bg-white/90 text-slate-700 flex items-center justify-center hover:bg-white transition-colors shadow"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(photo.id)}
                      disabled={deletingId === photo.id}
                      className="w-8 h-8 rounded-full bg-white/90 text-red-500 flex items-center justify-center hover:bg-red-50 transition-colors shadow"
                    >
                      {deletingId === photo.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />
                      }
                    </button>
                  </div>
                  {/* ファイル名ラベル */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-0.5">
                    <p className="text-white text-[10px] truncate">{photo.fileName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* アップロードエリア */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors",
              "border-slate-200 hover:border-blue-400 hover:bg-blue-50/30",
              uploading && "pointer-events-none opacity-50",
              filteredPhotos.length > 0 ? "p-3" : "p-6"
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                <p className="text-xs text-blue-500 font-medium">アップロード中...</p>
              </>
            ) : (
              <>
                <ImagePlus className={cn("text-slate-300", filteredPhotos.length > 0 ? "w-5 h-5" : "w-8 h-8")} />
                <p className="text-xs text-slate-500 font-medium">
                  クリックまたはドラッグ&ドロップで画像を追加
                </p>
                <p className="text-[10px] text-slate-400">
                  JPEG, PNG, WebP, HEIC（10MB以下）
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>
        </>
      )}

      {/* 画像プレビューダイアログ */}
      <Dialog open={!!previewPhoto} onOpenChange={(o) => !o && setPreviewPhoto(null)}>
        <DialogContent className="sm:max-w-3xl p-0 bg-black/95 border-none">
          {previewPhoto?.url && (
            <div className="relative">
              <button
                onClick={() => setPreviewPhoto(null)}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/40 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={previewPhoto.url}
                alt={previewPhoto.fileName}
                className="w-full max-h-[80vh] object-contain"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-4 py-2 flex items-center justify-between">
                <span className="text-white text-sm truncate">{previewPhoto.fileName}</span>
                <button
                  onClick={() => handleDelete(previewPhoto.id)}
                  disabled={deletingId === previewPhoto.id}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-red-500/80 text-white hover:bg-red-600 transition-colors"
                >
                  {deletingId === previewPhoto.id ? "削除中..." : "削除"}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
