/**
 * [COMPONENT] 職人バッジ（四角型）
 *
 * コンパクトな四角形バッジ。名前2文字を表示。
 * - 職長: ゴールド下線
 * - 自社社員: 緑
 * - 一人親方: 黄
 * - 協力会社: 白（グレー枠）
 * - 免許バッジ: 右上に表示（2t/4t/6t/MAX）
 */
"use client"

import { cn } from "@/lib/utils"

const BADGE_COLORS: Record<string, {
  bg: string
  text: string
  border: string
}> = {
  EMPLOYEE: {
    bg: "#16a34a",
    text: "#ffffff",
    border: "#15803d",
  },
  INDEPENDENT: {
    bg: "#ca8a04",
    text: "#1a1a1a",
    border: "#a16207",
  },
  SUBCONTRACTOR: {
    bg: "#ffffff",
    text: "#374151",
    border: "#d1d5db",
  },
}

const LICENSE_LABELS: Record<string, string> = {
  NONE: "",
  SMALL: "2t",
  MEDIUM: "4t",
  SEMI_LARGE: "6t",
  LARGE: "MAX",
}

interface Props {
  name: string
  isForeman: boolean
  workerType: string
  driverLicenseType?: string
  className?: string
  /** ダイアログ内用の大きいサイズ */
  size?: "sm" | "md"
}

export function HelmetBadge({ name, isForeman, workerType, driverLicenseType, className, size = "sm" }: Props) {
  const shortName = name.slice(0, 2)
  const colors = BADGE_COLORS[workerType] ?? BADGE_COLORS.SUBCONTRACTOR
  const licenseLabel = LICENSE_LABELS[driverLicenseType ?? "NONE"] ?? ""

  const isMd = size === "md"

  return (
    <div
      className={cn("relative inline-flex flex-col items-center", className)}
      title={`${name}${isForeman ? "（職長）" : ""}`}
    >
      {/* 免許バッジ（右上） */}
      {licenseLabel && (
        <span
          className={cn(
            "absolute z-10 font-bold leading-none rounded-sm",
            isMd
              ? "-top-1.5 -right-2.5 px-1.5 py-0.5 text-[9px] border-2"
              : "-top-1.5 -right-2 px-1 py-0.5 text-[8px] border"
          )}
          style={{
            backgroundColor: "#1e40af",
            color: "#ffffff",
            borderColor: "#1e3a8a",
          }}
        >
          {licenseLabel}
        </span>
      )}

      {/* カード本体 */}
      <div
        className={cn(
          "rounded-sm border-2 flex items-center justify-center font-extrabold leading-none",
          isMd ? "w-9 h-[24px] text-xs" : "w-8 h-[22px] text-[10px]"
        )}
        style={{
          backgroundColor: colors.bg,
          color: colors.text,
          borderColor: colors.border,
        }}
      >
        {shortName}
      </div>

      {/* 職長バッジ */}
      {isForeman && (
        <span
          className={cn(
            "font-black leading-none mt-[-1px] rounded-sm",
            isMd ? "text-[8px] px-1 py-0.5" : "text-[7px] px-0.5 py-[0.5px]"
          )}
          style={{
            backgroundColor: "#d97706",
            color: "#ffffff",
          }}
        >
          長
        </span>
      )}
    </div>
  )
}
