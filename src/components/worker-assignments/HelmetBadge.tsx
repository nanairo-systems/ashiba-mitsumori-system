/**
 * [COMPONENT] ヘルメット型職人バッジ
 *
 * コンパクトなヘルメット形状のバッジ。名前2文字を表示。
 * - 職長: 2本線、職人: 1本線（名前の下、つばの上）
 * - 自社社員: 緑ヘルメット
 * - 一人親方: 黄ヘルメット
 * - 協力会社: 白ヘルメット（グレー枠）
 * - 免許バッジ: 右上に表示（2t/4t/6t/MAX）
 */
"use client"

import { cn } from "@/lib/utils"

const HELMET_COLORS: Record<string, {
  bg: string
  fgBg: string
  text: string
  line: string
  brim: string
  border: string
}> = {
  EMPLOYEE: {
    bg: "#22c55e",
    fgBg: "#16a34a",
    text: "#ffffff",
    line: "rgba(255,255,255,0.7)",
    brim: "#16a34a",
    border: "none",
  },
  INDEPENDENT: {
    bg: "#eab308",
    fgBg: "#ca8a04",
    text: "#1a1a1a",
    line: "rgba(0,0,0,0.25)",
    brim: "#ca8a04",
    border: "none",
  },
  SUBCONTRACTOR: {
    bg: "#ffffff",
    fgBg: "#ffffff",
    text: "#374151",
    line: "rgba(0,0,0,0.15)",
    brim: "#9ca3af",
    border: "1.5px solid #d1d5db",
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
}

export function HelmetBadge({ name, isForeman, workerType, driverLicenseType, className }: Props) {
  const shortName = name.slice(0, 2)
  const colors = HELMET_COLORS[workerType] ?? HELMET_COLORS.SUBCONTRACTOR
  const helmetBg = isForeman ? colors.bg : colors.fgBg
  const licenseLabel = LICENSE_LABELS[driverLicenseType ?? "NONE"] ?? ""

  return (
    <div
      className={cn("relative inline-flex flex-col items-center", className)}
      title={`${name}${isForeman ? "（職長）" : ""}`}
    >
      {/* 免許バッジ（右上） */}
      {licenseLabel && (
        <span
          className="absolute -top-1.5 -right-2 z-10 px-0.5 py-px rounded text-[5px] font-bold leading-none border"
          style={{
            backgroundColor: "#1e40af",
            color: "#ffffff",
            borderColor: "#1e3a8a",
          }}
        >
          {licenseLabel}
        </span>
      )}

      {/* ヘルメット本体 */}
      <div
        className="w-7 h-[18px] rounded-t-lg rounded-b-none flex items-center justify-center text-[8px] font-bold leading-none"
        style={{
          backgroundColor: helmetBg,
          color: colors.text,
          border: colors.border,
          borderBottom: "none",
        }}
      >
        {shortName}
      </div>
      {/* 役割線（職長: 2本線、職人: 1本線）— 名前の下、つばの上 */}
      <div
        className="w-7 flex flex-col items-center gap-[0.5px] py-[0.5px]"
        style={{
          backgroundColor: helmetBg,
          borderLeft: colors.border,
          borderRight: colors.border,
        }}
      >
        <div
          className="h-[1.5px] rounded-full"
          style={{ width: isForeman ? 14 : 8, backgroundColor: colors.line }}
        />
        {isForeman && (
          <div
            className="h-[1.5px] w-[14px] rounded-full"
            style={{ backgroundColor: colors.line }}
          />
        )}
      </div>
      {/* つば（brim） */}
      <div
        className="w-8 h-[2px] rounded-sm"
        style={{ backgroundColor: colors.brim }}
      />
    </div>
  )
}
