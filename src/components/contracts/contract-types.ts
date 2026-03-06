/**
 * [TYPES] 契約処理 共通型定義
 *
 * ContractProcessingDialog で使用する型をまとめる。
 * ProjectList / ProjectDetail の両方からインポートする。
 */

export type PaymentType = "FULL" | "TWO_PHASE" | "PROGRESS"

/** ダイアログに渡す見積アイテム */
export interface ContractEstimateItem {
  estimateId: string
  estimateName: string
  estimateNumber?: string | null
  projectId: string
  projectName: string
  companyName: string
  /** 税抜見積金額 */
  taxExcludedAmount: number
  /** 会社の税率（例: 0.1） */
  taxRate: number
}

/** 見積ごとのオーバーライド（individual モード用） */
export interface EstimateOverride {
  discountStr: string
  taxExclStr: string
  lastEdited: "discount" | "amount"
  paymentType: PaymentType
}

/** ContractProcessingDialog のプロパティ */
export interface ContractProcessingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 処理対象の見積一覧（1件以上） */
  items: ContractEstimateItem[]
  /**
   * 処理モード
   * - "individual": 見積ごとに個別の契約を作成（値引き・支払サイクル個別設定）
   * - "consolidated": 複数見積を1つの名前付き契約にまとめる
   */
  mode: "individual" | "consolidated"
  /** 契約作成成功後のコールバック */
  onCompleted: () => void
}
