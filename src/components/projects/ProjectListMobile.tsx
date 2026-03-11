/**
 * [COMPONENT] 商談一覧 - モバイルビュー
 *
 * ProjectList.tsx から分離されたモバイル専用の表示コンポーネント。
 * 全ての状態管理・ロジックは ProjectList.tsx に残り、props 経由で受け取る。
 */
"use client"

import Link from "next/link"
import { formatCurrency, formatRelativeDate } from "@/lib/utils"
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
  X,
  MapPin,
} from "lucide-react"
import { Zap, Layers, EyeOff, RotateCcw } from "lucide-react"
import type { ProjectListViewProps } from "./ProjectList"
import type { EstimateStatus } from "@prisma/client"

// ── モバイル用見積サブ行 ──────────────────────────────────

function MobileEstimateSubRow({
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
    EST_TYPE_STYLE,
    checkedEstimateIds,
    toggleCheck,
    handleSelectEstimate,
    handleRestoreEstimate,
  } = props

  const typeTag = EST_TYPE_STYLE[est.estimateType]
  const displayName = est.title
    ?? (project.estimates.length === 1 ? null : `見積 ${estimateIndex + 1}`)
  const checkable = est.status === "CONFIRMED" || est.status === "SENT"
  const isChecked = checkedEstimateIds.has(est.id)
  const isHidden = est.isArchived

  // 非表示見積: 薄く表示 + 復元ボタン
  if (isHidden) {
    return (
      <div
        className={`flex items-center gap-3 px-3 py-3 ${
          !isLast ? "border-b border-slate-100" : ""
        } bg-slate-50/80 opacity-50`}
      >
        <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="text-sm text-slate-400 truncate flex-1">
          {displayName ?? "（無題）"}
        </span>
        <span className="text-xs text-slate-400 shrink-0">非表示</span>
        <button
          onClick={() => handleRestoreEstimate(est.id)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-blue-50 text-blue-600 font-medium hover:bg-blue-100 transition-colors shrink-0"
        >
          <RotateCcw className="w-3 h-3" />
          表示に戻す
        </button>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-3 px-3 py-3.5 active:bg-blue-50/50 transition-colors ${
        !isLast ? "border-b border-slate-100" : ""
      } ${isChecked ? "bg-green-50/60" : ""}`}
      onClick={() => handleSelectEstimate(est.id)}
    >
      {/* チェックボックス */}
      <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
        {checkable ? (
          <button
            onClick={() => toggleCheck(est.id)}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${isChecked ? "text-green-600" : "text-slate-300"}`}
          >
            {isChecked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
          </button>
        ) : (
          <div className="w-6" />
        )}
      </div>

      {/* メインコンテンツ */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${EST_STATUS_STYLE[est.status]}`}>
            {EST_STATUS_SHORT[est.status]}
          </span>
          <span className="text-base font-medium text-slate-800 truncate">{displayName ?? "（無題）"}</span>
          {typeTag && (
            <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${typeTag.className}`}>
              {typeTag.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="font-mono font-semibold text-slate-700">¥{formatCurrency(est.totalAmount)}</span>
          <span>{est.user.name}</span>
          {est.confirmedAt && (() => {
            const rel = formatRelativeDate(est.confirmedAt)
            return <span title={rel.absolute}>{rel.label}</span>
          })()}
        </div>
      </div>

      {/* 矢印 */}
      <ChevronRight className="w-5 h-5 shrink-0 text-slate-300" />
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────────

export function ProjectListMobile(props: ProjectListViewProps) {
  const {
    projects: _projects,
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
    selectedProjectId,
    handleSelectEstimate: _handleSelectEstimate,
    handleSelectProject,
    handleArchive,
    setContractDialogItems,
    setContractDialogMode,
    setContractDialogOpen,
    setBulkContractOpen,
    quickCreating,
    handleQuickCreateForProject,
    issikiTemplate,
    guardedAction,
    router,
    EST_STATUS_LABEL,
    EST_STATUS_STYLE: _EST_STATUS_STYLE,
    SITE_CATEGORY_STYLE,
    handleCreateBundle,
    // Dialogs are rendered in the parent
  } = props

  return (
    <div className="flex gap-0">
    <div className="flex-1 space-y-0">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-xl px-3 font-bold text-slate-900">商談一覧</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 pr-3">
          <Button size="sm" onClick={() => guardedAction(() => router.push("/projects/new"))}>
            <Plus className="w-4 h-4 mr-1" />
            新規
          </Button>
        </div>
      </div>

      {/* 検索・フィルター */}
      <div className="space-y-2 px-3 py-2">
        {/* 検索バー */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="w-4 h-4" />
          </Button>
          {/* 非表示見積の表示トグル */}
          <Button
            variant={showHiddenEstimates ? "default" : "outline"}
            size="sm"
            onClick={() => setShowHiddenEstimates(!showHiddenEstimates)}
            className={`h-9 px-2 ${showHiddenEstimates ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
            title={showHiddenEstimates ? "非表示の見積を隠す" : "非表示の見積を表示"}
          >
            <EyeOff className="w-4 h-4" />
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

        {/* タグフィルター（モバイル） */}
        <div className="space-y-2.5 py-1.5">
          {/* ── 状況タグ行 ── */}
          <div className="flex items-center gap-2">
            {(["DRAFT", "CONFIRMED", "SENT"] as EstimateStatus[]).map((s) => {
              const active = selectedStatuses.has(s)
              const mobileActiveStyle: Record<string, string> = {
                DRAFT: "bg-amber-500 text-white border-amber-500 shadow-amber-200",
                CONFIRMED: "bg-blue-500 text-white border-blue-500 shadow-blue-200",
                SENT: "bg-emerald-500 text-white border-emerald-500 shadow-emerald-200",
              }
              const mobileActiveDot: Record<string, string> = {
                DRAFT: "bg-white",
                CONFIRMED: "bg-white",
                SENT: "bg-white",
              }
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-all select-none border-2 ${
                    active
                      ? `${mobileActiveStyle[s]} shadow-md`
                      : "bg-white text-slate-500 border-slate-200"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${active ? mobileActiveDot[s] : "bg-slate-300"}`} />
                  {EST_STATUS_LABEL[s]}
                </button>
              )
            })}
          </div>

          {/* ── 担当者タグ行 ── */}
          {allUsers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 tracking-wide shrink-0">担当</span>
              <div className="flex items-center gap-1.5 flex-1">
                {allUsers.map(({ id, name }) => {
                  const active = selectedUsers.has(id)
                  return (
                    <button
                      key={id}
                      onClick={() => toggleUser(id)}
                      title={name}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all select-none border-2 ${
                        active
                          ? "bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-200"
                          : "bg-white text-slate-500 border-slate-200"
                      }`}
                    >
                      {name.slice(0, 3)}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* リセット */}
          {(selectedStatuses.size > 0 || selectedUsers.size > 0) && (
            <button
              onClick={() => { setSelectedStatuses(new Set()); setSelectedUsers(new Set()) }}
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold transition-all active:scale-[0.98]"
            >
              <X className="w-4 h-4" />
              フィルター解除
            </button>
          )}
        </div>
      </div>

      {/* 一覧 */}
      {filtered.length === 0 ? (
        <div className="bg-white py-16 text-center text-slate-400">
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
        <div className="space-y-0">
          {grouped.map(({ companyId, companyName, projects: companyProjects }) => {
            const isCompanyCollapsed = collapsedCompanies.has(companyId)
            const totalEstimates = companyProjects.reduce((s, p) => s + p.estimates.length, 0)

            return (
              <div key={companyId} className="bg-white overflow-hidden">
                {/* 会社名ヘッダー */}
                <button
                  onClick={() => toggleCompany(companyId)}
                  className="w-full flex items-center gap-2 px-3 py-3 bg-slate-800 text-white text-left hover:bg-slate-700 transition-colors"
                >
                  {isCompanyCollapsed ? (
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 flex-shrink-0" />
                  )}
                  <Building2 className="w-4 h-4 flex-shrink-0 text-slate-300" />
                  <span className="text-base font-semibold truncate" title={companyName}>{companyName}</span>
                  <span className="ml-auto text-sm text-slate-400 font-normal shrink-0">
                    {companyProjects.length}現場 / {totalEstimates}件
                  </span>
                </button>

                {!isCompanyCollapsed && (
                  <div>
                    {companyProjects.map((project, pIdx) => {
                      const isProjectCollapsed = collapsedProjects.has(project.id)
                      const isLastProject = pIdx === companyProjects.length - 1

                      return (
                        <div
                          key={project.id}
                          className={!isLastProject ? "border-b border-slate-200" : ""}
                        >
                          {/* 現場ヘッダー行 */}
                          <div className="flex items-center gap-2 px-3 py-3 bg-slate-50/70 hover:bg-slate-100/80 transition-colors">
                            {/* 展開ボタン */}
                            <div className="flex-shrink-0">
                              {project.estimates.length > 0 ? (
                                <button
                                  onClick={() => toggleProject(project.id)}
                                  title={isProjectCollapsed ? "見積を表示" : "見積を隠す"}
                                  className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                                    isProjectCollapsed
                                      ? "bg-slate-200 text-slate-600 hover:bg-blue-500 hover:text-white"
                                      : "bg-blue-500 text-white hover:bg-blue-600"
                                  }`}
                                >
                                  {isProjectCollapsed ? (
                                    <ChevronRight className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              ) : <div className="w-7" />}
                            </div>

                            {/* 現場名 */}
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <button
                                onClick={() => handleSelectProject(project.id)}
                                className="group inline-flex items-center gap-1 min-w-0"
                              >
                                <span className={`font-bold group-hover:text-blue-600 transition-colors truncate text-sm ${selectedProjectId === project.id ? "text-blue-600" : "text-slate-800"}`} title={project.name}>
                                  {project.name}
                                </span>
                                <ChevronRight className="w-3 h-3 shrink-0 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                              </button>
                            </div>

                            {/* 見積件数バッジ */}
                            <button
                              onClick={() => toggleProject(project.id)}
                              className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-sm rounded-full bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
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
                              {project.estimates
                                .filter((est) => showHiddenEstimates || !est.isArchived)
                                .map((est, eIdx, filteredEst) => (
                                <MobileEstimateSubRow
                                  key={est.id}
                                  est={est}
                                  project={project}
                                  isLast={eIdx === filteredEst.length - 1}
                                  estimateIndex={eIdx}
                                  props={props}
                                />
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
        <div className="space-y-0">
          {siteGrouped.map(({ category, label, projects: catProjects }) => {
            const style = SITE_CATEGORY_STYLE[category]
            const isCatCollapsed = collapsedCategories.has(category)
            const totalEstimates = catProjects.reduce((s, p) => s + p.estimates.length, 0)

            return (
              <div key={category}>
                {/* カテゴリヘッダー */}
                <button
                  onClick={() => toggleCategory(category)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 ${style.bg} border border-x-0 border-slate-200 text-left hover:brightness-95 transition-all`}
                >
                  {isCatCollapsed ? (
                    <ChevronRight className={`w-4 h-4 ${style.text}`} />
                  ) : (
                    <ChevronDown className={`w-4 h-4 ${style.text}`} />
                  )}
                  <span className={`font-bold text-base ${style.text}`}>{label}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${style.badge}`}>
                    {catProjects.length}現場{totalEstimates > 0 && ` / ${totalEstimates}件`}
                  </span>
                </button>

                {/* カテゴリ内の現場カード */}
                {!isCatCollapsed && (
                  <div className="space-y-0">
                    {catProjects.map((project) => {
                      const isProjectCollapsed = collapsedProjects.has(project.id)
                      const companyName = project.branch.company.name

                      return (
                        <div key={project.id} className="bg-white overflow-hidden">
                          {/* 企業名ヘッダー（黒帯） */}
                          <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 text-white">
                            <Building2 className="w-4 h-4 flex-shrink-0 text-slate-300" />
                            <span className="text-base font-semibold truncate" title={companyName}>{companyName}</span>
                          </div>

                          {/* 現場ヘッダー行 */}
                          <div className="flex items-center gap-2 px-3 py-3 bg-slate-50/70 hover:bg-slate-100/80 transition-colors">
                            {/* 展開ボタン */}
                            <div className="flex-shrink-0">
                              {project.estimates.length > 0 ? (
                                <button
                                  onClick={() => toggleProject(project.id)}
                                  title={isProjectCollapsed ? "見積を表示" : "見積を隠す"}
                                  className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                                    isProjectCollapsed
                                      ? "bg-slate-200 text-slate-600 hover:bg-blue-500 hover:text-white"
                                      : "bg-blue-500 text-white hover:bg-blue-600"
                                  }`}
                                >
                                  {isProjectCollapsed ? (
                                    <ChevronRight className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              ) : <div className="w-7" />}
                            </div>

                            {/* 現場名 */}
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <button
                                onClick={() => handleSelectProject(project.id)}
                                className="group inline-flex items-center gap-1 min-w-0"
                              >
                                <span className={`font-bold group-hover:text-blue-600 transition-colors truncate text-sm ${selectedProjectId === project.id ? "text-blue-600" : "text-slate-800"}`} title={project.name}>
                                  {project.name}
                                </span>
                                <ChevronRight className="w-3 h-3 shrink-0 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                              </button>
                            </div>

                            {/* 見積件数バッジ */}
                            <button
                              onClick={() => toggleProject(project.id)}
                              className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-sm rounded-full bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
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
                              {project.estimates
                                .filter((est) => showHiddenEstimates || !est.isArchived)
                                .map((est, eIdx, filteredEst) => (
                                <MobileEstimateSubRow
                                  key={est.id}
                                  est={est}
                                  project={project}
                                  isLast={eIdx === filteredEst.length - 1}
                                  estimateIndex={eIdx}
                                  props={props}
                                />
                              ))}
                            </div>
                          )}

                          {/* 見積なしの場合 */}
                          {!isProjectCollapsed && project.estimates.filter((e) => showHiddenEstimates || !e.isArchived).length === 0 && (
                            <div className="pl-6 pr-3 py-3 border-t border-dashed border-slate-200 bg-slate-50/50">
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
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 text-white px-3 py-2 rounded-full shadow-2xl shadow-slate-900/40 border border-slate-700 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-green-400" />
            <span className="font-semibold text-xs">
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
            セット
          </Button>
          <Button
            size="sm"
            onClick={() => setBulkContractOpen(true)}
            className="bg-green-500 hover:bg-green-400 text-white h-8 px-4 rounded-full font-semibold"
          >
            <HandshakeIcon className="w-3.5 h-3.5 mr-1.5" />
            一括契約
          </Button>
        </div>
      )}
    </div>
    </div>
  )
}
