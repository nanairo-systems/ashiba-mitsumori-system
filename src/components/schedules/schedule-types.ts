/**
 * [TYPES] 工期スケジュール共通型定義
 */
import type { ContractStatus } from "@prisma/client"

export type { ContractStatus }

/** 工種マスターデータ */
export interface WorkTypeMaster {
  id: string
  code: string
  label: string
  shortLabel: string
  colorIndex: number
  sortOrder: number
  isDefault: boolean
}

/** 作業内容データ */
export interface WorkContentData {
  id: string
  projectId: string
  name: string
  notes: string | null
  sortOrder: number
}

export interface ScheduleData {
  id: string
  projectId?: string
  contractId: string | null
  estimateId: string | null
  workContentId: string
  workType: string
  name: string | null
  plannedStartDate: string | null
  plannedEndDate: string | null
  actualStartDate: string | null
  actualEndDate: string | null
  workersCount: number | null
  notes: string | null
  workContent?: { id: string; name: string } | null
  /** プロジェクト情報（APIレスポンスに含まれる場合） */
  project?: {
    id: string
    name: string
    address?: string | null
    contact?: { id: string; name: string; phone: string; email: string } | null
    branch?: { company: { id: string; name: string } }
  }
  /** 契約情報（APIレスポンスに含まれる場合） */
  contract?: {
    id: string
    contractNumber: string | null
    contractAmount: string
    totalAmount: string
  } | null
}

export interface ContractData {
  id: string
  contractNumber: string | null
  status: ContractStatus
  project: { id: string; name: string; companyName: string }
  schedules: ScheduleData[]
}

export type DrawMode = "select" | string

/** name でグループ化されたスケジュール行 */
export interface ScheduleGroup {
  /** グループ名 (name が null の場合は null) */
  name: string | null
  /** このグループに属するスケジュール一覧 */
  schedules: ScheduleData[]
}

/** WorkContent でグループ化されたスケジュール行 */
export interface WorkContentGroup {
  workContent: WorkContentData
  schedules: ScheduleData[]
}

/** ドラッグ作成中の状態 */
export interface GanttDragInfo {
  /** 契約IDまたは行インデックス */
  contractId?: string
  rowIdx?: number
  startDay: number
  endDay: number
}

/** ロングプレス移動中の状態 */
export interface GanttMoveState {
  schedule: ScheduleData
  contractId?: string
  span: number
  moveStartDay: number
  grabOffset: number
  barAreaRect: DOMRect
}

/** エッジリサイズ中の状態 */
export interface GanttResizeState {
  schedule: ScheduleData
  contractId?: string
  edge: "left" | "right"
  startDay: number
  endDay: number
  barAreaRect: DOMRect
}

/** WT_CONFIG の値の型 */
export interface WorkTypeConfig {
  label: string
  short: string
  planned: string
  actual: string
  text: string
  bg: string
  border: string
  cursor: string
}
