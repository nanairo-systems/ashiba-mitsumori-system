/**
 * [COMPONENT] 工期管理ガントチャート - ScheduleGantt
 *
 * 表示日数を調整可能なインタラクティブなガントチャート。
 * - 開始日を自由に変更可能（日単位・週単位でスクロール）
 * - ドラッグ操作でバーを作成
 * - 既存バーをクリックして編集・削除
 * - 名前グループ化: 同名スケジュールを1行にまとめて表示
 */
"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  CalendarDays,
  GripVertical,
  CircleDot,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import {
  format,
  eachDayOfInterval,
  parseISO,
  isBefore,
  isAfter,
  addDays,
  subDays,
} from "date-fns"

// 共通モジュール
import type { ScheduleData, ContractData, DrawMode, WorkTypeMaster, ScheduleGroup } from "./schedule-types"
import { STORAGE_KEY_DISPLAY_DAYS, buildWtConfigMap, getWtConfig, FALLBACK_WT_CONFIG } from "./schedule-constants"
import { getBarPos, dayIdxToStr, groupSchedulesByName } from "./schedule-utils"
import { useGanttDrag } from "@/hooks/use-gantt-drag"
import { useGanttMove } from "@/hooks/use-gantt-move"
import { useGanttResize } from "@/hooks/use-gantt-resize"
import { GanttDateHeader } from "./GanttDateHeader"
import { GanttToolbar } from "./GanttToolbar"
import { GanttEditModal } from "./GanttEditModal"
import { SiteOpsDialog } from "@/components/site-operations/SiteOpsDialog"
import { GanttBar } from "./GanttBar"
import { GanttBarAreaBackground, GanttDragPreview } from "./GanttBarArea"
import { ScheduleCalendarModal } from "./ScheduleCalendarModal"

// ─── Props ─────────────────────────────────────────────

interface Props {
  contracts: ContractData[]
  currentUser: { id: string; name: string }
  focusContractId?: string
  workTypes: WorkTypeMaster[]
}

// ─── メインコンポーネント ───────────────────────────────

