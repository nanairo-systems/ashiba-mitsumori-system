/**
 * [COMPONENT] 現場詳細 デスクトップビュー - ProjectDetailDesktop
 *
 * デスクトップ・コンパクト・埋め込みモードの表示レイアウト。
 * 共有ロジックは ProjectDetail.tsx から props 経由で受け取る。
 */
"use client"

import { formatDate, formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  Plus,
  FileText,
  Building2,
  MapPin,
  User,
  Calendar,
  LayoutTemplate,
  CheckSquare,
  Square,
  FilePlus2,
  Wrench,
  HandshakeIcon,
  Pencil,
  Printer,
  Zap,
  Layers,
  ClipboardList,
  Trash2,
} from "lucide-react"
import { KeyboardHint } from "@/components/ui/keyboard-hint"
import { toast } from "sonner"
import type { ProjectDetailViewProps, EstimateInProject } from "./ProjectDetail"

export function ProjectDetailDesktop(props: ProjectDetailViewProps) {
  const {
    project,
    contacts,
    estimateBundles,
    embedded,
    compact,
    selectedEstimateId,
    setSelectedEstimateId,
    isEstimateEditing,
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
    onClose,
    router,
    statusConfig,
    contractStatusConfig,
    calcTotal,
    initialEstimates,
    additionalEstimates,
    isCheckable,
    isContractable,
    onSelectEstimateProp,
    isMobile,
  } = props

  return (
    <>
      {/* ヘッダー */}
      <div className={`flex items-center ${compact ? "gap-1.5 flex-wrap pt-3" : embedded ? "gap-2 flex-wrap pt-4" : "gap-4"}`}>
        {embedded ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className={compact ? "h-7 px-2 text-xs" : ""}>
              <ArrowLeft className={compact ? "w-3.5 h-3.5 mr-0.5" : "w-4 h-4 mr-1"} />
              {compact ? "✕" : "閉じる"}
            </Button>
            {!compact && <KeyboardHint keyName="Esc" label="閉じる" />}
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => guardedAction(() => router.push("/"))}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            一覧に戻る
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {!compact && <span className="text-xs text-slate-600 font-mono">{project.shortId}</span>}
            <h1 className={`${compact ? "text-base" : embedded ? "text-lg" : "text-2xl"} font-bold text-slate-900 truncate`}>{project.name}</h1>
          </div>
          <p className={`${compact ? "text-xs" : "text-sm"} text-slate-500 mt-0.5 truncate`}>
            {project.branch.company.name}
            {project.branch.name !== "本社" && ` / ${project.branch.name}`}
          </p>
        </div>
        {!compact && issikiTemplate && (
          <Button size="sm" variant="outline" onClick={() => guardedAction(handleQuickCreateEstimate)} disabled={creating}>
            <Zap className="w-4 h-4 mr-1" />
            一式で作成
          </Button>
        )}
        <Button size="sm" onClick={() => guardedAction(openDialog)} className={compact ? "h-7 px-2 text-xs" : ""}>
          <Plus className={compact ? "w-3 h-3 mr-0.5" : "w-4 h-4 mr-1"} />
          {compact ? "追加" : "見積を追加"}
        </Button>
      </div>

      {/* 現場情報カード */}
      {compact ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-600 uppercase tracking-wide">現場情報</span>
            <button onClick={() => openEdit("name")} className="text-xs text-slate-600 hover:text-blue-600 transition-colors flex items-center gap-0.5">
              <Pencil className="w-2.5 h-2.5" />
              編集
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{project.branch.company.name}{project.branch.name !== "本社" && ` / ${project.branch.name}`}</span>
          </div>
          {project.address && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{project.address}</span>
            </div>
          )}
          {project.contact && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <User className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{project.contact.name}</span>
              {project.contact.phone && <span className="text-slate-600">/ {project.contact.phone}</span>}
            </div>
          )}
          {(project.startDate || project.endDate) && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
              <span>
                {project.startDate ? formatDate(project.startDate, "yyyy/MM/dd") : "未定"}
                {" 〜 "}
                {project.endDate ? formatDate(project.endDate, "yyyy/MM/dd") : "未定"}
              </span>
            </div>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-500">基本情報</CardTitle>
              <button
                onClick={() => openEdit("name")}
                className="flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-blue-50"
              >
                <Pencil className="w-3 h-3" />
                編集
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">会社:</span>
              <span className="font-medium">{project.branch.company.name}</span>
              {project.branch.name !== "本社" && (
                <span className="text-slate-600">/ {project.branch.name}</span>
              )}
            </div>
            {project.address ? (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">住所:</span>
                <span>{project.address}</span>
              </div>
            ) : (
              <button
                onClick={() => openEdit("address")}
                className="flex items-center gap-2 text-sm px-3 py-1.5 -mx-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors w-full"
              >
                <MapPin className="w-4 h-4 text-amber-500" />
                <span className="font-medium">現場住所が未設定です</span>
                <span className="ml-auto text-xs text-amber-500">クリックして追加</span>
              </button>
            )}
            {(project.startDate || project.endDate) && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">工期:</span>
                <span>
                  {project.startDate ? formatDate(project.startDate, "yyyy/MM/dd") : "未定"}
                  {" 〜 "}
                  {project.endDate ? formatDate(project.endDate, "yyyy/MM/dd") : "未定"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-500">先方担当者</CardTitle>
              <button
                onClick={() => openEdit("contact")}
                className="flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-blue-50"
              >
                <Pencil className="w-3 h-3" />
                編集
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {project.contact ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="font-medium">{project.contact.name}</span>
                </div>
                {project.contact.phone && (
                  <p className="text-sm text-slate-500 pl-6">{project.contact.phone}</p>
                )}
                {project.contact.email && (
                  <p className="text-sm text-slate-500 pl-6">{project.contact.email}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <User className="w-4 h-4" />
                <span>担当者未設定</span>
                {contacts.length > 0 && (
                  <button onClick={() => openEdit("contact")} className="text-blue-500 hover:underline text-xs">設定</button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* 見積一覧 */}
      {compact ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">見積一覧</span>
              <span className="text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">{project.estimates.length}件</span>
            </div>
            {checkableEstimates.length > 0 && checkedEstimateIds.size > 0 && (
              <span className="text-xs text-green-600 font-medium">{checkedEstimateIds.size}件選択</span>
            )}
          </div>
          {project.estimates.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              <p className="text-xs">見積がまだありません</p>
              <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={openDialog}>
                <Plus className="w-3 h-3 mr-1" />
                作成
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
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
                const selectFn = embedded && onSelectEstimateProp ? onSelectEstimateProp : (embedded || isMobile) ? (id: string) => router.push(`/estimates/${id}`) : setSelectedEstimateId

                return (
                  <div
                    key={est.id}
                    className={`rounded-lg border px-3 py-2 cursor-pointer transition-all ${
                      isSelected ? "border-blue-400 bg-blue-50 shadow-sm" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    } ${isOld ? "opacity-50" : ""} ${isChecked ? "bg-green-50/60 border-green-300" : ""}`}
                    onClick={() => guardedAction(() => selectFn(est.id))}
                  >
                    <div className="flex items-center gap-2">
                      {checkable && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleCheck(est.id) }}
                          className={`w-6 h-6 shrink-0 rounded flex items-center justify-center transition-colors ${isChecked ? "text-green-600" : "text-slate-300 hover:text-slate-500"}`}
                        >
                          {isChecked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                        </button>
                      )}
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${statusClass}`}>
                        {label}
                      </span>
                      <span className="text-xs font-medium text-slate-700 truncate flex-1">{displayTitle}</span>
                      <span className="font-mono text-xs font-semibold text-slate-800 shrink-0">¥{formatCurrency(total)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 ml-0 text-xs text-slate-600">
                      {est.estimateType === "ADDITIONAL" && <span className="text-amber-500 font-medium">追加</span>}
                      <span>{est.user.name}</span>
                      <span>{formatDate(est.createdAt, "MM/dd")}</span>
                      {est.confirmedAt && <span className="text-green-600">確定: {formatDate(est.confirmedAt, "MM/dd")}</span>}
                    </div>
                  </div>
                )
              })}

              {project.estimates.length > 1 && (
                <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-slate-100 border border-slate-200">
                  <span className="text-sm font-semibold text-slate-500">合計（税抜）</span>
                  <span className="font-mono text-xs font-bold text-slate-900">
                    ¥{formatCurrency(project.estimates.reduce((s, e) => s + calcTotal(e.sections), 0))}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <FileText className="w-5 h-5" />
            見積一覧
            <Badge variant="secondary" className="ml-2">
              {project.estimates.length}件
            </Badge>
            {checkableEstimates.length > 0 && (
              <span className="ml-auto flex items-center gap-2">
                {checkedEstimateIds.size > 0 ? (
                  <>
                    <span className="text-sm font-normal text-green-700">
                      {checkedEstimateIds.size}件選択中
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setCheckedEstimateIds(new Set())}
                    >
                      選択解除
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-blue-600 border-blue-300 hover:bg-blue-50"
                      onClick={handleBulkPrint}
                    >
                      <Printer className="w-3.5 h-3.5 mr-1" />
                      一括印刷
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-purple-600 border-purple-300 hover:bg-purple-50"
                      onClick={handleCreateBundle}
                    >
                      <Layers className="w-3.5 h-3.5 mr-1" />
                      見積セット作成
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        const contractable = project.estimates.filter(
                          (e) => checkedEstimateIds.has(e.id) && isContractable(e)
                        )
                        if (contractable.length === 0) { toast.error("契約処理できる見積がありません（確定済み・未契約のみ）"); return }
                        setBulkContractOpen(true)
                      }}
                    >
                      <HandshakeIcon className="w-3.5 h-3.5 mr-1" />
                      一括契約処理
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-slate-500"
                    onClick={() => setCheckedEstimateIds(new Set(checkableEstimates.map((e) => e.id)))}
                  >
                    <CheckSquare className="w-3.5 h-3.5 mr-1" />
                    全件選択
                  </Button>
                )}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {project.estimates.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <LayoutTemplate className="w-10 h-10 mx-auto mb-3 text-slate-500" />
              <p>見積がまだありません</p>
              <p className="text-xs mt-1">ボタンから見積を作成できます</p>
              <div className="flex gap-2 justify-center mt-4">
                {issikiTemplate && (
                  <Button size="sm" onClick={() => guardedAction(handleQuickCreateEstimate)} disabled={creating}>
                    <Zap className="w-4 h-4 mr-1" />
                    一式見積りで作成
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={openDialog}>
                  <Plus className="w-4 h-4 mr-1" />
                  テンプレートを選んで作成
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {/* 通常見積 */}
              {initialEstimates.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                    <FilePlus2 className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">通常見積</span>
                    <span className="text-xs text-slate-600">{initialEstimates.length}件</span>
                  </div>
                  <EstimateTable
                    estimates={initialEstimates}
                    projectEstimateCount={project.estimates.length}
                    startIndex={0}
                    checkedIds={checkedEstimateIds}
                    onToggleCheck={toggleCheck}
                    isCheckable={isCheckable}
                    selectedEstimateId={selectedEstimateId}
                    onSelectEstimate={embedded && onSelectEstimateProp ? onSelectEstimateProp : (embedded || isMobile) ? (id: string) => router.push(`/estimates/${id}`) : setSelectedEstimateId}
                    isEditing={isEstimateEditing}
                    onGuardedSelect={(id) => guardedAction(() => embedded && onSelectEstimateProp ? onSelectEstimateProp(id) : (embedded || isMobile) ? router.push(`/estimates/${id}`) : setSelectedEstimateId(id))}
                    statusConfig={statusConfig}
                    contractStatusConfig={contractStatusConfig}
                    calcTotal={calcTotal}
                  />
                </>
              )}

              {/* 追加見積 */}
              {additionalEstimates.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">追加見積</span>
                    <span className="text-xs text-amber-600">{additionalEstimates.length}件</span>
                  </div>
                  <EstimateTable
                    estimates={additionalEstimates}
                    projectEstimateCount={project.estimates.length}
                    startIndex={initialEstimates.length}
                    checkedIds={checkedEstimateIds}
                    onToggleCheck={toggleCheck}
                    isCheckable={isCheckable}
                    selectedEstimateId={selectedEstimateId}
                    onSelectEstimate={embedded && onSelectEstimateProp ? onSelectEstimateProp : (embedded || isMobile) ? (id: string) => router.push(`/estimates/${id}`) : setSelectedEstimateId}
                    isEditing={isEstimateEditing}
                    onGuardedSelect={(id) => guardedAction(() => embedded && onSelectEstimateProp ? onSelectEstimateProp(id) : (embedded || isMobile) ? router.push(`/estimates/${id}`) : setSelectedEstimateId(id))}
                    statusConfig={statusConfig}
                    contractStatusConfig={contractStatusConfig}
                    calcTotal={calcTotal}
                  />
                </>
              )}

              {/* 合計行 */}
              {project.estimates.length > 1 && (
                <div className="flex justify-between items-center px-4 py-3 bg-slate-50 border-t-2 border-slate-200">
                  <span className="text-sm font-semibold text-slate-700">合計（全見積 税抜）</span>
                  <span className="font-mono font-bold text-slate-900">
                    ¥{formatCurrency(project.estimates.reduce((s, e) => s + calcTotal(e.sections), 0))}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      )}

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

      {/* フローティング一括操作バー（コンパクト用） */}
      {compact && checkedEstimateIds.size > 0 && (
        <div className={`fixed ${embedded ? "bottom-4" : "bottom-16"} left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-slate-900 text-white px-3 py-2 rounded-full shadow-2xl shadow-slate-900/40 border border-slate-700 animate-in slide-in-from-bottom-4 duration-200`}>
          <div className="flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5 text-green-400" />
            <span className="font-semibold text-xs">
              {checkedEstimateIds.size}件選択
            </span>
          </div>
          <div className="w-px h-4 bg-slate-700" />
          <button
            onClick={() => {
              const allIds = new Set(checkableEstimates.map((e) => e.id))
              setCheckedEstimateIds(allIds)
            }}
            className="text-sm text-slate-300 hover:text-white transition-colors"
          >
            全選択
          </button>
          <button
            onClick={() => setCheckedEstimateIds(new Set())}
            className="text-sm text-slate-300 hover:text-white transition-colors"
          >
            解除
          </button>
          <Button
            size="sm"
            onClick={handleBulkPrint}
            className="bg-blue-500 hover:bg-blue-400 text-white h-7 px-3 rounded-full font-semibold text-xs"
          >
            <Printer className="w-3 h-3 mr-1" />
            印刷
          </Button>
          <Button
            size="sm"
            onClick={handleCreateBundle}
            className="bg-purple-500 hover:bg-purple-400 text-white h-7 px-3 rounded-full font-semibold text-xs"
          >
            <Layers className="w-3 h-3 mr-1" />
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
            className="bg-green-500 hover:bg-green-400 text-white h-7 px-3 rounded-full font-semibold text-xs"
          >
            <HandshakeIcon className="w-3 h-3 mr-1" />
            契約
          </Button>
        </div>
      )}

    </>
  )
}

// ─── 見積テーブル（種別ごとに共通） ─────────────────────

function EstimateTable({
  estimates,
  projectEstimateCount,
  startIndex,
  checkedIds,
  onToggleCheck,
  isCheckable: checkableFn,
  selectedEstimateId,
  onSelectEstimate,
  isEditing,
  onGuardedSelect,
  statusConfig,
  contractStatusConfig,
  calcTotal,
}: {
  estimates: EstimateInProject[]
  projectEstimateCount: number
  startIndex: number
  checkedIds: Set<string>
  onToggleCheck: (id: string) => void
  isCheckable: (est: EstimateInProject) => boolean
  selectedEstimateId: string | null
  onSelectEstimate: (id: string) => void
  isEditing: boolean
  onGuardedSelect: (id: string) => void
  statusConfig: Record<string, { label: string; className: string }>
  contractStatusConfig: Record<string, { label: string; className: string }>
  calcTotal: (sections: { groups: { items: { quantity: number; unitPrice: number }[] }[] }[]) => number
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-white">
          <TableHead className="w-10" />
          <TableHead className="w-[180px]">見積タイトル</TableHead>
          <TableHead>ステータス</TableHead>
          <TableHead>金額（税抜）</TableHead>
          <TableHead>確定日</TableHead>
          <TableHead>作成者</TableHead>
          <TableHead>作成日</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {estimates.map((est, idx) => {
          const { label, className } = est.contract
            ? contractStatusConfig[est.contract.status]
            : statusConfig[est.status]
          const total = calcTotal(est.sections)
          const displayTitle = est.title
            ?? (projectEstimateCount === 1 ? "見積" : `見積 ${startIndex + idx + 1}`)
          const checkable = checkableFn(est)
          const isChecked = checkedIds.has(est.id)
          const isSelected = selectedEstimateId === est.id

          const isOld = est.status === "OLD"

          return (
            <TableRow
              key={est.id}
              className={`cursor-pointer transition-colors ${isOld ? "opacity-50 hover:opacity-70 hover:bg-slate-50" : "hover:bg-slate-50"} ${isChecked ? "bg-green-50/50" : ""} ${isSelected ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : ""}`}
              onClick={() => onGuardedSelect(est.id)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                {checkable ? (
                  <button
                    onClick={() => onToggleCheck(est.id)}
                    className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
                      isChecked ? "text-green-600 hover:text-green-700" : "text-slate-300 hover:text-slate-500"
                    }`}
                    title={isChecked ? "選択解除" : "契約処理に追加"}
                  >
                    {isChecked ? <CheckSquare className="w-4.5 h-4.5" /> : <Square className="w-4.5 h-4.5" />}
                  </button>
                ) : null}
              </TableCell>
              <TableCell>
                <span className={`font-medium text-sm ${isOld ? "text-slate-400" : "text-blue-600"}`}>
                  {displayTitle}
                </span>
                {est.estimateNumber && (
                  <p className="text-xs text-slate-600 font-mono mt-0.5">{est.estimateNumber}</p>
                )}
              </TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
                  {label}
                </span>
              </TableCell>
              <TableCell className="font-mono text-sm">¥{formatCurrency(total)}</TableCell>
              <TableCell className="text-sm text-slate-500">
                {est.confirmedAt ? formatDate(est.confirmedAt, "yyyy/MM/dd") : "—"}
              </TableCell>
              <TableCell className="text-sm text-slate-600">{est.user.name}</TableCell>
              <TableCell className="text-sm text-slate-500">
                {formatDate(est.createdAt, "yyyy/MM/dd")}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
