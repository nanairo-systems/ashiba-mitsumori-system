/**
 * [COMPONENT] テンプレート管理 - TemplateList
 *
 * テンプレートの一覧表示と詳細のアコーディオン展開。
 * 将来的にはテンプレートの作成・編集機能を追加予定。
 */
"use client"

import { useState } from "react"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  LayoutTemplate,
  ChevronDown,
  ChevronRight,
  Tag,
} from "lucide-react"

interface TemplateItem {
  name: string
  quantity: unknown
  unitPrice: unknown
  unit: { name: string }
}

interface Props {
  templates: {
    id: string
    name: string
    description: string | null
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
  }[]
}

export function TemplateList({ templates }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
                    <div className="flex-1">
                      <CardTitle className="text-base">{tpl.name}</CardTitle>
                      {tpl.description && (
                        <p className="text-sm text-slate-500 mt-0.5">
                          {tpl.description}
                        </p>
                      )}
                    </div>
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
