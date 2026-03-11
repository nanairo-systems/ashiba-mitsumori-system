/**
 * [COMPONENT] 削除確認ポップオーバー
 *
 * 削除ボタンの近くに小さな確認ポップアップを表示。
 * マウス移動を最小限に抑える。
 */
"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"

interface Props {
  /** 確認メッセージ（例: 「田中」を削除しますか？） */
  message: string
  /** 確認後の削除コールバック */
  onConfirm: () => void
  /** トリガーボタンのクラス名 */
  triggerClassName?: string
  /** × アイコンのクラス名 */
  iconClassName?: string
}

export function ConfirmDeletePopover({
  message,
  onConfirm,
  triggerClassName,
  iconClassName,
}: Props) {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()

  function handleConfirm() {
    setOpen(false)
    onConfirm()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true) }}
          className={triggerClassName}
          title="削除"
        >
          <X className={iconClassName ?? "w-3 h-3 text-slate-400 group-hover:text-red-500"} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className={isMobile ? "w-auto max-w-[240px] p-3 z-[100]" : "w-auto max-w-[200px] p-2.5 z-[100]"}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={isMobile ? "text-sm text-slate-700 mb-3 leading-relaxed" : "text-xs text-slate-700 mb-2 leading-relaxed"}>{message}</p>
        <div className="flex items-center gap-2 justify-end">
          <Button
            size="sm"
            variant="ghost"
            className={isMobile ? "h-10 px-4 text-sm" : "h-7 px-2 text-sm"}
            onClick={(e) => { e.stopPropagation(); setOpen(false) }}
          >
            戻る
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className={isMobile ? "h-10 px-4 text-sm" : "h-7 px-2 text-sm"}
            onClick={(e) => { e.stopPropagation(); handleConfirm() }}
          >
            削除
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
