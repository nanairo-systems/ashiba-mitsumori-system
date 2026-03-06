/**
 * [CONSTANTS] 契約処理 共通定数
 */
import type { PaymentType } from "./contract-types"

/** 支払サイクル選択肢（フル説明付き） */
export const PAYMENT_TYPE_OPTIONS: readonly {
  value: PaymentType
  label: string
  description: string
}[] = [
  { value: "FULL", label: "一括支払い", description: "完工後に一括で請求" },
  { value: "TWO_PHASE", label: "2回払い（組立・解体）", description: "組立完了時と解体完了時の2回" },
  { value: "PROGRESS", label: "出来高払い", description: "進捗に応じて都度請求" },
] as const

/** 支払サイクル短縮表示 */
export const PAYMENT_TYPE_SHORT: Record<PaymentType, string> = {
  FULL: "一括",
  TWO_PHASE: "2回払い",
  PROGRESS: "出来高",
}
