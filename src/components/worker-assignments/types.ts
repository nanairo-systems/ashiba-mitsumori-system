/**
 * [TYPES] 人員配置管理 - 型定義
 */

export type ViewMode = "team" | "site"

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
  contractId: string
  workType: string
  name: string | null
  plannedStartDate: string | null
  plannedEndDate: string | null
  actualStartDate: string | null
  actualEndDate: string | null
  workersCount: number | null
  notes: string | null
  _count?: { workerAssignments: number }
  contract: {
    id: string
    contractNumber: string | null
    contractAmount: string
    totalAmount: string
    project: {
      id: string
      name: string
      address: string | null
      branch: {
        company: {
          id: string
          name: string
        }
      }
    }
  }
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
