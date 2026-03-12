/**
 * [COMPONENT] 人員配置管理 - 班ビューテーブル
 *
 * 左列に班名・カラー、右側に14日分の日付セルを表示。
 * - 日付列クリックで全班のセルが一斉に展開・折りたたみ
 * - 展開セルに現場カード表示（班カラー、現場名、金額、工期）
 * - 現場カードクリックで詳細パネル（職人・車両管理）
 * - 「+ 現場を追加」ボタン
 * - 「+ 行を追加」ボタンで同じ班に行を追加
 * - @dnd-kit によるドラッグ&ドロップ（現場カード・職人カード）
 */
"use client"

import { useState, useMemo, useCallback, useRef, useLayoutEffect, useEffect } from "react"
import { format, eachDayOfInterval, addDays, isSameDay, isWeekend } from "date-fns"
import { ja } from "date-fns/locale"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { Plus, X, ChevronDown, ChevronRight, ClipboardList, Pencil, Check, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { AssignmentDetailPanel, type CopyableSourceInfo } from "./AssignmentDetailPanel"
import { TeamVehicleSection } from "./TeamVehicleSection"
import { OverflowIndicator, type OverflowData } from "./OverflowIndicator"
import type { TeamData, AssignmentData, TeamRow, DragItemData, SiteCardDragData, SiteCardDropData, TeamCellDropData, UnassignedBarDragData, WorkerBusyInfo } from "./types"
import { workTypeLabel, workTypeColor } from "./types"

interface Props {
  teams: TeamData[]
  assignments: AssignmentData[]
  rangeStart: Date
  displayDays: number
  onAddClick: (teamId: string, date: Date) => void
  onDeleteAssignment: (assignmentId: string) => void
  onRefresh: () => void
  activeItem: DragItemData | null
  isDragging: boolean
  hoveredTeamId: string | null
  collapsedDates: Set<string>
  datesWithAssignments: Set<string>
  onToggleDate: (dateKey: string) => void
  scrollRef?: React.RefObject<HTMLDivElement | null>
  onScroll?: () => void
  onCreateSplitTeam?: (scheduleId: string, currentTeamId: string, dateKey: string) => void
  onRangeStartChange?: (date: Date) => void
  overflow?: OverflowData
  unassignedByDate?: Map<string, number>
  onSiteOpsClick?: (schedule: AssignmentData["schedule"]) => void
  onTeamColorChange?: (teamId: string, color: string) => void
  selectedDate?: string | null
  onSelectDate?: (dateKey: string) => void
}

const LEFT_COL_WIDTH = 160
const FALLBACK_COL_WIDTH = 180
const SPANNING_CARD_HEIGHT = 56
const DAY_OF_WEEK_SHORT = ["日", "月", "火", "水", "木", "金", "土"]

/** 班カラーパレット */
const TEAM_COLOR_PALETTE = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#f97316", // orange
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#94a3b8", // slate (default)
  "#78716c", // stone
]

/** 丸数字（分割現場のサフィックス） */
const CIRCLE_NUMBERS = ["①", "②", "③", "④", "⑤"]

/** 分割現場のリンクカラーパレット */
const SPLIT_LINK_COLORS = [
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#10b981", // emerald
]

function formatAmount(amount: string) {
  const n = Number(amount)
  if (isNaN(n)) return ""
  return `¥${n.toLocaleString()}`
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "日程未定"
  const s = format(new Date(start), "M/d", { locale: ja })
  const e = end ? format(new Date(end), "M/d", { locale: ja }) : s
  return `${s}〜${e}`
}

/** 会社名ごとにくっきりした色を割り当てるパレット */
const COMPANY_COLORS = [
  "#2563eb", // 青
  "#dc2626", // 赤
  "#059669", // 緑
  "#7c3aed", // 紫
  "#d97706", // 橙
  "#0891b2", // 水色
  "#be185d", // ピンク
  "#4338ca", // 藍
  "#15803d", // 深緑
  "#b91c1c", // 暗赤
  "#7e22ce", // 濃紫
  "#0369a1", // 濃青
]

/** 会社名→色のマッピングキャッシュ */
const companyColorCache = new Map<string, string>()

function getCompanyColor(companyName: string): string {
  if (companyColorCache.has(companyName)) return companyColorCache.get(companyName)!
  const idx = companyColorCache.size % COMPANY_COLORS.length
  const color = COMPANY_COLORS[idx]
  companyColorCache.set(companyName, color)
  return color
}

/** 指定日にこの配置が有効かどうかを判定（assignedDate / excludedDates 考慮） */
function isDateInScheduleRange(date: Date, assignment: AssignmentData): boolean {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)

  // assignedDate がある場合: その日だけ有効
  if (assignment.assignedDate) {
    const ad = new Date(assignment.assignedDate)
    ad.setHours(0, 0, 0, 0)
    return d.getTime() === ad.getTime()
  }

  // 通常: スケジュール範囲でチェック
  const start = assignment.schedule.plannedStartDate
    ? new Date(assignment.schedule.plannedStartDate)
    : null
  const end = assignment.schedule.plannedEndDate
    ? new Date(assignment.schedule.plannedEndDate)
    : null
  if (!start) return false
  const endDate = end ?? start
  const s = new Date(start)
  s.setHours(0, 0, 0, 0)
  const e = new Date(endDate)
  e.setHours(0, 0, 0, 0)
  if (d < s || d > e) return false

  // excludedDates チェック
  if (assignment.excludedDates?.length) {
    for (const excl of assignment.excludedDates) {
      const ed = new Date(excl)
      ed.setHours(0, 0, 0, 0)
      if (d.getTime() === ed.getTime()) return false
    }
  }

  return true
}

