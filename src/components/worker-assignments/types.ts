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
  defaultRole: string
}

export interface VehicleData {
  id: string
  name: string
  licensePlate: string
  vehicleType: string | null
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
  contract: {
    id: string
    contractNumber: string | null
    contractAmount: string
    totalAmount: string
    project: {
      id: string
      name: string
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
  formattedAmount: string
  formattedDateRange: string
  assignmentIds: string[]
  workerCount: number
}

export interface WorkerCardDragData {
  type: "worker-card"
  assignmentId: string
  teamId: string
  scheduleId: string
  workerName: string
  workerType: string
  assignedRole: string
  accentColor: string
}

export type DragItemData = SiteCardDragData | WorkerCardDragData

export interface TeamCellDropData {
  type: "team-cell"
  teamId: string
  dateKey: string
}

export interface WorkerZoneDropData {
  type: "worker-zone"
  teamId: string
  scheduleId: string
}

export type DropTargetData = TeamCellDropData | WorkerZoneDropData
