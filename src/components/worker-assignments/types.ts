/**
 * [TYPES] 人員配置管理 - 型定義
 */

/** 1つの現場×班あたりの職人（WORKER）上限 */
export const MAX_WORKERS_PER_SITE = 8
/** 1つの現場×班あたりの合計上限（職長1名＋職人8名） */
export const MAX_TOTAL_PER_SITE = 9

export type ViewMode = "team" | "site"

/** 工種コード → 日本語ラベル変換 */
const WORK_TYPE_LABELS: Record<string, string> = {
  ASSEMBLY: "組立",
  DISASSEMBLY: "解体",
  REWORK: "その他",
  INHOUSE: "自社",
  SUBCONTRACT: "外注",
}

export function workTypeLabel(code: string): string {
  return WORK_TYPE_LABELS[code] ?? code
}

/** 工種コード → バッジカラー */
const WORK_TYPE_COLORS: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  ASSEMBLY:    { bg: "bg-blue-100",   text: "text-blue-700",   border: "border-blue-300",   accent: "#3b82f6" },
  DISASSEMBLY: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300", accent: "#f97316" },
  REWORK:      { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300", accent: "#a855f7" },
  INHOUSE:     { bg: "bg-slate-100",  text: "text-slate-600",  border: "border-slate-300",  accent: "#64748b" },
  SUBCONTRACT: { bg: "bg-emerald-100",text: "text-emerald-700",border: "border-emerald-300",accent: "#10b981" },
}

const DEFAULT_WORK_TYPE_COLOR = { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300", accent: "#94a3b8" }

export function workTypeColor(code: string) {
  return WORK_TYPE_COLORS[code] ?? DEFAULT_WORK_TYPE_COLOR
}

/** 工種コード → バーのグラデーション色（from/to） */
const WORK_TYPE_BAR_GRADIENTS: Record<string, { from: string; to: string }> = {
  ASSEMBLY:    { from: "#3b82f6", to: "#1d4ed8" },  // 青
  DISASSEMBLY: { from: "#f97316", to: "#c2410c" },  // オレンジ
  REWORK:      { from: "#a855f7", to: "#7c3aed" },  // 紫
  INHOUSE:     { from: "#64748b", to: "#475569" },  // スレート
  SUBCONTRACT: { from: "#10b981", to: "#047857" },  // エメラルド
}

const DEFAULT_BAR_GRADIENT = { from: "#94a3b8", to: "#64748b" }

export function workTypeBarGradient(code: string) {
  return WORK_TYPE_BAR_GRADIENTS[code] ?? DEFAULT_BAR_GRADIENT
}

export interface TeamData {
  id: string
  name: string
  teamType: string
  leaderId: string | null
  subcontractorId: string | null
  colorCode: string | null
  sortOrder: number
  isActive: boolean
}

export interface WorkerData {
  id: string
  name: string
  furigana: string | null
  phone: string | null
  workerType: string
  driverLicenseType: string
  defaultRole: string
  isActive?: boolean
  workerCategory?: string  // "MAIN" | "SUB" | "HIDDEN"
  /** 下請け業者（SUBCONTRACTORのみ） */
  subcontractors?: { id: string; name: string } | null
}

/** 職人ごとの配置情報（日付単位） */
export interface WorkerBusyInfo {
  /** 配置されている現場名の配列 */
  siteNames: string[]
}

export interface VehicleData {
  id: string
  name: string
  licensePlate: string
  vehicleType: string | null
  capacity: string | null
  inspectionDate: string | null
}

export interface ScheduleData {
  id: string
  projectId: string
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
  _count?: { workerAssignments: number }
  workContent?: { id: string; name: string } | null
  project: {
    id: string
    name: string
    address: string | null
    contact?: {
      id: string
      name: string
      phone: string
      email: string
    } | null
    branch: {
      company: {
        id: string
        name: string
      }
    }
  }
  contract?: {
    id: string
    contractNumber: string | null
    contractAmount: string
    totalAmount: string
  } | null
}

export interface AssignmentData {
  id: string
  scheduleId: string
  teamId: string
  workerId: string | null
  vehicleId: string | null
  assignedRole: string
  assignedDate: string | null
  excludedDates: string[]
  sortOrder: number
  note: string | null
  team: TeamData
  worker: WorkerData | null
  vehicle: VehicleData | null
  schedule: ScheduleData
}

/** 行追加用の仮想行 */
export interface TeamRow {
  teamId: string
  rowIndex: number
}

// ── DnD関連の型 ──

export interface SiteCardDragData {
  type: "site-card"
  scheduleId: string
  teamId: string
  dateKey: string
  scheduleName: string | null
  projectName: string
  teamColor: string
  workType: string
  formattedAmount: string
  formattedDateRange: string
  assignmentIds: string[]
  workerCount: number
  plannedStartDate: string | null
  plannedEndDate: string | null
}

export interface WorkerCardDragData {
  type: "worker-card"
  assignmentId: string
  teamId: string
  scheduleId: string
  dateKey: string
  workerName: string
  workerType: string
  driverLicenseType: string
  assignedRole: string
  accentColor: string
  isMultiDay: boolean
}

export interface UnassignedBarDragData {
  type: "unassigned-bar"
  scheduleId: string
  scheduleName: string | null
  projectName: string
  workType: string
  formattedDateRange: string
  barColor: string
  plannedStartDate: string | null
  plannedEndDate: string | null
}

export type DragItemData = SiteCardDragData | WorkerCardDragData | UnassignedBarDragData

export interface TeamCellDropData {
  type: "team-cell"
  teamId: string
  dateKey: string
}

export interface WorkerZoneDropData {
  type: "worker-zone"
  teamId: string
  scheduleId: string
  dateKey: string
}

export interface ScheduleCellDropData {
  type: "schedule-cell"
  scheduleId: string
  dateKey: string
}

export interface SiteCardDropData {
  type: "site-card-drop"
  scheduleId: string
  teamId: string
  dateKey: string
  assignmentIds: string[]
}

export type DropTargetData = TeamCellDropData | WorkerZoneDropData | ScheduleCellDropData | SiteCardDropData

/** 職人移動の保留データ（ダイアログ表示中） */
export interface PendingWorkerMove {
  assignmentId: string
  workerName: string
  sourceTeamId: string
  sourceScheduleId: string
  targetTeamId: string
  targetScheduleId: string
  moveDate: string
  scheduleName: string | null
  isMultiDay: boolean
}