export function ScheduleGantt({ contracts, currentUser, focusContractId, workTypes }: Props) {
  const router = useRouter()
  const today = new Date()
  const [rangeStart, setRangeStart] = useState(() => subDays(today, 7))
  const [search, setSearch] = useState("")
  const [drawMode, setDrawMode] = useState<DrawMode>("select")
  const [displayDays, setDisplayDays] = useState(45)

  // 工種設定マップ
  const wtConfigMap = useMemo(() => buildWtConfigMap(workTypes), [workTypes])
  const workTypeSortOrder = useMemo(() => {
    const m = new Map<string, number>()
    workTypes.forEach((wt, i) => m.set(wt.code, i))
    return m
  }, [workTypes])

  // Shift → 2番目工種, Ctrl/Meta → 1番目工種 のキーボードショートカット
  const [heldKey, setHeldKey] = useState<"shift" | "ctrl" | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "Shift") setHeldKey("shift")
      else if (e.key === "Control" || e.key === "Meta") setHeldKey("ctrl")
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "Shift" && heldKey === "shift") setHeldKey(null)
      else if ((e.key === "Control" || e.key === "Meta") && heldKey === "ctrl") setHeldKey(null)
    }
    function onBlur() { setHeldKey(null) }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
    }
  }, [heldKey])

  const effectiveDrawMode: DrawMode = heldKey === "shift" && workTypes[1]
    ? workTypes[1].code
    : heldKey === "ctrl" && workTypes[0]
      ? workTypes[0].code
      : drawMode

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DISPLAY_DAYS)
    const n = saved ? parseInt(saved, 10) : NaN
    if (!isNaN(n) && n >= 7 && n <= 365) setDisplayDays(n)
  }, [])

  function setDisplayDaysWithStorage(days: number) {
    setDisplayDays(days)
    localStorage.setItem(STORAGE_KEY_DISPLAY_DAYS, String(days))
  }

  // 編集モーダル
  const [editSchedule, setEditSchedule] = useState<ScheduleData | null>(null)
  const [saving, setSaving] = useState(false)

  // 現場操作ダイアログ（SiteOpsDialog共通モジュール）
  const [siteOpsScheduleId, setSiteOpsScheduleId] = useState<string | null>(null)

  // カレンダーモーダル
  const [calendarOpen, setCalendarOpen] = useState(false)

  const rangeEnd = addDays(rangeStart, displayDays - 1)
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
  const totalDays = displayDays
  const cellWidthPct = 100 / totalDays

  // ナビゲーション
  const shiftDays = useCallback((n: number) => setRangeStart((prev) => addDays(prev, n)), [])
  const goToToday = () => setRangeStart(subDays(today, 7))

  // バー描画ヘルパー（元の left/width string 形式）
  const getBarPosStr = useCallback((startStr: string | null, endStr: string | null) => {
    if (!startStr) return null
    const pos = getBarPos(startStr, endStr ?? startStr, rangeStart, totalDays)
    if (!pos) return null
    return { left: `${pos.left}%`, width: `${pos.width}%` }
  }, [rangeStart, totalDays])

  // API: スケジュール作成
  async function createSchedule(contractId: string, workType: string, name: string, startDate: string, endDate: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/contracts/${contractId}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workType, name, plannedStartDate: startDate, plannedEndDate: endDate }),
      })
      if (!res.ok) throw new Error()
      const cfg = getWtConfig(workType, wtConfigMap)
      toast.success(`${cfg.label}を追加しました`)
      router.refresh()
    } catch {
      toast.error("追加に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  // API: 日付更新（移動・リサイズ共通）
  async function saveDateApi(scheduleId: string, newStart: string, newEnd: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedStartDate: newStart, plannedEndDate: newEnd }),
      })
      if (!res.ok) throw new Error()
      toast.success("日付を更新しました")
      router.refresh()
    } catch {
      toast.error("更新に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  // API: 作業内容名の変更（グループ内の全スケジュールを更新）
  async function renameGroup(contractId: string, oldName: string, newName: string) {
    const contract = filtered.find(c => c.id === contractId)
    if (!contract) return
    const schedulesToUpdate = contract.schedules.filter(s => s.name === oldName)
    setSaving(true)
    try {
      await Promise.all(schedulesToUpdate.map(s =>
        fetch(`/api/schedules/${s.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName }),
        })
      ))
      toast.success("作業内容名を変更しました")
      router.refresh()
    } catch { toast.error("変更に失敗しました") }
    finally { setSaving(false) }
  }

  // ドラッグ時のグループ名を保持する ref
  const dragTargetGroupRef = useRef<string | null>(null)

  // カスタムフック: ドラッグ作成
  const drag = useGanttDrag({
    drawMode: effectiveDrawMode,
    onCreateSchedule: ({ identifier, workType, startDay, endDay }) => {
      const contractId = identifier as string
      const groupName = dragTargetGroupRef.current
      if (groupName) {
        // 既存行にドラッグ → その作業内容名を継承
        createSchedule(contractId, workType, groupName, dayIdxToStr(startDay, rangeStart), dayIdxToStr(endDay, rangeStart))
      } else {
        // 新規行 → 作業内容名を入力
        const contract = filtered.find(c => c.id === contractId)
        const groups = contract ? groupSchedulesByName(contract.schedules, workTypeSortOrder) : []
        const newName = prompt("作業内容の名前を入力してください", `作業${groups.length + 1}`)
        if (!newName?.trim()) return
        createSchedule(contractId, workType, newName.trim(), dayIdxToStr(startDay, rangeStart), dayIdxToStr(endDay, rangeStart))
      }
      dragTargetGroupRef.current = null
    },
  })

  // カスタムフック: ロングプレス移動
  const move = useGanttMove({
    rangeStart,
    totalDays,
    drawMode: effectiveDrawMode,
    barAreaSelector: "[data-bar-area]",
    onMoveSchedule: saveDateApi,
    onClickSchedule: (schedule) => setEditSchedule(schedule),
  })

  // カスタムフック: エッジリサイズ
  const resize = useGanttResize({
    rangeStart,
    totalDays,
    drawMode: effectiveDrawMode,
    barAreaSelector: "[data-bar-area]",
    onResizeSchedule: saveDateApi,
    longPressTimerRef: move.longPressTimerRef,
  })

  // フォーカス契約がある場合はその契約のみ対象に
  const targetContracts = useMemo(() => {
    if (focusContractId) {
      const found = contracts.find((c) => c.id === focusContractId)
      return found ? [found] : contracts
    }
    return contracts
  }, [contracts, focusContractId])

  // フィルター
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return targetContracts
    return targetContracts.filter((c) =>
      c.project.name.toLowerCase().includes(q) || c.project.companyName.toLowerCase().includes(q)
    )
  }, [targetContracts, search])

  // effectiveDrawMode のカーソルスタイル
  const cursorCfg = effectiveDrawMode !== "select" ? getWtConfig(effectiveDrawMode, wtConfigMap) : null

  // ショートカットラベル
  const shortcutLabel = workTypes.length >= 2
    ? `Ctrl＝${workTypes[0].label} / Shift＝${workTypes[1].label}`
    : workTypes.length >= 1
      ? `Ctrl＝${workTypes[0].label}`
      : ""

  return (
    <div className="space-y-4" onMouseUp={drag.handleMouseUp} onMouseLeave={drag.handleMouseUp}>
      {/* フォーカス中バナー */}
      {focusContractId && filtered.length > 0 && (
        <div className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm">
          <span className="text-blue-700">
            契約詳細から遷移しました — <strong>{filtered[0]?.project.name}</strong> の工程を編集しています
          </span>
          <Link href="/schedules">
            <Button variant="outline" size="sm" className="text-xs h-7">全件表示へ戻る</Button>
          </Link>
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-blue-600" />
            工期管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            ドラッグで工程を作成 — {currentUser.name} さん
            {shortcutLabel && <span className="text-slate-400 ml-2 text-xs">（{shortcutLabel}）</span>}
          </p>
        </div>
      </div>

      {/* ツールバー */}
      <GanttToolbar
        variant="full"
        drawMode={drawMode}
        effectiveDrawMode={effectiveDrawMode}
        rangeStart={rangeStart}
        displayDays={displayDays}
        search={search}
        workTypes={workTypes}
        wtConfigMap={wtConfigMap}
        onDrawModeChange={(m) => setDrawMode(m)}
        onShiftDays={shiftDays}
        onGoToToday={goToToday}
        onDisplayDaysChange={setDisplayDaysWithStorage}
        onRangeStartChange={setRangeStart}
        onSearchChange={setSearch}
        onCalendarOpen={() => setCalendarOpen(true)}
      />

      {/* ガントチャート */}
      <div className={`bg-white border rounded-xl overflow-hidden select-none ${cursorCfg ? cursorCfg.cursor : ""}`}>
        {/* 日付ヘッダー */}
        <GanttDateHeader
          days={days}
          cellWidthPct={cellWidthPct}
          leftColumnWidth={220}
          leftColumnLabel="案件名"
          variant="full"
        />

        {/* 案件行 */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">表示する案件がありません</p>
          </div>
        ) : (
          filtered.map((contract) => {
            const dragPreview = drag.getDragPreview(contract.id)
            const groups = groupSchedulesByName(contract.schedules, workTypeSortOrder)
            const hasSchedules = contract.schedules.length > 0
            let scheduleDateRange: { earliest: Date; latest: Date } | null = null
            if (hasSchedules) {
              const allDates = contract.schedules.flatMap((s) =>
                [s.plannedStartDate, s.plannedEndDate, s.actualStartDate, s.actualEndDate].filter(Boolean) as string[]
              )
              if (allDates.length > 0) {
                const earliest = allDates.reduce((a, b) => (a < b ? a : b))
                const latest = allDates.reduce((a, b) => (a > b ? a : b))
                scheduleDateRange = { earliest: parseISO(earliest), latest: parseISO(latest) }
              }
            }
            const inRange = scheduleDateRange
              ? !isAfter(scheduleDateRange.earliest, rangeEnd) && !isBefore(scheduleDateRange.latest, rangeStart)
              : false

            // 行の高さ: グループ数に応じて動的に (最小48px)
            const rowHeight = Math.max(48, groups.length * 40 + 8)

            return (
              <div key={contract.id} className="flex border-b border-slate-100 last:border-b-0 group/row">
                {/* 案件名 */}
                <div className={`w-[220px] flex-shrink-0 px-3 py-2 border-r border-slate-200 transition-colors ${
                  hasSchedules ? (inRange ? "bg-blue-50/60 border-l-2 border-l-blue-400" : "bg-amber-50/40 border-l-2 border-l-amber-300") : "bg-slate-50/50"
                } hover:bg-slate-100/50`}>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="text-xs font-medium text-slate-800 hover:text-blue-600 hover:underline truncate flex-1 min-w-0"
                    >
                      {contract.project.name}
                    </Link>
                    {hasSchedules ? (
                      inRange ? (
                        <CircleDot className="w-3 h-3 text-blue-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      )
                    ) : (
                      <span className="text-[9px] text-slate-300 flex-shrink-0">工程なし</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 truncate block">{contract.project.companyName}</span>
                  {hasSchedules ? (
                    <>
                      <div className="flex flex-col gap-0.5 mt-1">
                        {groups.map((group, gi) => (
                          <div
                            key={gi}
                            className="flex items-center gap-0.5 flex-wrap cursor-pointer hover:bg-slate-100/70 rounded px-0.5 -mx-0.5 transition-colors"
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setSiteOpsScheduleId(group.schedules[0]?.id ?? null) }}
                            title="クリックで詳細を編集"
                          >
                            {group.name ? (
                              <span className="text-[8px] text-slate-500 font-medium truncate max-w-[80px]">
                                {group.name}:
                              </span>
                            ) : (
                              <span className="text-[8px] text-slate-300">—</span>
                            )}
                            {group.schedules.map((s) => {
                              const sCfg = getWtConfig(s.workType, wtConfigMap)
                              return (
                                <button
                                  key={s.id}
                                  className={`inline-flex items-center gap-0.5 px-1 py-0 rounded text-[8px] font-medium ${sCfg.bg} ${sCfg.text} truncate hover:brightness-90 hover:shadow-sm transition-all cursor-pointer`}
                                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditSchedule(s) }}
                                  title={`${sCfg.label}を編集`}
                                >
                                  {sCfg.short}
                                  {s.workersCount && <span className="ml-0.5 flex-shrink-0">{s.workersCount}人</span>}
                                </button>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                      {scheduleDateRange && (
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          {format(scheduleDateRange.earliest, "M/d")} 〜 {format(scheduleDateRange.latest, "M/d")}
                          {!inRange && (
                            <button
                              className="text-amber-600 ml-0.5 hover:underline hover:text-amber-800"
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setRangeStart(subDays(scheduleDateRange!.earliest, 3)) }}
                            >
                              （範囲外 →表示）
                            </button>
                          )}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-[9px] text-slate-300 mt-0.5">ドラッグで追加</p>
                  )}
                </div>

                {/* バー領域 */}
                <div
                  data-bar-area
                  data-contract-id={contract.id}
                  className="flex-1 relative"
                  style={{ minHeight: rowHeight }}
                  onMouseDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const dayIdx = Math.floor(((e.clientX - rect.left) / rect.width) * totalDays)
                    // Y位置からグループを特定
                    const mouseY = e.clientY - rect.top
                    const groupIdx = Math.min(Math.floor((mouseY - 4) / 40), groups.length - 1)
                    dragTargetGroupRef.current = groupIdx >= 0 && groupIdx < groups.length ? groups[groupIdx].name ?? null : null
                    drag.handleMouseDown(contract.id, dayIdx)
                  }}
                  onMouseMove={(e) => {
                    if (!drag.isDragging.current) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    const dayIdx = Math.floor(((e.clientX - rect.left) / rect.width) * totalDays)
                    drag.handleMouseMove(dayIdx)
                  }}
                >
                  <GanttBarAreaBackground days={days} totalDays={totalDays} rangeStart={rangeStart} />

                  {/* グループ行ごとにバーを配置 */}
                  {groups.map((group, gi) => {
                    const groupY = 4 + gi * 40
                    return group.schedules.map((schedule) => {
                      const plannedPos = getBarPosStr(schedule.plannedStartDate, schedule.plannedEndDate)
                      const actualPos = getBarPosStr(schedule.actualStartDate, schedule.actualEndDate)
                      const sCfg = getWtConfig(schedule.workType, wtConfigMap)

                      // 範囲外インジケータ
                      if (!plannedPos && !actualPos) {
                        const refDate = schedule.plannedStartDate ?? schedule.actualStartDate
                        const isAfterRange = refDate ? isAfter(parseISO(refDate), rangeEnd) : false
                        const dateLabel = refDate ? format(parseISO(refDate), "M/d") : ""
                        return (
                          <div
                            key={schedule.id}
                            className="absolute z-[5] flex items-center cursor-pointer hover:opacity-80"
                            style={{ top: groupY, height: 22, ...(isAfterRange ? { right: 4 } : { left: 4 }) }}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (refDate) setRangeStart(subDays(parseISO(refDate), 3))
                              else setEditSchedule(schedule)
                            }}
                          >
                            <span className={`text-[9px] ${sCfg.text} px-1.5 py-0.5 rounded ${sCfg.bg} border ${sCfg.border} flex items-center gap-1`}>
                              {!isAfterRange && <span>◀</span>}
                              {sCfg.label} {dateLabel && `${dateLabel}〜`}
                              {isAfterRange && <span>▶</span>}
                            </span>
                          </div>
                        )
                      }

                      return (
                        <GanttBar
                          key={schedule.id}
                          schedule={schedule}
                          plannedPos={plannedPos}
                          actualPos={actualPos}
                          y={groupY}
                          isSelectMode={effectiveDrawMode === "select"}
                          moveState={move.moveState}
                          resizeState={resize.resizeState}
                          rangeStart={rangeStart}
                          totalDays={totalDays}
                          contractId={contract.id}
                          wtConfig={sCfg}
                          onBarMouseDown={(s, e, cId) => move.handleBarMouseDown(s, e, cId)}
                          onBarMouseUp={(s, e) => move.handleBarMouseUp(s, e)}
                          onBarClick={(s, e) => { e.stopPropagation(); setEditSchedule(s) }}
                          onBarEdgeMouseDown={(s, edge, e, cId) => resize.handleBarEdgeMouseDown(s, edge, e, cId)}
                        />
                      )
                    })
                  })}

                  {/* ドラッグプレビュー */}
                  {dragPreview && (
                    <GanttDragPreview
                      startDay={dragPreview.startDay}
                      endDay={dragPreview.endDay}
                      totalDays={totalDays}
                      workType={drag.dragDrawModeRef.current}
                      wtConfig={getWtConfig(drag.dragDrawModeRef.current, wtConfigMap)}
                    />
                  )}

                  {effectiveDrawMode !== "select" && contract.schedules.length === 0 && !dragPreview && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-[10px] text-slate-300 flex items-center gap-1">
                        <GripVertical className="w-3 h-3" />
                        ドラッグして{getWtConfig(effectiveDrawMode, wtConfigMap).label}を追加
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 凡例 */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span className="font-medium">凡例:</span>
          {workTypes.map((wt) => {
            const cfg = getWtConfig(wt.code, wtConfigMap)
            return (
              <div key={wt.code} className="flex items-center gap-1.5">
                <span className={`inline-block w-5 h-2.5 rounded-sm ${cfg.planned} border ${cfg.border}`} />
                <span>{cfg.label}（予定）</span>
                <span className={`inline-block w-5 h-2.5 rounded-sm ${cfg.actual}`} />
                <span>（実績）</span>
              </div>
            )
          })}
        </div>
        <span>{filtered.length} 件</span>
      </div>

      {/* 編集モーダル（工種個別） */}
      {editSchedule && (
        <GanttEditModal
          schedule={editSchedule}
          wtConfig={getWtConfig(editSchedule.workType, wtConfigMap)}
          onClose={() => setEditSchedule(null)}
          onUpdated={() => router.refresh()}
        />
      )}

      {/* 現場操作ダイアログ（共通モジュール） */}
      <SiteOpsDialog
        open={!!siteOpsScheduleId}
        onClose={() => setSiteOpsScheduleId(null)}
        scheduleId={siteOpsScheduleId}
        onUpdated={() => { setSiteOpsScheduleId(null); router.refresh() }}
      />

      {/* カレンダーモーダル */}
      <ScheduleCalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        contracts={contracts}
        workTypes={workTypes}
        onScheduleChanged={() => router.refresh()}
      />
    </div>
  )
}
