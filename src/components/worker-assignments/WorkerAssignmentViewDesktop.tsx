/**
 * [COMPONENT] 人員配置管理 - デスクトップビュー
 *
 * WorkerAssignmentView.tsx から分離されたデスクトップ専用の表示コンポーネント。
 * 全ての状態管理・ロジックは WorkerAssignmentView.tsx に残り、props 経由で受け取る。
 */
"use client"

import type { WorkerAssignmentViewProps } from "./WorkerAssignmentView"
import { WorkerAssignmentHeader } from "./WorkerAssignmentHeader"
import { WorkerAssignmentTable } from "./WorkerAssignmentTable"
import { SiteViewTable } from "./SiteViewTable"
import { UnassignedSchedulesBar } from "./UnassignedSchedulesBar"
import { AddAssignmentDialog } from "./AddAssignmentDialog"
import { AddScheduleDialog } from "./AddScheduleDialog"

export function WorkerAssignmentViewDesktop(props: WorkerAssignmentViewProps) {
  return (
    <div ref={props.mainContainerRef} className="space-y-4">
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

      {/* 未配置工程バー */}
      <UnassignedSchedulesBar
        schedules={props.unassignedSchedules}
        rangeStart={props.rangeStart}
        displayDays={props.effectiveDisplayDays}
        expandedDateKeys={props.expandedDateKeys}
        leftColWidth={props.viewMode === "site" ? 0 : 160}
        scrollRef={props.barScrollRef}
        onScroll={props.onBarScroll}
      />

      {props.viewMode === "team" && (
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
        />
      )}

      {props.viewMode === "site" && (
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
      )}

      {/* フッター情報 */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span className="font-medium">凡例:</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-blue-50 border border-blue-200" />
            <span>今日</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-slate-50 border border-slate-200" />
            <span>土日</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-200" />
            <span>展開中</span>
          </div>
        </div>
        <span>{props.teams.length} 班 ・ {props.assignments.length} 件の配置</span>
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
