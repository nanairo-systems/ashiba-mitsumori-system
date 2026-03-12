/**
 * [COMPONENT] 現場詳細 モバイルビュー - ProjectDetailMobile
 *
 * モバイル端末用の表示レイアウト。
 * 共有ロジックは ProjectDetail.tsx から props 経由で受け取る。
 */
"use client"

import { formatDate, formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Plus,
  FileText,
  Building2,
  MapPin,
  User,
  Zap,
  CheckSquare,
  Square,
  Pencil,
  Printer,
  Layers,
  HandshakeIcon,
  ClipboardList,
  Trash2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import type { ProjectDetailViewProps } from "./ProjectDetail"

export function ProjectDetailMobile(props: ProjectDetailViewProps) {
  const {
    project,
    estimateBundles,
    embedded,
    selectedEstimateId,
    guardedAction,
    openDialog,
    handleQuickCreateEstimate,
    creating,
    issikiTemplate,
    checkedEstimateIds,
    toggleCheck,
    setCheckedEstimateIds,
    checkableEstimates,
    setBulkContractOpen,
    handleBulkPrint,
    handleCreateBundle,
    handleDeleteBundle,
    openEdit,
    router,
    statusConfig,
    contractStatusConfig,
    calcTotal,
    isCheckable,
    isContractable,
    onSelectEstimateProp,
    isMobile,
  } = props

  return (
    <>
      {/* ヘッダー */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => guardedAction(() => router.push("/"))} className="h-9 px-3 text-sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            戻る
          </Button>
          <div className="flex-1" />
          {issikiTemplate && (
            <Button size="sm" variant="outline" onClick={() => guardedAction(handleQuickCreateEstimate)} disabled={creating} className="h-9 px-3 text-sm">
              <Zap className="w-4 h-4 mr-1" />
              一式で作成
            </Button>
          )}
          <Button size="sm" onClick={() => guardedAction(openDialog)} className="h-9 px-4 text-sm font-semibold">
            <Plus className="w-4 h-4 mr-1" />
            見積追加
          </Button>
        </div>
        <div className="px-1">
          <h1 className="text-xl font-bold text-slate-900 leading-tight">{project.name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {project.branch.company.name}
            {project.branch.name !== "本社" && ` / ${project.branch.name}`}
          </p>
        </div>
      </div>

      {/* 現場情報カード */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">現場情報</span>
          <button onClick={() => openEdit("name")} className="text-xs text-blue-500 hover:text-blue-700 transition-colors flex items-center gap-1 font-medium">
            <Pencil className="w-3.5 h-3.5" />
            編集
          </button>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-slate-700">
          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="font-medium">{project.branch.company.name}{project.branch.name !== "本社" && ` / ${project.branch.name}`}</span>
        </div>
        {project.address && (
          <div className="flex items-center gap-2.5 text-sm text-slate-700">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{project.address}</span>
          </div>
        )}
        {project.contact && (
          <div className="flex items-center gap-2.5 text-sm text-slate-700">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{project.contact.name}</span>
            {project.contact.phone && <span className="text-slate-600 text-sm">/ {project.contact.phone}</span>}
          </div>
        )}
      </div>

      {/* 見積一覧 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" />
            <span className="text-base font-bold text-slate-700">見積一覧</span>
            <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">{project.estimates.length}件</span>
          </div>
          {checkableEstimates.length > 0 && checkedEstimateIds.size > 0 && (
            <span className="text-xs text-green-600 font-semibold">{checkedEstimateIds.size}件選択</span>
          )}
        </div>
        {project.estimates.length === 0 ? (
          <div className="text-center py-10 text-slate-600">
            <p className="text-sm">見積がまだありません</p>
            <Button variant="outline" size="sm" className="mt-3 h-9 text-sm px-4" onClick={openDialog}>
              <Plus className="w-4 h-4 mr-1" />
              作成
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {project.estimates.map((est, idx) => {
              const { label, className: statusClass } = est.contract
                ? contractStatusConfig[est.contract.status]
                : statusConfig[est.status]
              const total = calcTotal(est.sections)
              const displayTitle = est.title ?? (project.estimates.length === 1 ? "見積" : `見積 ${idx + 1}`)
              const checkable = isCheckable(est)
              const isChecked = checkedEstimateIds.has(est.id)
              const isSelected = selectedEstimateId === est.id
              const isOld = est.status === "OLD"
              const selectFn = embedded && onSelectEstimateProp ? onSelectEstimateProp : (id: string) => router.push(`/estimates/${id}`)

              return (
                <div
                  key={est.id}
                  className={`rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${
                    isSelected ? "border-blue-400 bg-blue-50 shadow-sm" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  } ${isOld ? "opacity-50" : ""} ${isChecked ? "bg-green-50/60 border-green-300" : ""}`}
                  onClick={() => guardedAction(() => selectFn(est.id))}
                >
                  <div className="flex items-center gap-2.5">
                    {checkable && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCheck(est.id) }}
                        className={`w-7 h-7 shrink-0 rounded flex items-center justify-center transition-colors ${isChecked ? "text-green-600" : "text-slate-300 hover:text-slate-500"}`}
                      >
                        {isChecked ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                      </button>
                    )}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold shrink-0 ${statusClass}`}>
                      {label}
                    </span>
                    <span className="text-sm font-semibold text-slate-800 truncate flex-1">{displayTitle}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 ml-0">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      {est.estimateType === "ADDITIONAL" && <span className="text-amber-500 font-semibold">追加</span>}
                      <span>{est.user.name}</span>
                      <span>{formatDate(est.createdAt, "MM/dd")}</span>
                      {est.confirmedAt && <span className="text-green-600 font-medium">確定: {formatDate(est.confirmedAt, "MM/dd")}</span>}
                    </div>
                    <span className="font-mono text-base font-bold text-slate-900 shrink-0">¥{formatCurrency(total)}</span>
                  </div>
                </div>
              )
            })}

            {project.estimates.length > 1 && (
              <div className="flex justify-between items-center px-4 py-3 rounded-xl bg-slate-800 text-white">
                <span className="text-sm font-bold">合計（税抜）</span>
                <span className="font-mono text-lg font-bold">
                  ¥{formatCurrency(project.estimates.reduce((s, e) => s + calcTotal(e.sections), 0))}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 提出履歴 */}
      {estimateBundles.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              提出履歴
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {estimateBundles.map((bundle) => (
              <div key={bundle.id} className="border rounded-lg p-3 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-semibold text-slate-700">
                      {bundle.bundleNumber ?? "---"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(bundle.createdAt).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => window.open(`/estimate-bundles/${bundle.id}/print`, "_blank")}
                    >
                      <Printer className="w-3.5 h-3.5 mr-1" />
                      再印刷
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-500 hover:text-red-700"
                      onClick={() => handleDeleteBundle(bundle.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-0.5 pl-2 border-l-2 border-slate-300">
                  {bundle.items.map((item, idx) => (
                    <div key={idx} className="text-xs text-slate-600 flex items-center gap-1.5">
                      <span className="text-slate-400">{idx === bundle.items.length - 1 ? "└" : "├"}</span>
                      <span className="font-mono text-slate-500">{item.estimateNumber ?? ""}</span>
                      <span>{item.title ?? "（無題）"}</span>
                    </div>
                  ))}
                </div>
                {bundle.title && (
                  <div className="mt-1.5 text-xs text-slate-500">
                    {bundle.title}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* フローティング一括操作バー（モバイル用） */}
      {checkedEstimateIds.size > 0 && (
        <div className={`fixed ${embedded ? "bottom-4" : "bottom-16"} left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-slate-900 text-white ${!embedded ? "px-4 py-2.5" : "px-3 py-2"} rounded-full shadow-2xl shadow-slate-900/40 border border-slate-700 animate-in slide-in-from-bottom-4 duration-200`}>
          <div className="flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-green-400" />
            <span className="font-semibold text-sm">
              {checkedEstimateIds.size}件選択
            </span>
          </div>
          <div className="w-px h-5 bg-slate-700" />
          <button
            onClick={() => {
              const allIds = new Set(checkableEstimates.map((e) => e.id))
              setCheckedEstimateIds(allIds)
            }}
            className="text-xs text-slate-300 hover:text-white transition-colors"
          >
            全選択
          </button>
          <button
            onClick={() => setCheckedEstimateIds(new Set())}
            className="text-xs text-slate-300 hover:text-white transition-colors"
          >
            解除
          </button>
          <Button
            size="sm"
            onClick={handleBulkPrint}
            className="bg-blue-500 hover:bg-blue-400 text-white h-8 px-3.5 rounded-full font-semibold text-sm"
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            印刷
          </Button>
          <Button
            size="sm"
            onClick={handleCreateBundle}
            className="bg-purple-500 hover:bg-purple-400 text-white h-8 px-3.5 rounded-full font-semibold text-sm"
          >
            <Layers className="w-3.5 h-3.5 mr-1" />
            セット
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const contractable = project.estimates.filter(
                (e) => checkedEstimateIds.has(e.id) && isContractable(e)
              )
              if (contractable.length === 0) { toast.error("契約処理できる見積がありません（確定済み・未契約のみ）"); return }
              setBulkContractOpen(true)
            }}
            className="bg-green-500 hover:bg-green-400 text-white h-8 px-3.5 rounded-full font-semibold text-sm"
          >
            <HandshakeIcon className="w-3.5 h-3.5 mr-1" />
            契約
          </Button>
        </div>
      )}
    </>
  )
}
