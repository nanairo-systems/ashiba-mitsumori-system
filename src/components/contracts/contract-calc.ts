/**
 * [UTIL] 契約処理 金額計算ユーティリティ
 *
 * 双方向の値引き ↔ 税抜金額計算を共通化する。
 */

/** 値引き / 税抜金額の双方向計算結果 */
export interface AdjustedAmountResult {
  /** 調整後の税抜金額 */
  adjustedTaxExcluded: number
  /** 実際の値引き額 */
  discount: number
  /** 消費税額 */
  tax: number
  /** 税込合計 */
  total: number
}

/**
 * 双方向の値引き ↔ 税抜金額を計算する。
 *
 * lastEdited === "discount" → discountStr から adjustedTaxExcluded を計算
 * lastEdited === "amount"   → taxExclStr から adjustedTaxExcluded を取得
 */
export function calcAdjustedAmount(params: {
  originalTaxExcluded: number
  discountStr: string
  taxExclStr: string
  lastEdited: "discount" | "amount"
  taxRate: number
}): AdjustedAmountResult {
  const { originalTaxExcluded, discountStr, taxExclStr, lastEdited, taxRate } = params

  let adjustedTaxExcluded: number
  if (lastEdited === "amount") {
    adjustedTaxExcluded = Math.max(0, parseInt(taxExclStr, 10) || 0)
  } else {
    const discount = Math.max(0, parseInt(discountStr, 10) || 0)
    adjustedTaxExcluded = originalTaxExcluded - discount
  }

  const tax = Math.floor(adjustedTaxExcluded * taxRate)
  const discount = originalTaxExcluded - adjustedTaxExcluded
  return { adjustedTaxExcluded, discount, tax, total: adjustedTaxExcluded + tax }
}
