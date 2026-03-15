/**
 * [COMPONENT] 人員配置管理 - デスクトップビュー
 *
 * WorkerAssignmentView.tsx から分離されたデスクトップ専用の表示コンポーネント。
 * 全ての状態管理・ロジックは WorkerAssignmentView.tsx に残り、props 経由で受け取る。
 *
 * スクロール連動ヘッダー折りたたみ:
 * テーブルを下にスクロールすると WA-1（タイトル・統計・ナビ）と WA-2 のガントバーが
 * 上にスライドして隠れ、WA-2 の日付ヘッダー行だけが残る。
 */
"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import type { WorkerAssignmentViewProps } from "./WorkerAssignmentView"
import { WorkerAssignmentHeader } from "./WorkerAssignmentHeader"
import { WorkerAssignmentTable } from "./WorkerAssignmentTable"
import { SiteViewTable } from "./SiteViewTable"
import { UnassignedSchedulesBar } from "./UnassignedSchedulesBar"
import { AddAssignmentDialog } from "./AddAssignmentDialog"
import { AddScheduleDialog } from "./AddScheduleDialog"

const LEFT_COL_WIDTH = 160
const FALLBACK_COL_WIDTH = 180

export function WorkerAssignmentViewDesktop(props: WorkerAssignmentViewProps) {
  // コンテナ幅を計測して列幅を親で一元管理
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const el = props.mainContainerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [props.mainContainerRef])

  const effectiveLeftColWidth = props.viewMode === "site" ? 0 : LEFT_COL_WIDTH
  const dayColWidth = useMemo(() => {
    if (containerWidth <= 0) return FALLBACK_COL_WIDTH
    return Math.floor((containerWidth - effectiveLeftColWidth) / props.effectiveDisplayDays)
  }, [containerWidth, effectiveLeftColWidth, props.effectiveDisplayDays])

  // ── ヘッダー折りたたみ（テーブル縦スクロール連動） ──
  const headerWrapperRef = useRef<HTMLDivElement>(null)
  const headerInnerRef = useRef<HTMLDivElement>(null)
  const barWrapperRef = useRef<HTMLDivElement>(null)
  const verticalScrollRef = useRef<HTMLDivElement>(null)
  const lastHideRef = useRef(0)

  const recalcCollapse = useCallback(() => {
    const scrollEl = verticalScrollRef.current
    const wrapperEl = headerWrapperRef.current
    const innerEl = headerInnerRef.current
    const barEl = barWrapperRef.current
    if (!scrollEl || !wrapperEl || !innerEl || !barEl) return

    const scrollTop = scrollEl.scrollTop
    const totalHeight = innerEl.scrollHeight
    // WA-2（未配置バー全体）の開始位置 = WA-1 の高さ → ここまで隠す
    const maxHide = Math.max(barEl.offsetTop, 0)
    const hide = Math.min(Math.max(scrollTop, 0), maxHide)

    // 常に更新（lastHideRef チェックを外して確実に反映）
    lastHideRef.current = hide
    wrapperEl.style.height = `${totalHeight - hide}px`
    innerEl.style.transform = `translateY(-${hide}px)`
  }, [])

  // テーブルの縦スクロールでヘッダーを折りたたむ
  const handleVerticalScroll = useCallback(() => {
    recalcCollapse()
  }, [recalcCollapse])

  // 内部コンテンツのサイズ変更時（未配置バー折りたたみ等）に再計算
  // ※ 2フレーム後に再計算することで、DOM更新の反映を確実に待つ
  useEffect(() => {
    const el = headerInnerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      recalcCollapse()
      requestAnimationFrame(() => requestAnimationFrame(() => recalcCollapse()))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [recalcCollapse])

  return (
    <div ref={props.mainContainerRef} className="flex flex-col h-[calc(100vh-64px)]">
      {/* ヘッダーエリア（スクロール連動で折りたたみ） */}
      <div ref={headerWrapperRef} className="flex-shrink-0 overflow-hidden">
        <div ref={headerInnerRef}>
          <div className="relative pb-2">
            <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">WA-1</span>
            <WorkerAssignmentHeader
              viewMode={props.viewMode}
              rangeStart={props.rangeStart}
              displayDays={props.displayDays}
              onViewModeChange={props.onViewModeChange}
              onRangeStartChange={props.onRangeStartChange}
              onDisplayDaysChange={props.onDisplayDaysChange}
              onAddScheduleClick={props.onAddScheduleClick}
              stats={props.headerStats}
              selectedDate={props.selectedDate}
            />
          </div>

          {/* 未配置工程バー（スクロール時もこの全体が残る） */}
          <div ref={barWrapperRef} className="relative">
            <span className="absolute top-2 left-2 z-30 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">WA-2</span>
            <UnassignedSchedulesBar
              schedules={props.unassignedSchedules}
              rangeStart={props.rangeStart}
              displayDays={props.effectiveDisplayDays}
              expandedDateKeys={props.expandedDateKeys}
              leftColWidth={effectiveLeftColWidth}
              scrollRef={props.barScrollRef}
              onScroll={props.onBarScroll}
              unassignedByDate={props.unassignedByDate}
              onSelectDate={props.onSelectDate}
              dayColWidth={dayColWidth}
            />
          </div>
        </div>
      </div>

      {/* スクロールエリア: テーブル */}
      <div
        ref={verticalScrollRef}
        className="flex-1 overflow-y-auto min-h-0"
        onScroll={handleVerticalScroll}
      >
        {props.viewMode === "team" && (
          <div className="relative">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">WA-3</span>
          <WorkerAssignmentTable
            teams={props.teams}
            assignments={props.assignments}
            rangeStart={props.rangeStart}
            displayDays={props.effectiveDisplayDays}
            onAddClick={props.onAddClick}
            onDeleteAssignment={props.onDeleteAssignment}
            onRefresh={props.onRefresh}
            activeItem={props.activeItem}
            isDragging={props.isDragging}
            hoveredTeamId={props.hoveredTeamId}
            collapsedDates={props.collapsedDates}
            datesWithAssignments={props.datesWithAssignments}
            onToggleDate={props.onToggleDate}
            scrollRef={props.tableScrollRef}
            onScroll={props.onTableScroll}
            onCreateSplitTeam={props.onCreateSplitTeam}
            onRangeStartChange={props.onRangeStartChange}
            overflow={props.overflow}
            unassignedByDate={props.unassignedByDate}
            onSiteOpsClick={props.onSiteOpsClick}
            onTeamColorChange={props.onTeamColorChange}
            selectedDate={props.selectedDate}
            onSelectDate={props.onSelectDate}
            dayColWidth={dayColWidth}
          />
          </div>
        )}

        {props.viewMode === "site" && (
          <div className="relative">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">WA-4</span>
          <SiteViewTable
            teams={props.teams}
            assignments={props.assignments}
            rangeStart={props.rangeStart}
            displayDays={props.effectiveDisplayDays}
            onDeleteAssignment={props.onDeleteAssignment}
            onBulkDeleteTeamSchedule={props.onBulkDeleteTeamSchedule}
            onMoveTeamSchedule={props.onMoveTeamSchedule}
            onRefresh={props.onRefresh}
            activeItem={props.activeItem}
            isDragging={props.isDragging}
            hoveredTeamId={props.hoveredTeamId}
            collapsedDates={props.collapsedDates}
            datesWithAssignments={props.datesWithAssignments}
            onToggleDate={props.onToggleDate}
            scrollRef={props.tableScrollRef}
            onScroll={props.onTableScroll}
            onRangeStartChange={props.onRangeStartChange}
            overflow={props.overflow}
            unassignedByDate={props.unassignedByDate}
            onSiteOpsClick={props.onSiteOpsClick}
            selectedDate={props.selectedDate}
            onSelectDate={props.onSelectDate}
          />
          </div>
        )}

        {/* フッター情報 */}
        <div className="relative flex items-center justify-between text-xs text-slate-500 font-bold py-2">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">WA-5</span>
          <div className="flex items-center gap-4 ml-7">
            <span className="font-extrabold">凡例:</span>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-blue-50 border-2 border-blue-200" />
              <span>今日</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-slate-50 border-2 border-slate-200" />
              <span>土日</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-blue-100 border-2 border-blue-200" />
              <span>展開中</span>
            </div>
          </div>
          <span>{props.teams.length} 班 ・ {props.assignments.length} 件の配置</span>
        </div>
      </div>

      {/* 既存工程選択ダイアログ */}
      {props.dialogTarget && props.dialogTeam && (
        <AddAssignmentDialog
          open={props.dialogOpen}
          onClose={() => props.setDialogOpen(false)}
          onSubmit={props.onAddAssignment}
          targetDate={props.dialogTarget.date}
          targetTeam={props.dialogTeam}
          schedules={props.schedules}
          loadingSchedules={props.loadingSchedules}
          onNewScheduleClick={() => {
            props.setDialogOpen(false)
            props.handleAddScheduleFromCell(props.dialogTarget!.teamId, props.dialogTarget!.date)
          }}
        />
      )}

      {/* 新規現場（工程）追加ダイアログ */}
      <AddScheduleDialog
        open={props.scheduleDialogOpen}
        onClose={() => props.setScheduleDialogOpen(false)}
        onComplete={() => props.fetchData()}
        teams={props.teams}
        initialDate={props.scheduleDialogInitialDate}
        initialTeamId={props.scheduleDialogInitialTeamId}
      />
    </div>
  )
}
