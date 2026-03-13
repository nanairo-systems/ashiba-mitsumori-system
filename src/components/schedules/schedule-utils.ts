/**
 * [UTILS] 工期スケジュール共通ユーティリティ
 */
import {
  parseISO,
  differenceInDays,
  addDays,
  format,
} from "date-fns"
import type { ScheduleData, ScheduleGroup, WorkContentData, WorkContentGroup } from "./schedule-types"

/**
 * 日付文字列のペアからバーの CSS left/width(%) を計算
 * 範囲外の場合は null を返す
 */
export function getBarPos(
  startStr: string | null,
  endStr: string | null,
  rangeStart: Date,
  totalDays: number
): { left: number; width: number } | null {
  if (!startStr || !endStr) return null
  const s = parseISO(startStr)
  const e = parseISO(endStr)
  const startIdx = differenceInDays(s, rangeStart)
  const endIdx = differenceInDays(e, rangeStart)
  if (endIdx < 0 || startIdx >= totalDays) return null
  const clampedStart = Math.max(0, startIdx)
  const clampedEnd = Math.min(totalDays - 1, endIdx)
  const cellWidthPct = 100 / totalDays
  return {
    left: clampedStart * cellWidthPct,
    width: (clampedEnd - clampedStart + 1) * cellWidthPct,
  }
}

/**
 * 日インデックスを "yyyy-MM-dd" 文字列に変換
 */
export function dayIdxToStr(idx: number, rangeStart: Date): string {
  return format(addDays(rangeStart, idx), "yyyy-MM-dd")
}

/**
 * スケジュール配列を name でグループ化
 * - 同じ name を持つスケジュールは1グループにまとめる
 * - name が null のスケジュールはそれぞれ個別のグループになる
 * - グループ内は workType 順でソート
 */
export function groupSchedulesByName(
  schedules: ScheduleData[],
  workTypeSortOrder?: Map<string, number>,
): ScheduleGroup[] {
  const namedGroups = new Map<string, ScheduleData[]>()
  const unnamed: ScheduleData[] = []

  for (const s of schedules) {
    if (s.name) {
      const existing = namedGroups.get(s.name)
      if (existing) {
        existing.push(s)
      } else {
        namedGroups.set(s.name, [s])
      }
    } else {
      unnamed.push(s)
    }
  }

  const getOrder = (code: string) => workTypeSortOrder?.get(code) ?? 999
  const sortByWorkType = (a: ScheduleData, b: ScheduleData) =>
    getOrder(a.workType) - getOrder(b.workType)

  const groups: ScheduleGroup[] = []

  // 名前ありグループ（名前順）
  const sortedNames = [...namedGroups.keys()].sort()
  for (const name of sortedNames) {
    const items = namedGroups.get(name)!
    items.sort(sortByWorkType)
    groups.push({ name, schedules: items })
  }

  // 名前なしは個別行
  unnamed.sort(sortByWorkType)
  for (const s of unnamed) {
    groups.push({ name: null, schedules: [s] })
  }

  return groups
}

/**
 * スケジュール配列を workContentId でグループ化
 * - workContent の sortOrder 順でソート
 * - グループ内は workType 順でソート
 */
export function groupSchedulesByWorkContent(
  schedules: ScheduleData[],
  workContents: WorkContentData[],
  workTypeSortOrder?: Map<string, number>,
): WorkContentGroup[] {
  const wcMap = new Map<string, WorkContentData>()
  for (const wc of workContents) wcMap.set(wc.id, wc)

  const grouped = new Map<string, ScheduleData[]>()
  for (const s of schedules) {
    const existing = grouped.get(s.workContentId)
    if (existing) existing.push(s)
    else grouped.set(s.workContentId, [s])
  }

  const getOrder = (code: string) => workTypeSortOrder?.get(code) ?? 999
  const sortByWorkType = (a: ScheduleData, b: ScheduleData) =>
    getOrder(a.workType) - getOrder(b.workType)

  // workContent の sortOrder 順に並べる
  const sortedWcs = [...workContents].sort((a, b) => a.sortOrder - b.sortOrder)

  const groups: WorkContentGroup[] = []
  for (const wc of sortedWcs) {
    const items = grouped.get(wc.id) ?? []
    items.sort(sortByWorkType)
    groups.push({ workContent: wc, schedules: items })
  }

  return groups
}

/**
 * スケジュールに日付が設定されているかチェック（予定 or 実績）
 */
export function hasDateRange(schedule: ScheduleData): boolean {
  return !!(
    (schedule.plannedStartDate && schedule.plannedEndDate) ||
    (schedule.actualStartDate && schedule.actualEndDate)
  )
}
