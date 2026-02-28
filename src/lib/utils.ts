/**
 * [LIB] ユーティリティ関数集
 *
 * プロジェクト全体で使う汎用的なヘルパー関数。
 * - cn(): Tailwind CSS クラス結合（clsx + tailwind-merge）
 * - formatDate(): 日付フォーマット（date-fns / 日本語ロケール）
 * - formatCurrency(): 金額カンマ区切り
 * - calcTax(): 消費税計算（切り捨て）
 * - addBusinessDays(): 営業日計算（土日除外）
 * - calcFollowUpAt(): フォロー通知日時（営業日3日後17:00）
 * - formatEstimateNumber(): 見積番号生成（年月+連番）
 * - generateShortProjectId(): 現場短ID生成
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, addDays, isWeekend } from "date-fns"
import { ja } from "date-fns/locale"

/** Tailwind CSS クラス結合 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 日本語日付フォーマット（デフォルト: yyyy年MM月dd日） */
export function formatDate(date: Date | string, fmt = "yyyy年MM月dd日") {
  return format(new Date(date), fmt, { locale: ja })
}

/** 金額をカンマ区切りにフォーマット */
export function formatCurrency(amount: number | string) {
  return Number(amount).toLocaleString("ja-JP")
}

/** 消費税計算（切り捨て） */
export function calcTax(subtotal: number, taxRate: number) {
  return Math.floor(subtotal * taxRate)
}

/** 営業日 N 日後を計算（土日を除外） */
export function addBusinessDays(date: Date, days: number): Date {
  let count = 0
  let current = new Date(date)
  while (count < days) {
    current = addDays(current, 1)
    if (!isWeekend(current)) count++
  }
  return current
}

/** フォロー通知日時を算出（営業日 3 日後の 17:00） */
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