/** 同じ schedule+team のアサイン群をグループ化 */
interface ScheduleGroup {
  scheduleId: string
  scheduleName: string | null
  projectName: string
  companyName: string
  address: string | null
  workType: string
  totalAmount: string
  plannedStartDate: string | null
  plannedEndDate: string | null
  assignments: AssignmentData[]
}

function groupBySchedule(assignments: AssignmentData[]): ScheduleGroup[] {
  const map = new Map<string, ScheduleGroup>()
  for (const a of assignments) {
    const key = a.scheduleId
    if (!map.has(key)) {
      map.set(key, {
        scheduleId: a.scheduleId,
        scheduleName: a.schedule.name,
        projectName: a.schedule.contract.project.name,
        companyName: a.schedule.contract.project.branch.company.name,
        address: a.schedule.contract.project.address,
        workType: a.schedule.workType,
        totalAmount: a.schedule.contract.totalAmount,
        plannedStartDate: a.schedule.plannedStartDate,
        plannedEndDate: a.schedule.plannedEndDate,
        assignments: [],
      })
    }
    map.get(key)!.assignments.push(a)
  }
  return Array.from(map.values())
}

// ── DnD サブコンポーネント ──

/** ドラッグ可能＆ドロップ可能な現場カードのラッパー */
function DraggableSiteCard({
  id,
  data,
  dropData,
  children,
  activeDragType,
}: {
  id: string
  data: SiteCardDragData
  dropData: SiteCardDropData
  children: React.ReactNode
  activeDragType?: string
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id, data })
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `site-drop:${data.scheduleId}:${data.teamId}:${data.dateKey}`,
    data: dropData,
  })
  const showSwapHighlight = isOver && activeDragType === "site-card"
  return (
    <div
      ref={(node) => { setDragRef(node); setDropRef(node) }}
      style={isDragging ? { opacity: 0.3 } : undefined}
      className={cn(showSwapHighlight && "ring-2 ring-orange-400 rounded-sm")}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  )
}

/** ドロップ可能なチームセル（展開時のみ使用） */
function DroppableTeamCell({
  id,
  data,
  children,
  activeDragType,
  activeDragDateKey,
  isInDragDateRange,
}: {
  id: string
  data: TeamCellDropData
  children: React.ReactNode
  activeDragType?: string
  activeDragDateKey?: string
  /** 未配置バードラッグ中、このセルが工程の日付範囲内 & ホバー中チーム */
  isInDragDateRange?: boolean
}) {
  const { isOver, setNodeRef } = useDroppable({ id, data })
  const isDirectHover =
    isOver && (
      (activeDragType === "site-card" && activeDragDateKey === data.dateKey) ||
      activeDragType === "unassigned-bar"
    )
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-full",
        // ドラッグ中: ホバー中チームの日付範囲セルを緑ハイライト
        isInDragDateRange && !isDirectHover && "ring-2 ring-emerald-400 ring-inset rounded bg-emerald-50/40",
        // 直接ホバー中のセル: より強いハイライト
        isDirectHover && "ring-2 ring-emerald-500 ring-inset rounded bg-emerald-100/60",
      )}
    >
      {children}
    </div>
  )
}

// ── メインコンポーネント ──

