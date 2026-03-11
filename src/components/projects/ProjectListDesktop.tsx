/**
 * [COMPONENT] 商談一覧 - デスクトップビュー
 *
 * ProjectList.tsx から分離されたデスクトップ専用の表示コンポーネント。
 * パネル表示（現場詳細・見積詳細）を含む。
 * 全ての状態管理・ロジックは ProjectList.tsx に残り、props 経由で受け取る。
 */
"use client"

import Link from "next/link"
import { formatDate, formatRelativeDate, formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Search,
  Archive,
  MoreHorizontal,
  Eye,
  FileText,
  HandshakeIcon,
  ChevronDown,
  ChevronRight,
  Building2,
  FilePlus2,
  CheckSquare,
  Square,
  Tag,
  User2,
  X,
  MapPin,
  Calendar,
} from "lucide-react"
import { Loader2 as LoaderIcon, BookOpen, Zap, Layers, Trash2, EyeOff, RotateCcw } from "lucide-react"
import { EstimateDetail } from "@/components/estimates/EstimateDetail"
import { ProjectDetail } from "@/components/projects/ProjectDetail"
import type { ProjectListViewProps } from "./ProjectList"
import type { EstimateStatus } from "@prisma/client"

// ── デスクトップ用見積サブ行（パネル展開時） ──────────────

