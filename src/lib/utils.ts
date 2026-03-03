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
import { format, addDays, isWeekend, differenceInCalendarDays } from "date-fns"
import { ja } from "date-fns/locale"

/** Tailwind CSS クラス結合 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 日本語日付フォーマット（デフォルト: yyyy年MM月dd日） */
export function formatDate(date: Date | string, fmt = "yyyy年MM月dd日") {
  return format(new Date(date), fmt, { locale: ja })
}

/**
 * 相対日付フォーマット
 * 今日 → "今日"、昨日 → "昨日"、2〜6日前 → "○日前"、
 * 7〜29日前 → "○週間前"、30日以上 → "M/d" フォールバック
 * title属性用の絶対日付も返す
 */
export function formatRelativeDate(date: Date | string): { label: string; absolute: string } {
  const d = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const diff = differenceInCalendarDays(today, target)
  const absolute = format(d, "yyyy/MM/dd", { locale: ja })

  if (diff === 0) return { label: "今日", absolute }
  if (diff === 1) return { label: "昨日", absolute }
  if (diff >= 2 && diff <= 6) return { label: `${diff}日前`, absolute }
  if (diff >= 7 && diff <= 29) return { label: `${Math.floor(diff / 7)}週間前`, absolute }
  // 30日以上前 or 未来日はM/d表示
  return { label: format(d, "M/d", { locale: ja }), absolute }
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

/**
 * 会社の支払条件設定から表示文字列を生成
 *
 * 例:
 *   null, 1, null, null → "末締め 翌月末払い"
 *   null, 1, 25, null   → "末締め 翌月25日払い"
 *   20, 1, null, null   → "20日締め 翌月末払い"
 *   null, 2, null, null → "末締め 翌々月末払い"
 *   null, 1, null, 45   → "末締め 45日払い"
 */
export function formatCompanyPaymentTerms(params: {
  paymentClosingDay: number | null
  paymentMonthOffset: number
  paymentPayDay: number | null
  paymentNetDays: number | null
}): string {
  const { paymentClosingDay, paymentMonthOffset, paymentPayDay, paymentNetDays } = params
  const closing = paymentClosingDay == null ? "末" : `${paymentClosingDay}日`

  if (paymentNetDays != null) {
    return `${closing}締め ${paymentNetDays}日払い`
  }

  const month =
    paymentMonthOffset === 1 ? "翌月" :
    paymentMonthOffset === 2 ? "翌々月" :
    `翌${paymentMonthOffset}ヶ月後`

  const payDay = paymentPayDay == null ? "末" : `${paymentPayDay}日`
  return `${closing}締め ${month}${payDay}払い`
}
