/**
 * [COMPONENT] レスポンシブダイアログ
 *
 * スマホ（768px未満）では下からスライドする Drawer、
 * PCでは従来の中央モーダル Dialog を自動切替する。
 * 各ダイアログで Dialog→ResponsiveDialog に差し替えるだけで対応完了。
 */
"use client"

import type { ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** DialogContent に渡す className（PC用） */
  className?: string
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
  className,
}: Props) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh] flex flex-col">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-base">{title}</DrawerTitle>
          </DrawerHeader>
          {/* overflow-y-auto は各ダイアログ内の scroll に任せる（二重スクロール防止） */}
          <div className="flex-1 min-h-0 px-4 pb-2 flex flex-col">
            {children}
          </div>
          {footer && (
            <DrawerFooter className="flex-row gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {footer}
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