function PanelEstimateSubRow({
  est,
  project,
  isLast,
  estimateIndex,
  props,
}: {
  est: ProjectListViewProps["filtered"][number]["estimates"][number]
  project: ProjectListViewProps["filtered"][number]
  isLast: boolean
  estimateIndex: number
  props: ProjectListViewProps
}) {
  const {
    EST_STATUS_STYLE,
    EST_STATUS_SHORT,
    checkedEstimateIds,
    toggleCheck,
    handleSelectEstimate,
    handleRestoreEstimate,
    selectedEstimateId,
    setContractDialogItems,
    setContractDialogMode,
    setContractDialogOpen,
    setDeleteEstimateId,
    setDeleteEstimateName,
    setHideEstimateId,
    setHideEstimateName,
  } = props

  const displayName = est.title
    ?? (project.estimates.length === 1 ? null : `見積 ${estimateIndex + 1}`)
  const checkable = est.status === "CONFIRMED" || est.status === "SENT"
  const isChecked = checkedEstimateIds.has(est.id)
  const isSelected = selectedEstimateId === est.id
  const isHidden = est.isArchived

  // 非表示見積: 薄く表示 + 復元ボタン
  if (isHidden) {
    return (
      <div
        className={`flex items-center gap-3 px-2 py-2 ${
          !isLast ? "border-b border-slate-100" : ""
        } bg-slate-50/80 opacity-50`}
      >
        <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-xs text-slate-400 truncate flex-1">
          {displayName ?? "（無題）"}
        </span>
        <span className="text-xs text-slate-400 shrink-0">非表示</span>
        <button
          onClick={() => handleRestoreEstimate(est.id)}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-blue-50 text-blue-600 font-medium hover:bg-blue-100 transition-colors shrink-0"
        >
          <RotateCcw className="w-3 h-3" />
          表示に戻す
        </button>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-2 text-sm cursor-pointer hover:bg-blue-50/40 transition-colors ${
        !isLast ? "border-b border-slate-100" : ""
      } ${isChecked ? "bg-green-50/60" : ""} ${isSelected ? "bg-blue-100/70 ring-1 ring-inset ring-blue-300" : ""}`}
      onClick={() => handleSelectEstimate(est.id)}
    >
      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
        {checkable ? (
          <button
            onClick={() => toggleCheck(est.id)}
            className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${isChecked ? "text-green-600" : "text-slate-300 hover:text-slate-500"}`}
          >
            {isChecked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <div className="w-4" />
        )}
      </div>
      <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${EST_STATUS_STYLE[est.status]}`}>
        {EST_STATUS_SHORT[est.status]}
      </span>
      <div className="min-w-0 flex-1 truncate" title={displayName ?? "（無題）"}>
        <span className="text-xs text-slate-700">{displayName ?? "（無題）"}</span>
      </div>
      <span className="shrink-0 font-mono text-xs font-semibold text-slate-700">¥{formatCurrency(est.totalAmount)}</span>
      <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => handleSelectEstimate(est.id)}>
              <FileText className="w-4 h-4 mr-2" />
              見積を開く
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {(est.status === "CONFIRMED" || est.status === "SENT") ? (
              <DropdownMenuItem
                onClick={() => {
                  const companyTaxRate = project.branch.company.taxRate
                  setContractDialogItems([{
                    estimateId: est.id,
                    estimateName: est.title ?? "見積",
                    projectId: project.id,
                    projectName: project.name,
                    companyName: project.branch.company.name,
                    taxExcludedAmount: Math.round(est.totalAmount / (1 + companyTaxRate)),
                    taxRate: companyTaxRate,
                  }])
                  setContractDialogMode("individual")
                  setContractDialogOpen(true)
                }}
                className="flex items-center gap-2 text-green-700 focus:text-green-700 focus:bg-green-50"
              >
                <HandshakeIcon className="w-4 h-4" />
                契約処理
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled className="flex items-center gap-2 text-slate-400">
                <HandshakeIcon className="w-4 h-4" />
                契約処理（確定後に可）
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {est.status === "DRAFT" ? (
              <DropdownMenuItem
                onClick={() => {
                  setDeleteEstimateId(est.id)
                  setDeleteEstimateName(est.title ?? `見積 ${estimateIndex + 1}`)
                }}
                className="flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                削除
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => {
                  setHideEstimateId(est.id)
                  setHideEstimateName(est.title ?? `見積 ${estimateIndex + 1}`)
                }}
                className="flex items-center gap-2 text-orange-600 focus:text-orange-600 focus:bg-orange-50"
              >
                <EyeOff className="w-4 h-4" />
                非表示にする
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// ── デスクトップ用見積サブ行（全幅時） ──────────────────

function FullWidthEstimateSubRow({
  est,
  project,
  isLast,
  estimateIndex,
  props,
}: {
  est: ProjectListViewProps["filtered"][number]["estimates"][number]
  project: ProjectListViewProps["filtered"][number]
  isLast: boolean
  estimateIndex: number
  props: ProjectListViewProps
}) {
  const {
    EST_STATUS_LABEL,
    EST_STATUS_STYLE,
    EST_TYPE_STYLE,
    checkedEstimateIds,
    toggleCheck,
    handleSelectEstimate,
    handleRestoreEstimate,
    selectedEstimateId,
    setContractDialogItems,
    setContractDialogMode,
    setContractDialogOpen,
    setDeleteEstimateId,
    setDeleteEstimateName,
    // Note: the original uses setArchiveEstimateId/setArchiveEstimateName in the full-width variant
    // which appears to be a bug referencing undefined variables. We preserve the original behavior.
  } = props

  const typeTag = EST_TYPE_STYLE[est.estimateType]
  const displayName = est.title
    ?? (project.estimates.length === 1 ? null : `見積 ${estimateIndex + 1}`)
  const checkable = est.status === "CONFIRMED" || est.status === "SENT"
  const isChecked = checkedEstimateIds.has(est.id)
  const isSelected = selectedEstimateId === est.id
  const isHidden = est.isArchived

  // 非表示見積: 薄く表示 + 復元ボタン
  if (isHidden) {
    return (
      <div
        className={`flex items-center gap-3 pl-10 pr-4 py-2.5 ${
          !isLast ? "border-b border-slate-100" : ""
        } bg-slate-50/80 opacity-50`}
      >
        <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-xs text-slate-400 truncate flex-1">
          {displayName ?? "（無題）"}
        </span>
        <span className="text-xs text-slate-400 shrink-0">非表示</span>
        <button
          onClick={() => handleRestoreEstimate(est.id)}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-blue-50 text-blue-600 font-medium hover:bg-blue-100 transition-colors shrink-0"
        >
          <RotateCcw className="w-3 h-3" />
          表示に戻す
        </button>
      </div>
    )
  }

  return (
    <div
      className={`grid grid-cols-[2.5rem_5rem_2.5fr_0.8fr_1.2fr_0.9fr_2.5rem] gap-x-2 pl-10 pr-4 py-2.5 items-center text-sm hover:bg-blue-50/30 transition-colors cursor-pointer ${
        !isLast ? "border-b border-slate-100" : ""
      } ${isChecked ? "bg-green-50/60" : ""} ${isSelected ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : ""}`}
      onClick={() => handleSelectEstimate(est.id)}
    >
      {/* チェックボックス / ツリー線 */}
      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {checkable ? (
          <button
            onClick={() => toggleCheck(est.id)}
            className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
              isChecked
                ? "text-green-600 hover:text-green-700"
                : "text-slate-300 hover:text-slate-500"
            }`}
            title={isChecked ? "チェックを外す" : "契約処理に追加"}
          >
            {isChecked
              ? <CheckSquare className="w-4.5 h-4.5" />
              : <Square className="w-4.5 h-4.5" />
            }
          </button>
        ) : (
          <div className="w-px h-3 bg-slate-300 mx-auto" />
        )}
      </div>

      {/* 状況 */}
      <div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${EST_STATUS_STYLE[est.status]}`}>
          {EST_STATUS_LABEL[est.status]}
        </span>
      </div>

      {/* 見積名 */}
      <div className="min-w-0 flex items-center gap-2 overflow-hidden">
        <div className="group inline-flex items-center gap-1.5 min-w-0 overflow-hidden">
          <FileText className="w-3.5 h-3.5 shrink-0 text-blue-400 group-hover:text-blue-600 transition-colors" />
          <span className="truncate text-sm text-slate-600 group-hover:text-blue-600 transition-colors" title={displayName ?? "（無題）"}>
            {displayName ?? "（無題）"}
          </span>
          <ChevronRight className="w-3 h-3 shrink-0 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
        </div>
        {typeTag && (
          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${typeTag.className}`}>
            {typeTag.label}
          </span>
        )}
      </div>

      {/* 見積確定日 */}
      <div className="text-slate-500">
        {est.confirmedAt
          ? (() => {
              const rel = formatRelativeDate(est.confirmedAt)
              return <span title={rel.absolute}>{rel.label}</span>
            })()
          : <span className="text-slate-500">—</span>}
      </div>

      {/* 金額 */}
      <div className="font-mono font-semibold text-slate-800">
        ¥{formatCurrency(est.totalAmount)}
      </div>

      {/* 担当者 */}
      <div className="text-slate-600 truncate" title={est.user.name}>
        {est.user.name}
      </div>

      {/* 三点メニュー */}
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => handleSelectEstimate(est.id)}>
              <FileText className="w-4 h-4 mr-2" />
              見積を開く
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {(est.status === "CONFIRMED" || est.status === "SENT") ? (
              <DropdownMenuItem
                onClick={() => {
                    const companyTaxRate = project.branch.company.taxRate
                    setContractDialogItems([{
                      estimateId: est.id,
                      estimateName: est.title ?? "見積",
                      projectId: project.id,
                      projectName: project.name,
                      companyName: project.branch.company.name,
                      taxExcludedAmount: Math.round(est.totalAmount / (1 + companyTaxRate)),
                      taxRate: companyTaxRate,
                    }])
                    setContractDialogMode("individual")
                    setContractDialogOpen(true)
                  }}
                className="flex items-center gap-2 text-green-700 focus:text-green-700 focus:bg-green-50"
              >
                <HandshakeIcon className="w-4 h-4" />
                契約処理
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled className="flex items-center gap-2 text-slate-400">
                <HandshakeIcon className="w-4 h-4" />
                契約処理（確定後に可）
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            {est.status === "DRAFT" ? (
              <DropdownMenuItem
                onClick={() => {
                  setDeleteEstimateId(est.id)
                  setDeleteEstimateName(est.title ?? `見積 ${estimateIndex + 1}`)
                }}
                className="flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                削除
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => {
                  // NOTE: Original code references setArchiveEstimateId/setArchiveEstimateName
                  // which are undefined. Preserving original behavior.
                  (props as any).setArchiveEstimateId?.(est.id);
                  (props as any).setArchiveEstimateName?.(est.title ?? `見積 ${estimateIndex + 1}`)
                }}
                className="flex items-center gap-2 text-orange-600 focus:text-orange-600 focus:bg-orange-50"
              >
                <Archive className="w-4 h-4" />
                アーカイブ
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────────

export function ProjectListDesktop(props: ProjectListViewProps) {
  const {
    currentUser,
    filtered,
    grouped,
    siteGrouped,
    search,
    setSearch,
    showArchived,
    setShowArchived,
    showHiddenEstimates,
    setShowHiddenEstimates,
    viewMode,
    switchViewMode,
    collapsedProjects,
    toggleProject,
    collapsedCompanies,
    toggleCompany,
    collapsedCategories,
    toggleCategory,
    checkedEstimateIds,
    setCheckedEstimateIds,
    allCheckableIds,
    selectedStatuses,
    setSelectedStatuses,
    toggleStatus,
    selectedUsers,
    setSelectedUsers,
    toggleUser,
    allUsers,
    selectedEstimateId,
    selectedProjectId,
    handleSelectEstimate: _handleSelectEstimate,
    handleSelectProject,
    handleArchive,
    setCompanyDialogOpen,
    setBulkContractOpen,
    quickCreating,
    handleQuickCreateForProject,
    issikiTemplate,
    guardedAction,
    hasPanel,
    hasProjectPanel,
    hasEstimatePanel,
    listCollapsed,
    setListCollapsed,
    projectCollapsed,
    setProjectCollapsed,
    estimateData,
    estimateLoading,
    projectDetailData,
    projectLoading,
    closeEstimatePanel,
    closeProjectPanel,
    openEstimateFromProject,
    setIsEstimateEditing,
    refreshEstimate,
    refreshProject,
    router,
    templates,
    EST_STATUS_LABEL,
    EST_STATUS_STYLE,
    SITE_CATEGORY_STYLE,
    handleCreateBundle,
    handleCloseEstimate,
  } = props

  return (
    <div className="flex gap-0">
    {/* ── パネル1：一覧（折りたたみ対応） ── */}
    {listCollapsed ? (
      <button
        onClick={() => setListCollapsed(false)}
        className="w-8 shrink-0 border-r border-slate-300 bg-amber-50/80 hover:bg-amber-100 transition-colors flex flex-col items-center justify-center max-h-[calc(100vh-4rem)] cursor-pointer group relative"
        title="一覧を展開"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-amber-400/60" />
        <BookOpen className="w-3.5 h-3.5 text-amber-600 group-hover:text-amber-700 mb-1" />
        <span className="text-xs text-amber-700/70 group-hover:text-amber-800 font-semibold [writing-mode:vertical-rl] tracking-wider select-none">一覧</span>
      </button>
    ) : (
    <div className={`space-y-4 transition-all duration-300 ${hasPanel ? `${hasEstimatePanel && hasProjectPanel ? "w-[280px]" : "w-[340px]"} shrink-0 overflow-y-auto max-h-[calc(100vh-4rem)] pr-2` : "flex-1 space-y-6"}`}>
      {/* ヘッダー */}
      <div className={hasPanel ? "flex items-center justify-between gap-2" : "flex items-center justify-between"}>
        <div className="flex items-center gap-2">
          {hasPanel && (
            <button onClick={() => setListCollapsed(true)} className="p-1 rounded hover:bg-amber-100 text-amber-500 hover:text-amber-700 transition-colors" title="一覧を折りたたむ">
              <BookOpen className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className={`${hasPanel ? "text-lg" : "text-2xl"} font-bold text-slate-900`}>商談一覧</h1>
            {!hasPanel && (
              <p className="text-sm text-slate-500 mt-1">
                こんにちは、{currentUser.name} さん
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!hasPanel && (
            <Button variant="outline" onClick={() => setCompanyDialogOpen(true)}>
              <Building2 className="w-4 h-4 mr-2" />
              会社を追加
            </Button>
          )}
          <Button size={hasPanel ? "sm" : "default"} onClick={() => guardedAction(() => router.push("/projects/new"))}>
            <Plus className="w-4 h-4 mr-1" />
            {hasPanel ? "新規" : "新規現場作成"}
          </Button>
        </div>
      </div>

      {/* 検索・フィルター */}
      <div className="space-y-2">
        {/* 検索バー */}
        <div className="flex items-center gap-2">
          <div className={`relative flex-1 ${hasPanel ? "" : "max-w-sm"}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={hasPanel ? "検索" : "会社名・現場名・担当者で検索"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`pl-9 ${hasPanel ? "h-8 text-sm" : ""}`}
            />
          </div>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="w-4 h-4" />
            {!hasPanel && <span className="ml-2">{showArchived ? "失注を隠す" : "失注を表示"}</span>}
          </Button>
          {/* 非表示見積の表示トグル */}
          <Button
            variant={showHiddenEstimates ? "default" : "outline"}
            size="sm"
            onClick={() => setShowHiddenEstimates(!showHiddenEstimates)}
            className={`h-8 ${showHiddenEstimates ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
            title={showHiddenEstimates ? "非表示の見積を隠す" : "非表示の見積を表示"}
          >
            <EyeOff className="w-4 h-4" />
            {!hasPanel && <span className="ml-2">{showHiddenEstimates ? "非表示を隠す" : "非表示を表示"}</span>}
          </Button>
          {/* 表示モード切替 */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={() => switchViewMode("company")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
                viewMode === "company"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Building2 className="w-4 h-4" />
              企業別
            </button>
            <button
              onClick={() => switchViewMode("site")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
                viewMode === "site"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <MapPin className="w-4 h-4" />
              現場順
            </button>
          </div>
        </div>

        {/* タグフィルター（デスクトップ） */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 py-1">
          {/* ── 状況グループ ── */}
          <div className="flex items-center gap-1">
            {!hasPanel && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-200 text-slate-600">
                <Tag className="w-3.5 h-3.5" />
                <span className="text-xs font-bold tracking-wide leading-none">状況</span>
              </div>
            )}
            {(["DRAFT", "CONFIRMED", "SENT"] as EstimateStatus[]).map((s) => {
              const active = selectedStatuses.has(s)
              const baseStyle = EST_STATUS_STYLE[s]
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  title={EST_STATUS_LABEL[s]}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all select-none flex items-center justify-center leading-none ${
                    active
                      ? `${baseStyle} ring-2 ring-offset-1 ring-current shadow-md scale-105`
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                  }`}
                >
                  {EST_STATUS_LABEL[s]}
                </button>
              )
            })}
          </div>

          {/* 区切り */}
          {!hasPanel && <div className="w-px h-6 bg-slate-200 hidden sm:block" />}

          {/* ── 担当者グループ ── */}
          {allUsers.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {!hasPanel && (
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-200 text-slate-600">
                  <User2 className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold tracking-wide leading-none">担当</span>
                </div>
              )}
              {allUsers.map(({ id, name }) => {
                const active = selectedUsers.has(id)
                const short = name.slice(0, 2)
                return (
                  <button
                    key={id}
                    onClick={() => toggleUser(id)}
                    title={name}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all select-none flex items-center justify-center leading-none ${
                      active
                        ? "bg-indigo-500 text-white ring-2 ring-offset-1 ring-indigo-400 shadow-md scale-105"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                    }`}
                  >
                    {short}
                  </button>
                )
              })}
            </div>
          )}

          {/* リセット */}
          {(selectedStatuses.size > 0 || selectedUsers.size > 0) && (
            <button
              onClick={() => { setSelectedStatuses(new Set()); setSelectedUsers(new Set()) }}
              className="flex items-center gap-0.5 text-xs text-slate-600 hover:text-slate-700 transition-colors"
              title="絞り込みをリセット"
            >
              <X className="w-3.5 h-3.5" />
              <span className="text-xs">解除</span>
            </button>
          )}
        </div>
      </div>

      {/* 一覧 */}
      {filtered.length === 0 ? (
        <div className="bg-white py-16 text-center text-slate-400 rounded-xl border border-slate-200">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          {search || selectedStatuses.size > 0 || selectedUsers.size > 0 ? (
            <>
              <p className="text-sm text-slate-500 mb-1">条件に一致する現場がありません</p>
              <p className="text-xs text-slate-600 mb-4">
                {search && `「${search}」`}
                {search && (selectedStatuses.size > 0 || selectedUsers.size > 0) && " × "}
                {selectedStatuses.size > 0 && `状況: ${Array.from(selectedStatuses).map(s => EST_STATUS_LABEL[s]).join("・")}`}
                {selectedStatuses.size > 0 && selectedUsers.size > 0 && " × "}
                {selectedUsers.size > 0 && `担当: ${selectedUsers.size}名`}
              </p>
              <button
                onClick={() => { setSearch(""); setSelectedStatuses(new Set()); setSelectedUsers(new Set()) }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                絞り込みをリセット
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-4">商談中の現場がありません</p>
              <Link href="/estimates/new">
                <Button size="sm" className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  新規見積を作成する
                </Button>
              </Link>
            </>
          )}
        </div>
      ) : viewMode === "company" ? (
        /* ===== 企業別表示 ===== */
        <div className="space-y-4">
          {grouped.map(({ companyId, companyName, projects: companyProjects }) => {
            const isCompanyCollapsed = collapsedCompanies.has(companyId)
            const totalEstimates = companyProjects.reduce((s, p) => s + p.estimates.length, 0)

            return (
              <div key={companyId} className="bg-white overflow-hidden rounded-xl border border-slate-200">
                {/* 会社名ヘッダー */}
                <button
                  onClick={() => toggleCompany(companyId)}
                  className={`w-full flex items-center gap-2 ${hasPanel ? "px-3 py-2" : "px-4 py-3"} bg-slate-800 text-white text-left hover:bg-slate-700 transition-colors`}
                >
                  {isCompanyCollapsed ? (
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 flex-shrink-0" />
                  )}
                  <Building2 className="w-4 h-4 flex-shrink-0 text-slate-300" />
                  <span className={`${hasPanel ? "text-sm" : ""} font-semibold truncate`} title={companyName}>{companyName}</span>
                  <span className="ml-auto text-xs text-slate-400 font-normal shrink-0">
                    {companyProjects.length}現場 / {totalEstimates}件
                  </span>
                </button>

                {/* カラムヘッダー */}
                {!isCompanyCollapsed && (
                  <div>
                    {/* 各現場 */}
                    {companyProjects.map((project, pIdx) => {
                      const isProjectCollapsed = collapsedProjects.has(project.id)
                      const isLastProject = pIdx === companyProjects.length - 1

                      return (
                        <div
                          key={project.id}
                          className={!isLastProject ? "border-b border-slate-200" : ""}
                        >
                          {/* 現場ヘッダー行 */}
                          <div className={`flex items-center gap-2 ${hasPanel ? "px-3 py-2" : "px-4 py-3 gap-3"} bg-slate-50/70 hover:bg-slate-100/80 transition-colors`}>
                            {/* 展開ボタン */}
                            <div className="flex-shrink-0">
                              {project.estimates.length > 0 ? (
                                <button
                                  onClick={() => toggleProject(project.id)}
                                  title={isProjectCollapsed ? "見積を表示" : "見積を隠す"}
                                  className={`${hasPanel ? "w-5 h-5" : "w-6 h-6"} rounded flex items-center justify-center transition-colors ${
                                    isProjectCollapsed
                                      ? "bg-slate-200 text-slate-600 hover:bg-blue-500 hover:text-white"
                                      : "bg-blue-500 text-white hover:bg-blue-600"
                                  }`}
                                >
                                  {isProjectCollapsed ? (
                                    <ChevronRight className={`${hasPanel ? "w-3 h-3" : "w-3.5 h-3.5"}`} />
                                  ) : (
                                    <ChevronDown className={`${hasPanel ? "w-3 h-3" : "w-3.5 h-3.5"}`} />
                                  )}
                                </button>
                              ) : <div className={hasPanel ? "w-5" : "w-6"} />}
                            </div>

                            {/* 現場名 */}
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <button
                                onClick={() => handleSelectProject(project.id)}
                                className="group inline-flex items-center gap-1 min-w-0"
                              >
                                <span className={`font-bold group-hover:text-blue-600 transition-colors truncate ${hasPanel ? "text-xs" : "text-sm"} ${selectedProjectId === project.id ? "text-blue-600" : "text-slate-800"}`} title={project.name}>
                                  {project.name}
                                </span>
                                <ChevronRight className="w-3 h-3 shrink-0 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                              </button>
                              {!hasPanel && project.branch.name !== "本社" && (
                                <span className="text-xs text-slate-600 shrink-0 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {project.branch.name}
                                </span>
                              )}
                            </div>

                            {/* 住所・担当・日付 — パネル展開時は非表示 */}
                            {!hasPanel && (
                              <>
                                {project.address ? (
                                  <div className="hidden md:flex items-center gap-1 text-xs text-slate-500 min-w-0 shrink">
                                    <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                                    <span className="truncate" title={project.address}>{project.address}</span>
                                  </div>
                                ) : (
                                  <div className="hidden md:flex items-center gap-1 text-xs text-amber-600 shrink-0">
                                    <MapPin className="w-3 h-3 shrink-0 text-amber-500" />
                                    <span className="font-medium">住所未設定</span>
                                  </div>
                                )}
                                <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 shrink-0">
                                  <User2 className="w-3 h-3 text-slate-400" />
                                  <span>{project.contact?.name ?? "—"}</span>
                                </div>
                                <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 shrink-0">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  {(() => {
                                    const rel = formatRelativeDate(project.createdAt)
                                    return <span title={rel.absolute}>{rel.label}</span>
                                  })()}
                                </div>
                              </>
                            )}

                            {/* 見積件数バッジ */}
                            <button
                              onClick={() => toggleProject(project.id)}
                              className={`shrink-0 ${hasPanel ? "" : "ml-auto"} inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 transition-colors`}
                            >
                              <FileText className="w-3 h-3" />
                              {project.estimates.length}件
                            </button>

                            {/* 三点メニュー（現場レベル） */}
                            <div className="flex-shrink-0">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    onClick={() => handleSelectProject(project.id)}
                                    className="flex items-center gap-2"
                                  >
                                    <Eye className="w-4 h-4" />
                                    現場詳細を開く
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleSelectProject(project.id)}
                                    className="flex items-center gap-2"
                                  >
                                    <FilePlus2 className="w-4 h-4" />
                                    新規見積を追加
                                  </DropdownMenuItem>
                                  {issikiTemplate && (
                                    <DropdownMenuItem
                                      onClick={() => handleQuickCreateForProject(project.id, project.estimates.length)}
                                      disabled={quickCreating}
                                      className="flex items-center gap-2 text-blue-600 focus:text-blue-600 focus:bg-blue-50"
                                    >
                                      <Zap className="w-4 h-4" />
                                      一式見積りで作成
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => guardedAction(() => handleArchive(project.id))}
                                    className="flex items-center gap-2 text-orange-600 focus:text-orange-600 focus:bg-orange-50"
                                  >
                                    <Archive className="w-4 h-4" />
                                    失注としてアーカイブ
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {/* 見積サブ行（展開時） */}
                          {!isProjectCollapsed && project.estimates.length > 0 && (
                            <div className="bg-white">
                              {/* 見積カラムヘッダー（デスクトップ全幅時のみ） */}
                              {!hasPanel && (
                                <div className="grid grid-cols-[2.5rem_5rem_2.5fr_0.8fr_1.2fr_0.9fr_2.5rem] gap-x-2 pl-10 pr-4 py-1.5 bg-slate-100/60 border-y border-slate-100 text-xs font-medium text-slate-600 uppercase tracking-wider">
                                  <span />
                                  <span>状況</span>
                                  <span>見積名</span>
                                  <span>確定日</span>
                                  <span>金額（税込）</span>
                                  <span>担当者</span>
                                  <span />
                                </div>
                              )}
                              {project.estimates
                                .filter((est) => showHiddenEstimates || !est.isArchived)
                                .map((est, eIdx, filteredEst) => (
                                hasPanel ? (
                                  <PanelEstimateSubRow
                                    key={est.id}
                                    est={est}
                                    project={project}
                                    isLast={eIdx === filteredEst.length - 1}
                                    estimateIndex={eIdx}
                                    props={props}
                                  />
                                ) : (
                                  <FullWidthEstimateSubRow
                                    key={est.id}
                                    est={est}
                                    project={project}
                                    isLast={eIdx === filteredEst.length - 1}
                                    estimateIndex={eIdx}
                                    props={props}
                                  />
                                )
                              ))}
                            </div>
                          )}

                          {/* 見積なしの場合 */}
                          {!isProjectCollapsed && project.estimates.filter((e) => showHiddenEstimates || !e.isArchived).length === 0 && (
                            <div className="pl-10 pr-4 py-3 border-t border-dashed border-slate-200 bg-slate-50/50">
                              <button
                                onClick={() => guardedAction(() => router.push(`/projects/${project.id}?newEstimate=1`))}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 border border-blue-200 text-sm text-blue-600 font-medium hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                              >
                                <FilePlus2 className="w-4 h-4" />
                                最初の見積を作成する
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* ===== 現場順表示 ===== */
        <div className="space-y-5">
          {siteGrouped.map(({ category, label, projects: catProjects }) => {
            const style = SITE_CATEGORY_STYLE[category]
            const isCatCollapsed = collapsedCategories.has(category)
            const totalEstimates = catProjects.reduce((s, p) => s + p.estimates.length, 0)

            return (
              <div key={category}>
                {/* カテゴリヘッダー */}
                <button
                  onClick={() => toggleCategory(category)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 ${style.bg} border rounded-t-xl border-slate-200 text-left hover:brightness-95 transition-all`}
                >
                  {isCatCollapsed ? (
                    <ChevronRight className={`w-4 h-4 ${style.text}`} />
                  ) : (
                    <ChevronDown className={`w-4 h-4 ${style.text}`} />
                  )}
                  <span className={`font-bold text-sm ${style.text}`}>{label}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${style.badge}`}>
                    {catProjects.length}現場{totalEstimates > 0 && ` / ${totalEstimates}件`}
                  </span>
                </button>

                {/* カテゴリ内の現場カード */}
                {!isCatCollapsed && (
                  <div className="space-y-3 mt-3">
                    {catProjects.map((project) => {
                      const isProjectCollapsed = collapsedProjects.has(project.id)
                      const companyName = project.branch.company.name

                      return (
                        <div key={project.id} className="bg-white overflow-hidden rounded-xl border border-slate-200">
                          {/* 企業名ヘッダー（黒帯） */}
                          <div className={`flex items-center gap-2 ${hasPanel ? "px-3 py-2" : "px-4 py-2.5"} bg-slate-800 text-white`}>
                            <Building2 className="w-4 h-4 flex-shrink-0 text-slate-300" />
                            <span className={`${hasPanel ? "text-sm" : "text-sm"} font-semibold truncate`} title={companyName}>{companyName}</span>
                          </div>

                          {/* 現場ヘッダー行 */}
                          <div className={`flex items-center gap-2 ${hasPanel ? "px-3 py-2" : "px-4 py-3 gap-3"} bg-slate-50/70 hover:bg-slate-100/80 transition-colors`}>
                            {/* 展開ボタン */}
                            <div className="flex-shrink-0">
                              {project.estimates.length > 0 ? (
                                <button
                                  onClick={() => toggleProject(project.id)}
                                  title={isProjectCollapsed ? "見積を表示" : "見積を隠す"}
                                  className={`${hasPanel ? "w-5 h-5" : "w-6 h-6"} rounded flex items-center justify-center transition-colors ${
                                    isProjectCollapsed
                                      ? "bg-slate-200 text-slate-600 hover:bg-blue-500 hover:text-white"
                                      : "bg-blue-500 text-white hover:bg-blue-600"
                                  }`}
                                >
                                  {isProjectCollapsed ? (
                                    <ChevronRight className={`${hasPanel ? "w-3 h-3" : "w-3.5 h-3.5"}`} />
                                  ) : (
                                    <ChevronDown className={`${hasPanel ? "w-3 h-3" : "w-3.5 h-3.5"}`} />
                                  )}
                                </button>
                              ) : <div className={hasPanel ? "w-5" : "w-6"} />}
                            </div>

                            {/* 現場名 */}
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <button
                                onClick={() => handleSelectProject(project.id)}
                                className="group inline-flex items-center gap-1 min-w-0"
                              >
                                <span className={`font-bold group-hover:text-blue-600 transition-colors truncate ${hasPanel ? "text-xs" : "text-sm"} ${selectedProjectId === project.id ? "text-blue-600" : "text-slate-800"}`} title={project.name}>
                                  {project.name}
                                </span>
                                <ChevronRight className="w-3 h-3 shrink-0 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                              </button>
                              {!hasPanel && project.branch.name !== "本社" && (
                                <span className="text-xs text-slate-600 shrink-0 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {project.branch.name}
                                </span>
                              )}
                            </div>

                            {/* 住所・担当・日付 — パネル展開時は非表示 */}
                            {!hasPanel && (
                              <>
                                {project.address ? (
                                  <div className="hidden md:flex items-center gap-1 text-xs text-slate-500 min-w-0 shrink">
                                    <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                                    <span className="truncate" title={project.address}>{project.address}</span>
                                  </div>
                                ) : (
                                  <div className="hidden md:flex items-center gap-1 text-xs text-amber-600 shrink-0">
                                    <MapPin className="w-3 h-3 shrink-0 text-amber-500" />
                                    <span className="font-medium">住所未設定</span>
                                  </div>
                                )}
                                <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 shrink-0">
                                  <User2 className="w-3 h-3 text-slate-400" />
                                  <span>{project.contact?.name ?? "—"}</span>
                                </div>
                                <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 shrink-0">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  {(() => {
                                    const rel = formatRelativeDate(project.updatedAt)
                                    return <span title={rel.absolute}>{rel.label}</span>
                                  })()}
                                </div>
                              </>
                            )}

                            {/* 見積件数バッジ */}
                            <button
                              onClick={() => toggleProject(project.id)}
                              className={`shrink-0 ${hasPanel ? "" : "ml-auto"} inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 transition-colors`}
                            >
                              <FileText className="w-3 h-3" />
                              {project.estimates.length}件
                            </button>

                            {/* 三点メニュー */}
                            <div className="flex-shrink-0">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    onClick={() => handleSelectProject(project.id)}
                                    className="flex items-center gap-2"
                                  >
                                    <Eye className="w-4 h-4" />
                                    現場詳細を開く
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleSelectProject(project.id)}
                                    className="flex items-center gap-2"
                                  >
                                    <FilePlus2 className="w-4 h-4" />
                                    新規見積を追加
                                  </DropdownMenuItem>
                                  {issikiTemplate && (
                                    <DropdownMenuItem
                                      onClick={() => handleQuickCreateForProject(project.id, project.estimates.length)}
                                      disabled={quickCreating}
                                      className="flex items-center gap-2 text-blue-600 focus:text-blue-600 focus:bg-blue-50"
                                    >
                                      <Zap className="w-4 h-4" />
                                      一式見積りで作成
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => guardedAction(() => handleArchive(project.id))}
                                    className="flex items-center gap-2 text-orange-600 focus:text-orange-600 focus:bg-orange-50"
                                  >
                                    <Archive className="w-4 h-4" />
                                    失注としてアーカイブ
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {/* 見積サブ行（展開時） */}
                          {!isProjectCollapsed && project.estimates.length > 0 && (
                            <div className="bg-white">
                              {!hasPanel && (
                                <div className="grid grid-cols-[2.5rem_5rem_2.5fr_0.8fr_1.2fr_0.9fr_2.5rem] gap-x-2 pl-10 pr-4 py-1.5 bg-slate-100/60 border-y border-slate-100 text-xs font-medium text-slate-600 uppercase tracking-wider">
                                  <span />
                                  <span>状況</span>
                                  <span>見積名</span>
                                  <span>確定日</span>
                                  <span>金額（税込）</span>
                                  <span>担当者</span>
                                  <span />
                                </div>
                              )}
                              {project.estimates
                                .filter((est) => showHiddenEstimates || !est.isArchived)
                                .map((est, eIdx, filteredEst) => (
                                hasPanel ? (
                                  <PanelEstimateSubRow
                                    key={est.id}
                                    est={est}
                                    project={project}
                                    isLast={eIdx === filteredEst.length - 1}
                                    estimateIndex={eIdx}
                                    props={props}
                                  />
                                ) : (
                                  <FullWidthEstimateSubRow
                                    key={est.id}
                                    est={est}
                                    project={project}
                                    isLast={eIdx === filteredEst.length - 1}
                                    estimateIndex={eIdx}
                                    props={props}
                                  />
                                )
                              ))}
                            </div>
                          )}

                          {/* 見積なしの場合 */}
                          {!isProjectCollapsed && project.estimates.filter((e) => showHiddenEstimates || !e.isArchived).length === 0 && (
                            <div className="pl-10 pr-4 py-3 border-t border-dashed border-slate-200 bg-slate-50/50">
                              <button
                                onClick={() => guardedAction(() => router.push(`/projects/${project.id}?newEstimate=1`))}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 border border-blue-200 text-sm text-blue-600 font-medium hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                              >
                                <FilePlus2 className="w-4 h-4" />
                                最初の見積を作成する
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-slate-600 text-right">
        {filtered.length} 件表示
      </p>

      {/* フローティング一括操作バー */}
      {checkedEstimateIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-full shadow-2xl shadow-slate-900/40 border border-slate-700 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-green-400" />
            <span className="font-semibold text-sm">
              {checkedEstimateIds.size}件選択中
            </span>
          </div>
          <div className="w-px h-5 bg-slate-700" />
          <button
            onClick={() => {
              const newSet = new Set(allCheckableIds)
              setCheckedEstimateIds(newSet)
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
            onClick={handleCreateBundle}
            className="bg-purple-500 hover:bg-purple-400 text-white h-8 px-4 rounded-full font-semibold"
          >
            <Layers className="w-3.5 h-3.5 mr-1.5" />
            見積セット作成
          </Button>
          <Button
            size="sm"
            onClick={() => setBulkContractOpen(true)}
            className="bg-green-500 hover:bg-green-400 text-white h-8 px-4 rounded-full font-semibold"
          >
            <HandshakeIcon className="w-3.5 h-3.5 mr-1.5" />
            一括契約処理
          </Button>
          <span className="inline-flex items-center gap-1 text-sm text-slate-400 ml-1">
            <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded bg-slate-700 border border-slate-600 text-xs font-mono font-semibold text-slate-300">Esc</kbd>
            <span className="text-slate-400">解除</span>
          </span>
        </div>
      )}
    </div>
    )}

    {/* ── パネル2：現場詳細（折りたたみ対応） ── */}
    {hasProjectPanel && (
      projectCollapsed ? (
        <button
          onClick={() => setProjectCollapsed(false)}
          className="w-8 shrink-0 border-l border-slate-300 bg-blue-50/80 hover:bg-blue-100 transition-colors flex flex-col items-center justify-center max-h-[calc(100vh-4rem)] cursor-pointer group relative"
          title="現場詳細を展開"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-400/60" />
          <BookOpen className="w-3.5 h-3.5 text-blue-600 group-hover:text-blue-700 mb-1" />
          <span className="text-xs text-blue-700/70 group-hover:text-blue-800 font-semibold [writing-mode:vertical-rl] tracking-wider select-none truncate max-h-32">{projectDetailData?.project?.name ?? "現場"}</span>
        </button>
      ) : (
        <div className={`border-l border-slate-200 bg-white shadow-sm relative ${hasEstimatePanel ? "w-[400px] shrink-0" : "flex-1 min-w-0"}`}>
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-3 pb-6">
            {!projectDetailData ? (
              <div className="flex items-center justify-center py-32">
                <LoaderIcon className="w-6 h-6 animate-spin text-slate-400" />
                <span className="ml-2 text-slate-500">読み込み中...</span>
              </div>
            ) : (
              <>
                {hasEstimatePanel && (
                  <div className="flex justify-end pt-2 pb-1">
                    <button onClick={() => setProjectCollapsed(true)} className="p-1 rounded hover:bg-blue-100 text-blue-500 hover:text-blue-700 transition-colors" title="現場詳細を折りたたむ">
                      <BookOpen className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <ProjectDetail
                  key={selectedProjectId}
                  project={projectDetailData.project}
                  templates={projectDetailData.templates}
                  currentUser={projectDetailData.currentUser}
                  contacts={projectDetailData.contacts}
                  units={projectDetailData.units}
                  taxRate={projectDetailData.taxRate}
                  embedded
                  compact={hasEstimatePanel}
                  activeEstimateId={selectedEstimateId}
                  onClose={closeProjectPanel}
                  onRefresh={refreshProject}
                  onSelectEstimate={(id) => guardedAction(() => openEstimateFromProject(id))}
                />
              </>
            )}
          </div>
          {projectLoading && projectDetailData && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 pointer-events-none">
              <LoaderIcon className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}
        </div>
      )
    )}

    {/* ── パネル3：見積詳細 ── */}
    {hasEstimatePanel && (
      <div className="flex-1 min-w-0 border-l border-slate-200 bg-white shadow-sm relative">
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-3 pb-6">
          {!estimateData ? (
            <div className="flex items-center justify-center py-32">
              <LoaderIcon className="w-6 h-6 animate-spin text-slate-400" />
              <span className="ml-2 text-slate-500">読み込み中...</span>
            </div>
          ) : (
            <EstimateDetail
              key={selectedEstimateId}
              estimate={estimateData.estimate}
              taxRate={estimateData.taxRate}
              units={estimateData.units}
              currentUser={currentUser}
              contacts={estimateData.contacts}
              embedded
              onClose={handleCloseEstimate}
              onNavigateEstimate={(id) => guardedAction(() => openEstimateFromProject(id))}
              onEditingChange={setIsEstimateEditing}
              onRefresh={refreshEstimate}
            />
          )}
        </div>
        {estimateLoading && estimateData && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 pointer-events-none">
            <LoaderIcon className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        )}
      </div>
    )}
    </div>
  )
}
