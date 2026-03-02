/**
 * [COMPONENT] テンプレート管理 - TemplateList
 *
 * テンプレートの一覧表示と詳細のアコーディオン展開。
 * 各テンプレートの見積種別（当初/追加/両方）を表示・切り替え可能。
 */
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  LayoutTemplate,
  ChevronDown,
  ChevronRight,
  Tag,
  FilePlus2,
  Wrench,
  Layers,
} from "lucide-react"
import { toast } from "sonner"
import type { TemplateEstimateType } from "@prisma/client"

interface TemplateItem {
  name: string
  quantity: unknown
  unitPrice: unknown
  unit: { name: string }
}

interface TemplateData {
  id: string
  name: string
  description: string | null
  estimateType: TemplateEstimateType
  templateTags: { tag: { name: string } }[]
  sections: {
    id: string
    name: string
    groups: {
      id: string
      name: string
      items: TemplateItem[]
    }[]
  }[]
}

interface Props {
  templates: TemplateData[]
}

const TYPE_CONFIG: Record<TemplateEstimateType, { label: string; shortLabel: string; className: string; icon: typeof FilePlus2 }> = {
  INITIAL:    { label: "当初見積用",   shortLabel: "当初", className: "bg-blue-100 text-blue-700 border-blue-200",    icon: FilePlus2 },
  ADDITIONAL: { label: "追加見積用",   shortLabel: "追加", className: "bg-amber-100 text-amber-700 border-amber-200",  icon: Wrench },
  BOTH:       { label: "両方で使用",   shortLabel: "両方", className: "bg-slate-100 text-slate-700 border-slate-200",  icon: Layers },
}

export function TemplateList({ templates }: Props) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function handleChangeType(templateId: string, newType: TemplateEstimateType) {
    setUpdatingId(templateId)
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateType: newType }),
      })
      if (!res.ok) throw new Error("更新失敗")
      toast.success(`種別を「${TYPE_CONFIG[newType].label}」に変更しました`)
      router.refresh()
    } catch {
      toast.error("種別の変更に失敗しました")
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">テンプレ管理</h1>
          <p className="text-sm text-slate-500 mt-1">
            見積作成時に使うテンプレートを管理します
          </p>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <LayoutTemplate className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">テンプレートがまだありません</p>
            <p className="text-sm text-slate-400 mt-1">
              マスター管理画面から作成できます
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => {
            const isExpanded = expandedId === tpl.id
            const typeConf = TYPE_CONFIG[tpl.estimateType]
            const isUpdating = updatingId === tpl.id

            return (
              <Card key={tpl.id}>
                <CardHeader
                  className="cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : tpl.id)
                  }
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">{tpl.name}</CardTitle>
                      {tpl.description && (
                        <p className="text-sm text-slate-500 mt-0.5">
                          {tpl.description}
                        </p>
                      )}
                    </div>
                    {/* 種別バッジ */}
                    <Badge variant="outline" className={`text-xs font-bold ${typeConf.className}`}>
                      <typeConf.icon className="w-3 h-3 mr-1" />
                      {typeConf.shortLabel}
                    </Badge>
                    <div className="flex gap-1">
                      {tpl.templateTags.map(({ tag }) => (
                        <Badge
                          key={tag.name}
                          variant="secondary"
                          className="text-xs"
                        >
                          <Tag className="w-3 h-3 mr-1" />
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                    <Badge variant="outline">
                      {tpl.sections.length}セクション
                    </Badge>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="pt-0">
                    {/* 種別切り替えUI */}
                    <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-xs font-medium text-slate-500 mb-2">対象の見積種別</p>
                      <div className="flex gap-2">
                        {(["INITIAL", "ADDITIONAL", "BOTH"] as TemplateEstimateType[]).map((t) => {
                          const conf = TYPE_CONFIG[t]
                          const isActive = tpl.estimateType === t
                          return (
                            <Button
                              key={t}
                              variant={isActive ? "default" : "outline"}
                              size="sm"
                              disabled={isUpdating}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (!isActive) handleChangeType(tpl.id, t)
                              }}
                              className={isActive
                                ? "bg-slate-800 text-white hover:bg-slate-700"
                                : ""}
                            >
                              <conf.icon className="w-3.5 h-3.5 mr-1.5" />
                              {conf.label}
                            </Button>
                          )
                        })}
                      </div>
                    </div>

                    {/* テンプレート内容プレビュー */}
                    {tpl.sections.map((sec) => (
                      <div key={sec.id} className="mb-4 last:mb-0">
                        <h3 className="font-medium text-sm text-slate-700 mb-2 border-b border-slate-100 pb-1">
                          {sec.name}
                        </h3>
                        {sec.groups.map((grp) => (
                          <div key={grp.id} className="ml-4 mb-3">
                            <p className="text-xs text-slate-500 mb-1 font-medium">
                              {grp.name}
                            </p>
                            <div className="space-y-1">
                              {grp.items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-4 text-sm text-slate-600 pl-2"
                                >
                                  <span className="flex-1">
                                    {item.name}
                                  </span>
                                  <span className="text-slate-400 w-16 text-right">
                                    {item.unit.name}
                                  </span>
                                  <span className="font-mono w-24 text-right">
                                    ¥{formatCurrency(Number(item.unitPrice))}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
