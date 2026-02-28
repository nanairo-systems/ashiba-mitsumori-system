import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, addDays, isWeekend } from "date-fns"
import { ja } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 日本語フォーマット */
export function formatDate(date: Date | string, fmt = "yyyy年MM月dd日") {
  return format(new Date(date), fmt, { locale: ja })
}

/** 金額フォーマット（カンマ区切り） */
export function formatCurrency(amount: number | string) {
  return Number(amount).toLocaleString("ja-JP")
}

/** 消費税計算（切り捨て） */
export function calcTax(subtotal: number, taxRate: number) {
  return Math.floor(subtotal * taxRate)
}

/**
 * 営業日 N 日後を計算（土日を除く）
 */
export function addBusinessDays(date: Date, days: number): Date {
  let count = 0
  let current = new Date(date)
  while (count < days) {
    current = addDays(current, 1)
    if (!isWeekend(current)) count++
  }
  return current
}

/** フォロー通知日時（営業日 3 日後の 17:00）*/
export function calcFollowUpAt(sentAt: Date): Date {
  const followDate = addBusinessDays(sentAt, 3)
  followDate.setHours(17, 0, 0, 0)
  return followDate
}

/** 見積番号生成（年月 + 連番） 例: 2402-003 */
export function formatEstimateNumber(date: Date, seq: number) {
  const ym = format(date, "yyMM")
  return `${ym}-${String(seq).padStart(3, "0")}`
}

/** 現場の表示用短ID 例: P-2402-001 */
export function generateShortProjectId(date: Date, seq: number) {
  const ym = format(date, "yyMM")
  return `P-${ym}-${String(seq).padStart(3, "0")}`
}
