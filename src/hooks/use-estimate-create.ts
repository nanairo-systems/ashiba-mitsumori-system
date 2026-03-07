/**
 * [HOOK] 見積作成の共通ロジック - useEstimateCreate
 *
 * 見積作成に必要な以下のロジックを一元管理:
 * - 一式テンプレートの検出
 * - ワンクリック見積作成（一式）
 * - 通常の見積作成（テンプレート指定）
 * - estimateType の自動判定（通常/追加）
 *
 * 使用箇所:
 * - ProjectDetail.tsx（現場詳細の見積追加）
 * - ProjectList.tsx（商談一覧の三点メニュー）
 * - NewEstimateForm.tsx（/estimates/new ページ）
 */
import { useState, useCallback } from "react"
import { toast } from "sonner"

// ─── 共通テンプレート型 ────────────────────────────────
export interface EstimateTemplate {
  id: string
  name: string
  description: string | null
  estimateType: "INITIAL" | "ADDITIONAL" | "BOTH"
  sections?: {
    id: string
    name: string
    groups: {
      id: string
      name: string
      items: {
        id: string
        name: string
        quantity: number
        unitPrice: number
        unit: { name: string } | null
      }[]
    }[]
  }[]
}

// ─── 一式テンプレート名（変更時にここだけ修正すればOK） ──
export const ISSIKI_TEMPLATE_NAME = "足場工事一式"

// ─── Hook ────────────────────────────────────────────

interface UseEstimateCreateOptions {
  templates: EstimateTemplate[]
  onCreated?: (estimateId: string) => void
}

export function useEstimateCreate({ templates, onCreated }: UseEstimateCreateOptions) {
  const [creating, setCreating] = useState(false)

  // 一式テンプレートを検出
  const issikiTemplate = templates.find((t) => t.name === ISSIKI_TEMPLATE_NAME) ?? null

  // estimateType を自動判定（既存見積数に基づく）
  const getEstimateType = useCallback((existingEstimateCount: number) => {
    return existingEstimateCount > 0 ? "ADDITIONAL" : "INITIAL"
  }, [])

  // テンプレートフィルタ（estimateType に応じてフィルタ）
  const getFilteredTemplates = useCallback(
    (estimateType: "INITIAL" | "ADDITIONAL") => {
      return templates.filter(
        (tpl) => tpl.estimateType === "BOTH" || tpl.estimateType === estimateType
      )
    },
    [templates]
  )

  // ── 見積作成API呼び出し（共通） ──
  const createEstimate = useCallback(
    async (params: {
      projectId: string
      templateId?: string
      title?: string
      estimateType?: "INITIAL" | "ADDITIONAL"
      note?: string
    }) => {
      setCreating(true)
      try {
        const res = await fetch("/api/estimates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: params.projectId,
            templateId: params.templateId || undefined,
            title: params.title?.trim() || null,
            estimateType: params.estimateType ?? "INITIAL",
            note: params.note || undefined,
          }),
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        onCreated?.(data.id)
        return data.id as string
      } catch {
        toast.error("見積の作成に失敗しました")
        return null
      } finally {
        setCreating(false)
      }
    },
    [onCreated]
  )

  // ── 一式クイック作成 ──
  const quickCreate = useCallback(
    async (projectId: string, existingEstimateCount: number) => {
      if (!issikiTemplate) {
        toast.error("一式テンプレートが見つかりません")
        return null
      }
      const type = getEstimateType(existingEstimateCount)
      const id = await createEstimate({
        projectId,
        templateId: issikiTemplate.id,
        estimateType: type,
      })
      if (id) {
        toast.success("一式見積りを作成しました。金額を入力してください。")
      }
      return id
    },
    [issikiTemplate, getEstimateType, createEstimate]
  )

  return {
    creating,
    issikiTemplate,
    getEstimateType,
    getFilteredTemplates,
    createEstimate,
    quickCreate,
  }
}