export function WorkerAssignmentTable({
  teams,
  assignments,
  rangeStart,
  displayDays,
  onAddClick,
  onDeleteAssignment,
  onRefresh,
  activeItem,
  isDragging,
  hoveredTeamId,
  collapsedDates,
  datesWithAssignments,
  onToggleDate,
  scrollRef,
  onScroll,
  onCreateSplitTeam,
  onRangeStartChange,
  overflow,
  unassignedByDate,
  onSiteOpsClick,
  onTeamColorChange,
  selectedDate,
  onSelectDate,
}: Props) {
  const [extraRows, setExtraRows] = useState<Map<string, number>>(new Map())
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editTeamName, setEditTeamName] = useState("")
  const [savingTeam, setSavingTeam] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // 班名保存
  async function handleSaveTeamName(teamId: string) {
    if (!editTeamName.trim()) return
    setSavingTeam(true)
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editTeamName.trim() }),
      })
      if (!res.ok) throw new Error()
      toast.success("班名を更新しました")
      setEditingTeamId(null)
      onRefresh()
    } catch {
      toast.error("班名の更新に失敗しました")
    } finally {
      setSavingTeam(false)
    }
  }

  // コンテナ幅を計測して日付列幅を動的に決定
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ドラッグ中の工程の日付範囲を計算（未配置バー・現場カード共通）
  const dragDateRange = useMemo(() => {
    if (!activeItem) return null
    if (activeItem.type === "unassigned-bar") {
      const d = activeItem as UnassignedBarDragData
      if (!d.plannedStartDate) return null
      return { start: d.plannedStartDate.slice(0, 10), end: (d.plannedEndDate ?? d.plannedStartDate).slice(0, 10) }
    }
    if (activeItem.type === "site-card") {
      const d = activeItem as SiteCardDragData
      if (!d.plannedStartDate) return null
      return { start: d.plannedStartDate.slice(0, 10), end: (d.plannedEndDate ?? d.plannedStartDate).slice(0, 10) }
    }
    return null
  }, [activeItem])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: addDays(rangeStart, displayDays - 1) }),
    [rangeStart, displayDays]
  )

  const dayColWidth = containerWidth > 0
    ? Math.floor((containerWidth - LEFT_COL_WIDTH) / days.length)
    : FALLBACK_COL_WIDTH

  const assignmentsByTeam = useMemo(() => {
    const map = new Map<string, AssignmentData[]>()
    for (const a of assignments) {
      const list = map.get(a.teamId) ?? []
      list.push(a)
      map.set(a.teamId, list)
    }
    return map
  }, [assignments])

  /** 日付ごとの「職人ID → 配置情報（現場名等）」Map */
  const busyWorkerInfoByDate = useMemo(() => {
    const map = new Map<string, Map<string, WorkerBusyInfo>>()
    for (const day of days) {
      const dk = format(day, "yyyy-MM-dd")
      const infoMap = new Map<string, WorkerBusyInfo>()
      for (const a of assignments) {
        if (a.workerId && isDateInScheduleRange(day, a)) {
          const existing = infoMap.get(a.workerId)
          const siteName = a.schedule?.name
            || a.schedule?.contract?.project?.name
            || "不明"
          if (existing) {
            if (!existing.siteNames.includes(siteName)) {
              existing.siteNames.push(siteName)
            }
          } else {
            infoMap.set(a.workerId, { siteNames: [siteName] })
          }
        }
      }
      map.set(dk, infoMap)
    }
    return map
  }, [assignments, days])

  /**
   * チームごとに工程を「レーン（行）」に振り分ける。
   * - 日程が重ならない工程は同じレーンに入れて行数を最小化
   * - 同じ現場は必ず同じレーン（行位置）に表示される
   * - 開始日順でソートし、空いているレーンの上から詰める
   */
  const teamLaneAssignment = useMemo(() => {
    const result = new Map<string, { laneCount: number; scheduleToLane: Map<string, number> }>()
    for (const team of teams) {
      const teamAssigns = assignmentsByTeam.get(team.id) ?? []
      // 全展開日で登場する工程を収集（日付範囲付き）
      const schedMap = new Map<string, { scheduleId: string; start: string; end: string }>()
      for (const day of days) {
        const dateKey = format(day, "yyyy-MM-dd")
        const isExpanded = datesWithAssignments.has(dateKey) && !collapsedDates.has(dateKey)
        if (!isExpanded) continue
        const dayAssigns = teamAssigns.filter((a) => isDateInScheduleRange(day, a))
        const groups = groupBySchedule(dayAssigns)
        for (const g of groups) {
          if (!schedMap.has(g.scheduleId)) {
            schedMap.set(g.scheduleId, {
              scheduleId: g.scheduleId,
              start: (g.plannedStartDate ?? "9999").slice(0, 10),
              end: (g.plannedEndDate ?? g.plannedStartDate ?? "9999").slice(0, 10),
            })
          }
        }
      }
      // 開始日順でソート
      const sorted = Array.from(schedMap.values()).sort((a, b) => a.start.localeCompare(b.start))
      // 貪欲法: 空いている一番上のレーンに詰める
      const laneEnds: string[] = [] // laneEnds[i] = そのレーンに最後に入った工程の終了日
      const scheduleToLane = new Map<string, number>()
      for (const sched of sorted) {
        let lane = -1
        for (let i = 0; i < laneEnds.length; i++) {
          if (laneEnds[i] < sched.start) { // 重なりなし → このレーンに入れる
            lane = i
            break
          }
        }
        if (lane === -1) { // 空きなし → 新レーン追加
          lane = laneEnds.length
          laneEnds.push("")
        }
        laneEnds[lane] = sched.end
        scheduleToLane.set(sched.scheduleId, lane)
      }
      result.set(team.id, { laneCount: laneEnds.length, scheduleToLane })
    }
    return result
  }, [teams, assignmentsByTeam, days, collapsedDates, datesWithAssignments])

  // ── ガントバー位置計算 ──
  const dayWidths = useMemo(() => {
    return days.map(() => dayColWidth)
  }, [days, dayColWidth])

  const dayCumulativeLeft = useMemo(() => {
    const result: number[] = [0]
    for (let i = 0; i < dayWidths.length; i++) {
      result.push(result[i] + dayWidths[i])
    }
    return result
  }, [dayWidths])

  // 複数班に存在する scheduleId を検出（分割現場）
  const multiTeamSchedules = useMemo(() => {
    const schedTeams = new Map<string, Set<string>>()
    for (const a of assignments) {
      if (!schedTeams.has(a.scheduleId)) schedTeams.set(a.scheduleId, new Set())
      schedTeams.get(a.scheduleId)!.add(a.teamId)
    }
    const result = new Map<string, string[]>()
    for (const [schedId, teamSet] of schedTeams) {
      if (teamSet.size >= 2) result.set(schedId, [...teamSet])
    }
    return result
  }, [assignments])

  // 分割現場ごとのリンクカラーを割り当て
  const splitLinkColorMap = useMemo(() => {
    const map = new Map<string, string>()
    let idx = 0
    for (const schedId of multiTeamSchedules.keys()) {
      map.set(schedId, SPLIT_LINK_COLORS[idx % SPLIT_LINK_COLORS.length])
      idx++
    }
    return map
  }, [multiTeamSchedules])

  /** チームごとのガントバー位置データ（2日以上の工程のみ） */
  const teamBarData = useMemo(() => {
    const result = new Map<string, Array<{
      scheduleId: string
      scheduleName: string
      companyName: string
      left: number
      width: number
      lane: number
      startIdx: number
      endIdx: number
      firstExpandedIdx: number
    }>>()

    for (const team of teams) {
      const laneInfo = teamLaneAssignment.get(team.id)
      if (!laneInfo || laneInfo.laneCount === 0) continue

      const teamAssigns = assignmentsByTeam.get(team.id) ?? []
      const schedInfoMap = new Map<string, {
        scheduleName: string
        companyName: string
        startDate: string | null
        endDate: string | null
      }>()
      for (const a of teamAssigns) {
        if (!schedInfoMap.has(a.scheduleId)) {
          schedInfoMap.set(a.scheduleId, {
            scheduleName: a.schedule.name ?? a.schedule.contract.project.name,
            companyName: a.schedule.contract.project.branch.company.name,
            startDate: a.schedule.plannedStartDate,
            endDate: a.schedule.plannedEndDate,
          })
        }
      }

      const bars: typeof result extends Map<string, infer V> ? V : never = []

      for (const [schedId, info] of schedInfoMap) {
        const lane = laneInfo.scheduleToLane.get(schedId)
        if (lane === undefined) continue
        if (!info.startDate) continue

        let startIdx = -1
        let endIdx = -1
        const s = new Date(info.startDate)
        s.setHours(0, 0, 0, 0)
        const e = info.endDate ? new Date(info.endDate) : new Date(info.startDate)
        e.setHours(0, 0, 0, 0)

        for (let i = 0; i < days.length; i++) {
          const d = new Date(days[i])
          d.setHours(0, 0, 0, 0)
          if (d >= s && d <= e) {
            if (startIdx === -1) startIdx = i
            endIdx = i
          }
        }
        if (startIdx === -1) continue
        if (endIdx <= startIdx) continue

        // 最初の展開日を探す
        let firstExpandedIdx = -1
        for (let i = startIdx; i <= endIdx; i++) {
          const dk = format(days[i], "yyyy-MM-dd")
          if (datesWithAssignments.has(dk) && !collapsedDates.has(dk)) {
            firstExpandedIdx = i
            break
          }
        }

        const left = dayCumulativeLeft[startIdx]
        const width = dayCumulativeLeft[endIdx + 1] - dayCumulativeLeft[startIdx]

        bars.push({ scheduleId: schedId, scheduleName: info.scheduleName, companyName: info.companyName, left, width, lane, startIdx, endIdx, firstExpandedIdx })
      }

      if (bars.length > 0) {
        result.set(team.id, bars)
      }
    }

    return result
  }, [teams, teamLaneAssignment, assignmentsByTeam, days, dayCumulativeLeft, datesWithAssignments, collapsedDates])

  // toggleCard は不要（詳細パネル常時展開）

  /**
   * レーン高さ同期: 全日付列にまたがって同じチーム・同じレーンの高さを揃える。
   * スペーサー（空きレーン）もカードと同じ高さになるので、横一列に完全に揃う。
   */
  useLayoutEffect(() => {
    const container = tableRef.current
    if (!container) return

    // 1. 全レーンセルの min-height をリセット（自然な高さに戻す）
    const allCells = container.querySelectorAll<HTMLElement>('[data-lane-sync]')
    allCells.forEach((el) => {
      el.style.minHeight = ''
    })

    // 2. 自然な高さを測定し、チーム+レーン ごとにグルーピング
    const groups = new Map<string, { maxHeight: number; elements: HTMLElement[] }>()
    allCells.forEach((el) => {
      const key = el.getAttribute('data-lane-sync')!
      if (!groups.has(key)) {
        groups.set(key, { maxHeight: 0, elements: [] })
      }
      const g = groups.get(key)!
      g.elements.push(el)
      const h = el.scrollHeight
      if (h > g.maxHeight) g.maxHeight = h
    })

    // 3. 各グループ内の全セルに最大高さを適用
    groups.forEach(({ maxHeight, elements }) => {
      if (maxHeight > 0) {
        elements.forEach((el) => {
          el.style.minHeight = `${maxHeight}px`
        })
      }
    })
  })

  const addRow = useCallback((teamId: string) => {
    setExtraRows((prev) => {
      const next = new Map(prev)
      next.set(teamId, (next.get(teamId) ?? 0) + 1)
      return next
    })
  }, [])

  const removeRow = useCallback((teamId: string) => {
    setExtraRows((prev) => {
      const next = new Map(prev)
      const count = next.get(teamId) ?? 0
      if (count <= 1) next.delete(teamId)
      else next.set(teamId, count - 1)
      return next
    })
  }, [])

  function getTeamRows(teamId: string): TeamRow[] {
    const extra = extraRows.get(teamId) ?? 0
    const rows: TeamRow[] = [{ teamId, rowIndex: 0 }]
    for (let i = 1; i <= extra; i++) {
      rows.push({ teamId, rowIndex: i })
    }
    return rows
  }

  const hasAnyExpanded = [...datesWithAssignments].some((dk) => !collapsedDates.has(dk))

  const leftOverflowCount = overflow?.left.count ?? 0
  const leftItems = overflow?.left.items ?? []
  const rightOverflowCount = overflow?.right.count ?? 0
  const rightItems = overflow?.right.items ?? []

  return (
      <div ref={wrapperRef} className="bg-white border-2 border-slate-300 rounded-sm overflow-hidden relative pb-1">
        {onRangeStartChange && (
          <>
            <OverflowIndicator side="left" count={leftOverflowCount} items={leftItems} onNavigate={onRangeStartChange} />
            <OverflowIndicator side="right" count={rightOverflowCount} items={rightItems} onNavigate={onRangeStartChange} />
          </>
        )}
        <div ref={scrollRef} onScroll={onScroll}>
          <div ref={tableRef}>
            {/* 日付ヘッダー */}
            <div className="flex border-b-2 border-slate-300 sticky top-0 z-10 bg-white">
              <div
                className="flex-shrink-0 px-3 py-2 border-r border-slate-200 border-l-4 border-l-slate-300 bg-slate-50 flex items-center sticky left-0 z-20"
                style={{ width: LEFT_COL_WIDTH }}
              >
                <span className="text-sm font-bold text-slate-700">班名</span>
              </div>

              {days.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd")
                const isExpanded = datesWithAssignments.has(dateKey) && !collapsedDates.has(dateKey)
                const isToday = isSameDay(day, today)
                const isWknd = isWeekend(day)
                const dow = day.getDay()
                const isSelected = selectedDate === dateKey

                return (
                  <div
                    key={dateKey}
                    className={cn(
                      "px-1 py-1.5 text-center border-r border-slate-100 last:border-r-0 cursor-pointer select-none transition-all duration-200",
                      isSelected && "bg-orange-100 border-b-2 border-orange-400",
                      !isSelected && isExpanded && "bg-blue-100/60",
                      !isSelected && isToday && !isExpanded && "bg-blue-50",
                      !isSelected && !isToday && !isExpanded && dow === 6 && "bg-blue-50/50",
                      !isSelected && !isToday && !isExpanded && dow === 0 && "bg-red-50/50",
                      !isSelected && isToday && "border-b-2 border-blue-500"
                    )}
                    style={{
                      width: dayColWidth,
                      minWidth: dayColWidth,
                      flexShrink: 0,
                    }}
                    onClick={() => {
                      onSelectDate?.(dateKey)
                    }}
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      {datesWithAssignments.has(dateKey) ? (
                        isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-blue-500" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        )
                      ) : null}
                      <span className={cn("text-xs", isToday ? "text-blue-600 font-bold" : !datesWithAssignments.has(dateKey) ? "text-slate-500" : "text-slate-600")}>{format(day, "M/d")}</span>
                    </div>
                    <div
                      className={cn(
                        "text-sm font-bold",
                        dow === 0 && "text-red-500",
                        dow === 6 && "text-blue-500",
                        dow !== 0 && dow !== 6 && "text-slate-700"
                      )}
                    >
                      {DAY_OF_WEEK_SHORT[dow]}
                    </div>
                    {(unassignedByDate?.get(dateKey) ?? 0) > 0 && (
                      <div className="mt-0.5">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                          未{unassignedByDate!.get(dateKey)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 班ごとの行 */}
            {teams.length === 0 ? (
              <div className="text-center py-16 text-slate-600">
                <span className="text-sm">表示する班がありません</span>
              </div>
            ) : (
              teams.map((team, teamIdx) => {
                const teamAssignments = assignmentsByTeam.get(team.id) ?? []
                const rows = getTeamRows(team.id)
                const isLastTeam = teamIdx === teams.length - 1

                const teamColor = team.colorCode ?? "#94a3b8"
                return (
                  <div
                    key={team.id}
                    className={cn(
                      "relative",
                      !isLastTeam && "border-b border-slate-200"
                    )}
                  >
                    {rows.map((row) => {
                      const isMainRow = row.rowIndex === 0
                      const rowHasAssignment = false
                      const teamBars = isMainRow ? (teamBarData.get(team.id) ?? []) : []

                      return (
                        <div
                          key={`${team.id}-${row.rowIndex}`}
                          className="flex hover:bg-slate-50/30 transition-colors"
                        >
                          {/* 班名列 */}
                          <div
                            className="flex-shrink-0 border-r border-slate-200 sticky left-0 z-10 overflow-hidden"
                            style={{
                              width: LEFT_COL_WIDTH,
                              minHeight: hasAnyExpanded ? 80 : 64,
                            }}
                          >
                          <div
                            className="h-full px-3 py-3"
                            style={{
                              borderLeft: `5px solid ${teamColor}`,
                              background: isMainRow
                                ? `linear-gradient(90deg, ${teamColor}40 0%, ${teamColor}20 60%, transparent 100%)`
                                : `linear-gradient(90deg, ${teamColor}25 0%, ${teamColor}10 50%, transparent 100%)`,
                            }}
                          >
                            {isMainRow ? (
                              <div className="relative">
                                {/* 班名 + 編集ボタン */}
                                <div className="flex items-center gap-1.5 group/teamhdr">
                                  <div className="text-sm font-bold text-slate-800 truncate flex-1">
                                    {team.name}
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (editingTeamId === team.id) {
                                        setEditingTeamId(null)
                                      } else {
                                        setEditTeamName(team.name)
                                        setEditingTeamId(team.id)
                                      }
                                    }}
                                    className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover/teamhdr:opacity-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-all flex-shrink-0"
                                    title="班を編集"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </div>

                                {/* 配置人数 */}
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {teamAssignments.length > 0
                                    ? `${new Set(teamAssignments.map((a) => a.workerId).filter(Boolean)).size}名配置`
                                    : "未配置"}
                                </div>

                                <button
                                  onClick={() => addRow(team.id)}
                                  className="mt-1.5 flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-700 transition-colors font-medium"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  行を追加
                                </button>

                                {/* 班編集ポップオーバー */}
                                {editingTeamId === team.id && (
                                  <div className="absolute top-0 left-0 right-0 z-30 bg-white border-2 border-slate-300 rounded-sm shadow-xl p-3 space-y-3" style={{ width: LEFT_COL_WIDTH + 40 }}>
                                    <div className="text-xs font-bold text-slate-700">班を編集</div>

                                    {/* 班名変更 */}
                                    <div className="space-y-1">
                                      <label className="text-xs text-slate-500">班名</label>
                                      <div className="flex gap-1">
                                        <Input
                                          value={editTeamName}
                                          onChange={(e) => setEditTeamName(e.target.value)}
                                          className="h-7 text-xs"
                                          maxLength={50}
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === "Escape") setEditingTeamId(null)
                                            if (e.key === "Enter" && editTeamName.trim()) {
                                              handleSaveTeamName(team.id)
                                            }
                                          }}
                                        />
                                        <button
                                          onClick={() => handleSaveTeamName(team.id)}
                                          disabled={savingTeam || !editTeamName.trim()}
                                          className="w-7 h-7 rounded-sm flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white transition-colors flex-shrink-0 disabled:opacity-50"
                                        >
                                          {savingTeam ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                        </button>
                                      </div>
                                    </div>

                                    {/* カラー選択 */}
                                    <div className="space-y-1">
                                      <label className="text-xs text-slate-500">班カラー</label>
                                      <div className="grid grid-cols-6 gap-1.5">
                                        {TEAM_COLOR_PALETTE.map((color) => (
                                          <button
                                            key={color}
                                            onClick={() => onTeamColorChange?.(team.id, color)}
                                            className={cn(
                                              "w-6 h-6 rounded-full transition-all hover:scale-110",
                                              (team.colorCode ?? "#94a3b8") === color && "ring-2 ring-offset-2 ring-blue-500"
                                            )}
                                            style={{ backgroundColor: color }}
                                          />
                                        ))}
                                      </div>
                                    </div>

                                    {/* 閉じる */}
                                    <button
                                      onClick={() => setEditingTeamId(null)}
                                      className="w-full text-xs text-slate-500 hover:text-slate-700 py-1 transition-colors"
                                    >
                                      閉じる
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between h-full">
                                <span className="text-xs text-slate-500">
                                  {team.name} ({row.rowIndex + 1})
                                </span>
                                {!rowHasAssignment && (
                                  <button
                                    onClick={() => removeRow(team.id)}
                                    className="p-0.5 text-slate-300 hover:text-red-500 transition-colors"
                                    title="行を削除"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          </div>

                          {/* 日付セル */}
                          {days.map((day, dayIndex) => {
                            const dateKey = format(day, "yyyy-MM-dd")
                            const isExpanded = datesWithAssignments.has(dateKey) && !collapsedDates.has(dateKey)
                            const isToday = isSameDay(day, today)
                            const isWknd = isWeekend(day)
                            const isSelectedCol = selectedDate === dateKey

                            const dayAssignments = isMainRow
                              ? teamAssignments.filter((a) => isDateInScheduleRange(day, a))
                              : []

                            // 車両アサインメントを分離（班レベルで管理）
                            const vehicleAssignmentsForDay = dayAssignments.filter((a) => a.vehicleId)
                            const nonVehicleAssignments = dayAssignments.filter((a) => !a.vehicleId)

                            // schedule ごとにグループ化（車両を除く）
                            const scheduleGroups = isExpanded ? groupBySchedule(nonVehicleAssignments) : []

                            // ホスト現場（車両の scheduleId として使用する最初の現場）
                            const hostGroup = scheduleGroups[0] ?? null

                            // 重複配置チェック: 同じ日に複数の現場に配置されている職人
                            const duplicateWorkerIds = (() => {
                              if (scheduleGroups.length < 2) return undefined
                              const workerCount = new Map<string, number>()
                              for (const g of scheduleGroups) {
                                const seenW = new Set<string>()
                                for (const a of g.assignments) {
                                  if (a.workerId && !seenW.has(a.workerId)) {
                                    seenW.add(a.workerId)
                                    workerCount.set(a.workerId, (workerCount.get(a.workerId) ?? 0) + 1)
                                  }
                                }
                              }
                              const dupW = new Set<string>()
                              for (const [id, c] of workerCount) { if (c > 1) dupW.add(id) }
                              return dupW.size > 0 ? dupW : undefined
                            })()

                            return (
                              <div
                                key={dateKey}
                                className={cn(
                                  "px-1 py-1 border-r border-slate-100 last:border-r-0 transition-all duration-200",
                                  isSelectedCol && "bg-orange-50/60",
                                  !isSelectedCol && isExpanded && "bg-blue-50/30",
                                  !isSelectedCol && isToday && !isExpanded && "bg-blue-50/50",
                                  !isSelectedCol && isWknd && !isToday && !isExpanded && "bg-slate-50/50"
                                )}
                                style={{
                                  width: dayColWidth,
                                  minWidth: dayColWidth,
                                  minHeight: hasAnyExpanded ? 80 : 64,
                                  flexShrink: 0,
                                }}
                              >
                                {isExpanded ? (
                                  /* ── 展開表示（ドロップ可能エリア） ── */
                                  <DroppableTeamCell
                                    id={`team-cell:${team.id}:${dateKey}`}
                                    data={{ type: "team-cell", teamId: team.id, dateKey }}
                                    activeDragType={activeItem?.type}
                                    activeDragDateKey={
                                      activeItem?.type === "site-card" ? activeItem.dateKey : undefined
                                    }
                                    isInDragDateRange={
                                      !!dragDateRange && hoveredTeamId === team.id &&
                                      dateKey >= dragDateRange.start && dateKey <= dragDateRange.end
                                    }
                                  >
                                    {(() => {
                                      // レーン方式: 同じ現場は同じ行、重ならない現場は行を再利用
                                      const scheduleGroupsMap = new Map(scheduleGroups.map((g) => [g.scheduleId, g]))
                                      const laneInfo = teamLaneAssignment.get(team.id)
                                      const laneCount = laneInfo?.laneCount ?? 0
                                      const scheduleToLane = laneInfo?.scheduleToLane ?? new Map<string, number>()

                                      // この日の各レーンに入る工程を配置
                                      const lanes: (ScheduleGroup | null)[] = Array(laneCount).fill(null)
                                      for (const [schedId, group] of scheduleGroupsMap) {
                                        const lane = scheduleToLane.get(schedId)
                                        if (lane !== undefined && lane < laneCount) lanes[lane] = group
                                      }

                                      return (
                                        <div className="space-y-1">
                                          {lanes.map((group, laneIdx) => {
                                            if (!group) {
                                              // ── 空きレーン: useLayoutEffect で高さが同期される ──
                                              return <div key={`spacer-${laneIdx}`} data-lane-sync={`${team.id}:${laneIdx}`} />
                                            }

                                            // ── スパニングバー検出（複数日→1本のカードに結合）──
                                            const bar = teamBars.find(b => b.scheduleId === group.scheduleId)
                                            const isFirstBarDay = bar && bar.firstExpandedIdx >= 0 && dayIndex === bar.firstExpandedIdx
                                            const isNonFirstBarDay = bar && bar.firstExpandedIdx >= 0 && dayIndex !== bar.firstExpandedIdx
                                            const spanWidth = isFirstBarDay && bar
                                              ? dayCumulativeLeft[bar.endIdx + 1] - dayCumulativeLeft[bar.firstExpandedIdx] - 8
                                              : 0

                                            // ── 現場カード ──
                                            const siteCardData: SiteCardDragData = {
                                              type: "site-card",
                                              scheduleId: group.scheduleId,
                                              teamId: team.id,
                                              dateKey,
                                              scheduleName: group.scheduleName,
                                              projectName: group.projectName,
                                              teamColor: team.colorCode ?? "#94a3b8",
                                              workType: group.workType,
                                              formattedAmount: formatAmount(group.totalAmount),
                                              formattedDateRange: formatDateRange(
                                                group.plannedStartDate,
                                                group.plannedEndDate
                                              ),
                                              assignmentIds: group.assignments.map((a) => a.id),
                                              workerCount: group.assignments.filter((a) => a.workerId).length,
                                              plannedStartDate: group.plannedStartDate,
                                              plannedEndDate: group.plannedEndDate,
                                            }

                                            const siteDropData: SiteCardDropData = {
                                              type: "site-card-drop",
                                              scheduleId: group.scheduleId,
                                              teamId: team.id,
                                              dateKey,
                                              assignmentIds: group.assignments.map((a) => a.id),
                                            }

                                            const companyColor = getCompanyColor(group.companyName)

                                            // 分割現場のサフィックスとリンクカラー
                                            const multiTeams = multiTeamSchedules.get(group.scheduleId)
                                            const splitSuffix = multiTeams
                                              ? CIRCLE_NUMBERS[multiTeams.indexOf(team.id)] ?? ""
                                              : ""
                                            const splitLinkColor = splitLinkColorMap.get(group.scheduleId)

                                            return (
                                              <div key={group.scheduleId} data-lane-sync={`${team.id}:${laneIdx}`}>
                                                {isNonFirstBarDay ? (
                                                  /* ── スパニング2日目以降: カードは初日から横に伸びているのでスペーサーのみ ── */
                                                  <div style={{ height: SPANNING_CARD_HEIGHT }} />
                                                ) : (
                                                <DraggableSiteCard
                                                  id={`site:${group.scheduleId}:${team.id}:${dateKey}`}
                                                  data={siteCardData}
                                                  dropData={siteDropData}
                                                  activeDragType={activeItem?.type}
                                                >
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                  <div
                                                    className={cn(
                                                      "relative rounded-sm text-xs transition-all shadow-sm",
                                                      onSiteOpsClick && "cursor-pointer hover:shadow-md"
                                                    )}
                                                    style={{
                                                      backgroundColor: `${companyColor}15`,
                                                      borderTop: splitLinkColor ? `3px solid ${splitLinkColor}` : `2px solid ${companyColor}50`,
                                                      borderRight: splitLinkColor ? `3px solid ${splitLinkColor}` : `2px solid ${companyColor}50`,
                                                      borderBottom: splitLinkColor ? `3px solid ${splitLinkColor}` : `2px solid ${companyColor}50`,
                                                      borderLeft: splitLinkColor ? `6px solid ${splitLinkColor}` : `5px solid ${companyColor}`,
                                                      height: SPANNING_CARD_HEIGHT,
                                                      overflow: 'hidden',
                                                      ...(isFirstBarDay ? {
                                                        width: spanWidth,
                                                        zIndex: 5,
                                                      } : {}),
                                                    }}
                                                    onClick={() => {
                                                      if (onSiteOpsClick) onSiteOpsClick(group.assignments[0].schedule)
                                                    }}
                                                  >
                                                    {/* 削除ボタン（右上） */}
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        const mainAssignment =
                                                          group.assignments.find(
                                                            (a) => !a.workerId && !a.vehicleId
                                                          ) ?? group.assignments[0]
                                                        if (mainAssignment) {
                                                          const ok = window.confirm(`「${group.scheduleName ?? group.projectName}」の配置を削除しますか？`)
                                                          if (ok) onDeleteAssignment(mainAssignment.id)
                                                        }
                                                      }}
                                                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-sm flex items-center justify-center hover:bg-red-100 text-slate-300 hover:text-red-500 transition-colors z-10"
                                                      title="配置を削除"
                                                    >
                                                      <X className="w-3 h-3" />
                                                    </button>
                                                    <div className="flex items-center h-full gap-1.5 pr-5 overflow-hidden">
                                                      {/* 左: 工種ラベル（大きく中央寄せ） */}
                                                      <div
                                                        className={cn(
                                                          "flex-shrink-0 flex items-center justify-center rounded-sm px-1.5 self-stretch font-extrabold text-[13px] min-w-[32px]",
                                                          workTypeColor(group.workType).bg,
                                                          workTypeColor(group.workType).text
                                                        )}
                                                      >
                                                        {splitSuffix && splitLinkColor && (
                                                          <span
                                                            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-white text-[8px] font-bold mr-0.5"
                                                            style={{ backgroundColor: splitLinkColor }}
                                                          >
                                                            {splitSuffix}
                                                          </span>
                                                        )}
                                                        {workTypeLabel(group.workType)}
                                                      </div>
                                                      {/* 右: 現場名（上）+ 会社名（下） */}
                                                      <div className="min-w-0 flex-1 flex flex-col justify-center leading-tight">
                                                        <div className="text-sm font-extrabold text-slate-800 truncate">
                                                          {group.scheduleName ?? group.projectName}
                                                        </div>
                                                        <div className="text-xs text-slate-600 truncate">
                                                          {group.companyName}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="text-xs max-w-[280px]">
                                                      <div className="space-y-0.5">
                                                        <div className="font-bold">{group.scheduleName ?? group.projectName}</div>
                                                        <div className="text-slate-500">{group.companyName}</div>
                                                        {group.address && <div className="text-slate-500">{group.address}</div>}
                                                        <div className="text-slate-500">{workTypeLabel(group.workType)} ・ {formatDateRange(group.plannedStartDate, group.plannedEndDate)}</div>
                                                        <div className="text-slate-500">{formatAmount(group.totalAmount)}</div>
                                                      </div>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </DraggableSiteCard>
                                                )}

                                                {/* 車両セクション（現場名と職長の間・固定高さ） */}
                                                <div style={{ minHeight: 32, marginTop: 6 }}>
                                                  {hostGroup && group.scheduleId === hostGroup.scheduleId ? (
                                                    <TeamVehicleSection
                                                      vehicleAssignments={vehicleAssignmentsForDay}
                                                      teamId={team.id}
                                                      dateKey={dateKey}
                                                      hostScheduleId={hostGroup.scheduleId}
                                                      hostScheduleDates={{
                                                        start: hostGroup.plannedStartDate,
                                                        end: hostGroup.plannedEndDate,
                                                      }}
                                                      accentColor={team.colorCode ?? "#94a3b8"}
                                                      onRefresh={onRefresh}
                                                    />
                                                  ) : (
                                                    <div style={{ height: 32 }} />
                                                  )}
                                                </div>

                                                <AssignmentDetailPanel
                                                  assignments={group.assignments}
                                                  scheduleName={group.scheduleName ?? null}
                                                  projectName={group.projectName}
                                                  plannedStartDate={group.plannedStartDate}
                                                  plannedEndDate={group.plannedEndDate}
                                                  teamId={team.id}
                                                  scheduleId={group.scheduleId}
                                                  dateKey={dateKey}
                                                  accentColor={team.colorCode ?? "#94a3b8"}
                                                  onRefresh={onRefresh}
                                                  isDragging={isDragging}
                                                  duplicateWorkerIds={duplicateWorkerIds}
                                                  busyWorkerInfoMap={busyWorkerInfoByDate.get(dateKey)}
                                                  compact={displayDays >= 14}
                                                  onCreateSplitTeam={
                                                    onCreateSplitTeam
                                                      ? () => onCreateSplitTeam(group.scheduleId, team.id, dateKey)
                                                      : undefined
                                                  }
                                                  copyableSources={
                                                    scheduleGroups
                                                      .filter((g) => g.scheduleId !== group.scheduleId)
                                                      .map((g): CopyableSourceInfo => ({
                                                        scheduleId: g.scheduleId,
                                                        scheduleName: g.scheduleName,
                                                        projectName: g.projectName,
                                                        workers: g.assignments
                                                          .filter((a) => a.workerId && a.worker)
                                                          .filter((a, i, arr) => arr.findIndex((x) => x.workerId === a.workerId) === i)
                                                          .map((a) => ({
                                                            workerId: a.workerId!,
                                                            workerName: a.worker!.name,
                                                            workerType: a.worker!.workerType,
                                                            driverLicenseType: a.worker!.driverLicenseType,
                                                            assignedRole: a.assignedRole,
                                                          })),
                                                      }))
                                                      .filter((s) => s.workers.length > 0)
                                                  }
                                                />
                                              </div>
                                            )
                                          })}

                                          {/* 現場追加ボタン */}
                                          <button
                                            onClick={() => onAddClick(team.id, day)}
                                            className="w-full flex items-center justify-center gap-1 py-2 rounded-sm border-2 border-dashed border-slate-300 text-xs text-slate-600 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 transition-all active:scale-95 font-bold"
                                          >
                                            {laneCount > 0 ? "追加" : "現場を追加"}
                                            <Plus className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )
                                    })()}
                                  </DroppableTeamCell>
                                ) : (
                                  /* ── 折りたたみ表示 ── */
                                  <div className="space-y-0.5">
                                    {dayAssignments.length === 0 && isMainRow ? (
                                      <div className="flex items-center justify-center h-full min-h-[32px] bg-slate-50/50 rounded-sm">
                                        <span className="text-xs text-slate-500">-</span>
                                      </div>
                                    ) : (
                                      dayAssignments
                                        .filter(
                                          (a, i, arr) =>
                                            arr.findIndex((x) => x.scheduleId === a.scheduleId) === i
                                        )
                                        .map((a) => {
                                          const collapsedMultiTeams = multiTeamSchedules.get(a.scheduleId)
                                          const collapsedSuffix = collapsedMultiTeams
                                            ? CIRCLE_NUMBERS[collapsedMultiTeams.indexOf(team.id)] ?? ""
                                            : ""
                                          const collapsedLinkColor = splitLinkColorMap.get(a.scheduleId)

                                          return (
                                          <Tooltip key={a.scheduleId}>
                                            <TooltipTrigger asChild>
                                              <div
                                                className="text-xs px-1 py-0.5 rounded-sm truncate cursor-default font-bold flex items-center gap-0.5"
                                                style={{
                                                  backgroundColor: collapsedLinkColor ? `${collapsedLinkColor}20` : `${team.colorCode ?? "#94a3b8"}20`,
                                                  color: "#334155",
                                                  borderLeft: collapsedLinkColor ? `3px solid ${collapsedLinkColor}` : undefined,
                                                }}
                                              >
                                                <span className={cn("text-[9px] font-bold px-1 rounded-sm flex-shrink-0", workTypeColor(a.schedule.workType).bg, workTypeColor(a.schedule.workType).text)}>
                                                  {workTypeLabel(a.schedule.workType).slice(0, 1)}
                                                </span>
                                                <span className="truncate">{collapsedSuffix}{a.schedule.name ?? a.schedule.contract.project.name}</span>
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs max-w-[200px]">
                                              <div className="space-y-0.5">
                                                <div className="font-medium">{a.schedule.name ?? a.schedule.contract.project.name}</div>
                                                {a.schedule.contract.project.address && (
                                                  <div className="text-slate-500">{a.schedule.contract.project.address}</div>
                                                )}
                                                <div className="text-slate-500">{formatDateRange(a.schedule.plannedStartDate, a.schedule.plannedEndDate)}</div>
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                          )
                                        })
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

  )
}
