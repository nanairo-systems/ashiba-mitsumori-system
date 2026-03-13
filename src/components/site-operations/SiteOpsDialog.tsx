/**
 * [COMPONENT] 現場操作ダイアログ（V2デザイン準拠）
 *
 * ProjectListV2 のデザインパターンに完全準拠:
 * - rounded-sm / border-2 / font-extrabold
 * - グラデーション背景 + border-l-[5px] アクセント
 * - active:scale-95 プレスフィードバック
 * - bg-slate-50 ヘッダー背景
 * - 大きめテキスト + tabular-nums
 *
 * ヘッダーに全情報集約 + アクションカード4種 + 全セクション一画面表示
 * 作業内容タブ: 個別グループ + 「全体」表示切替
 */
"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent } from "@/components/ui/dialog"

import { Skeleton } from "@/components/ui/skeleton"
import {
  X, Loader2, Pencil, Trash2, Check, Plus, List, BarChart3,
  MapPin, Camera, CalendarDays,
  ShieldCheck, Layers,
  FilePlus2, Wrench, CheckCircle2, FileText, LayoutTemplate, Eye, ChevronRight, ChevronDown, Receipt,
  Zap, Package, Phone, ClipboardList, CloudSun, Settings2, type LucideIcon,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { toast } from "sonner"
import { SiteOpsDateSection } from "./SiteOpsDateSection"
import { SiteOpsPhotoSection } from "./SiteOpsPhotoSection"

import { ScheduleMiniGantt } from "@/components/schedules/ScheduleMiniGantt"
import { cn } from "@/lib/utils"
import type { ScheduleData } from "@/components/worker-assignments/types"
import { ISSIKI_TEMPLATE_NAME, type EstimateTemplate } from "@/hooks/use-estimate-create"

/** 作業種別のスタイル（V2準拠） */
const WORK_TYPE_BADGE: Record<string, { label: string; className: string; cardBg: string; cardBorder: string }> = {
  ASSEMBLY: { label: "組立", className: "bg-blue-100 text-blue-700 border-blue-300", cardBg: "bg-gradient-to-r from-blue-50 to-indigo-50", cardBorder: "border-l-blue-500" },
  DISASSEMBLY: { label: "解体", className: "bg-orange-100 text-orange-700 border-orange-300", cardBg: "bg-gradient-to-r from-orange-50 to-amber-50", cardBorder: "border-l-orange-500" },
  REWORK: { label: "その他", className: "bg-slate-100 text-slate-600 border-slate-300", cardBg: "bg-slate-50", cardBorder: "border-l-slate-400" },
}

/** 「全体」表示のための特殊キー */
const ALL_GROUP_KEY = "__ALL__"

/** 項目マスタから作成の特殊キー */
const MASTER_PICKER_ID = "__master__"

/** WorkContent データ（APIから取得） */
interface WorkContentItem {
  id: string
  projectId: string
  name: string
  notes: string | null
  sortOrder: number
  schedules: ScheduleData[]
}

/** ステータス判定（V2スタイル） */
function deriveStatus(actualStart: string | null, actualEnd: string | null) {
  if (actualEnd) return { label: "完工済", badgeBg: "bg-emerald-500", badgeText: "text-white" }
  if (actualStart) return { label: "作業中", badgeBg: "bg-amber-500", badgeText: "text-white" }
  return { label: "未着工", badgeBg: "bg-slate-400", badgeText: "text-white" }
}

// ─── SO-2 カスタムボタン定義 ─────────────────────────────

type SOCustomButtonId = "estimate" | "schedule" | "call" | "safety" | "report" | "weather" | "memo"

interface SOCustomButtonDef {
  id: SOCustomButtonId
  label: string
  icon: LucideIcon
  bg: string
  border: string
  text: string
  dashed?: boolean
}

const SO_CUSTOM_OPTIONS: SOCustomButtonDef[] = [
  { id: "estimate", label: "見積詳細", icon: FileText, bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-700" },
  { id: "schedule", label: "工事日程", icon: BarChart3, bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-700" },
  { id: "call", label: "電話する", icon: Phone, bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700" },
  { id: "safety", label: "安全管理", icon: ShieldCheck, bg: "bg-red-50", border: "border-red-300", text: "text-red-600", dashed: true },
  { id: "report", label: "作業日報", icon: ClipboardList, bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-700", dashed: true },
  { id: "weather", label: "天気確認", icon: CloudSun, bg: "bg-sky-50", border: "border-sky-300", text: "text-sky-700" },
  { id: "memo", label: "メモ", icon: Pencil, bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-700" },
]

const SO_CUSTOM_MAP = Object.fromEntries(SO_CUSTOM_OPTIONS.map((b) => [b.id, b])) as Record<SOCustomButtonId, SOCustomButtonDef>

const SO_STORAGE_KEYS = ["so_custom_btn_3", "so_custom_btn_4", "so_custom_btn_5"] as const
const SO_DEFAULTS: [SOCustomButtonId, SOCustomButtonId, SOCustomButtonId] = ["safety", "memo", "estimate"]

function getSOCustomSlots(): [SOCustomButtonId, SOCustomButtonId, SOCustomButtonId] {
  if (typeof window === "undefined") return SO_DEFAULTS
  return SO_STORAGE_KEYS.map((key, i) => {
    const v = localStorage.getItem(key) as SOCustomButtonId | null
    return (v && SO_CUSTOM_MAP[v]) ? v : SO_DEFAULTS[i]
  }) as [SOCustomButtonId, SOCustomButtonId, SOCustomButtonId]
}

function setSOCustomSlot(slotIndex: 0 | 1 | 2, id: SOCustomButtonId) {
  localStorage.setItem(SO_STORAGE_KEYS[slotIndex], id)
}

function SOCustomSelector({ slotIndex, currentId, onSelect }: {
  slotIndex: 0 | 1 | 2
  currentId: SOCustomButtonId
  onSelect: (id: SOCustomButtonId) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 rounded-full bg-slate-500 text-white flex items-center justify-center hover:bg-slate-700 transition-colors"
          title={`ボタン${slotIndex + 1}をカスタマイズ`}
          onClick={(e) => e.stopPropagation()}
        >
          <Settings2 className="w-2.5 h-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="end" side="bottom" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-bold text-slate-500 mb-2 px-1">ボタン{slotIndex + 1}を変更</p>
        <div className="space-y-1">
          {SO_CUSTOM_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const isActive = opt.id === currentId
            return (
              <button
                key={opt.id}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs font-bold transition-colors ${
                  isActive ? "bg-blue-50 text-blue-700 border border-blue-300" : "hover:bg-slate-50 text-slate-600"
                }`}
                onClick={() => { onSelect(opt.id); setOpen(false) }}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {opt.label}
                {isActive && <Check className="w-3 h-3 ml-auto text-blue-500" />}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** リスト表示用の日程追加フォーム */
function ListScheduleAdder({ projectId, workContentId, groupName, onCreated }: { projectId: string; workContentId: string; groupName?: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [workType, setWorkType] = useState("ASSEMBLY")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!startDate || !endDate) {
      toast.error("開始日と終了日を入力してください")
      return
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error("終了日は開始日以降にしてください")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          workContentId,
          workType,
          name: groupName || null,
          plannedStartDate: startDate,
          plannedEndDate: endDate,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("工事日程を追加しました")
      setOpen(false)
      setStartDate("")
      setEndDate("")
      onCreated()
    } catch {
      toast.error("追加に失敗しました")
    } finally {
      setCreating(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/50 text-blue-600 font-bold text-sm hover:bg-blue-100 hover:border-blue-400 active:scale-[0.98] transition-all"
      >
        <Plus className="w-4 h-4" />
        工事日程を追加
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-lg border-2 border-blue-300 bg-blue-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-extrabold text-blue-800 flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4" />
          工事日程を追加
        </h4>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 工種選択 */}
      <div>
        <label className="text-xs font-bold text-slate-600 mb-1.5 block">工種</label>
        <div className="flex gap-1.5">
          {Object.entries(WORK_TYPE_BADGE).map(([code, wt]) => (
            <button
              key={code}
              type="button"
              onClick={() => setWorkType(code)}
              className={cn(
                "flex-1 py-2 rounded-md text-xs font-bold border-2 transition-all active:scale-95",
                workType === code
                  ? `${wt.className} border-current shadow-sm`
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
              )}
            >
              {wt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 日付選択 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1 block">開始日 <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              if (!endDate || new Date(e.target.value) > new Date(endDate)) {
                setEndDate(e.target.value)
              }
            }}
            className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-md focus:outline-none focus:border-blue-400 bg-white"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1 block">終了日 <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-md focus:outline-none focus:border-blue-400 bg-white"
          />
        </div>
      </div>

      {/* 作成ボタン */}
      <button
        type="button"
        onClick={handleCreate}
        disabled={creating || !startDate || !endDate}
        className="w-full py-2.5 rounded-lg text-sm font-extrabold bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.98] transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {creating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin inline" /> : <Plus className="w-4 h-4 mr-1.5 inline" />}
        {creating ? "作成中..." : "追加する"}
      </button>
    </div>
  )
}

interface SiteOpsDialogProps {
  open: boolean
  onClose: () => void
  schedule?: ScheduleData | null
  scheduleId?: string | null
  /** projectIdのみで開く（工程0件の現場でも表示可能） */
  projectId?: string | null
  /** 初期表示用プロジェクト名（API取得前のフラッシュ防止） */
  projectName?: string | null
  onUpdated?: () => void
  /** "dialog"=ダイアログ表示（デフォルト）, "inline"=インライン埋め込み */
  mode?: "dialog" | "inline"
  /** SO-2とSO-3の間に挿入するスロット（見積詳細など） */
  estimateSlot?: React.ReactNode
  /** 日程ビューの初期表示モード */
  defaultScheduleView?: "list" | "gantt"
}

export function SiteOpsDialog({ open, onClose, schedule: scheduleProp, scheduleId: scheduleIdProp, projectId: projectIdProp, projectName: projectNameProp, onUpdated, mode = "dialog", estimateSlot, defaultScheduleView }: SiteOpsDialogProps) {
  const router = useRouter()
  const [fetchedSchedule, setFetchedSchedule] = useState<ScheduleData | null>(null)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const schedule = scheduleProp ?? fetchedSchedule

  const [workContents, setWorkContents] = useState<WorkContentItem[]>([])
  const [siblings, setSiblings] = useState<ScheduleData[]>([])
  const [loadingSiblings, setLoadingSiblings] = useState(false)
  const [activeWorkContentId, setActiveWorkContentId] = useState<string | null>(null)
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null)
  const [scheduleViewMode, setScheduleViewMode] = useState<"list" | "gantt">(defaultScheduleView ?? "gantt")

  // projectIdのみで開いた場合のプロジェクト情報
  const [projectInfo, setProjectInfo] = useState<{ id: string; name: string; address?: string | null; companyName?: string; contactName?: string } | null>(null)

  // 作業内容タブの編集状態
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null)
  const [editGroupNameValue, setEditGroupNameValue] = useState("")
  const [savingGroupName, setSavingGroupName] = useState(false)
  const [deletingGroupName, setDeletingGroupName] = useState<string | null>(null)

  // 見積作成（テンプレート選択）
  const [estimateTemplates, setEstimateTemplates] = useState<EstimateTemplate[]>([])
  const [showEstimateCreate, setShowEstimateCreate] = useState(false)
  const [estimateType, setEstimateType] = useState<"INITIAL" | "ADDITIONAL">("INITIAL")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null)
  const [estimateTitle, setEstimateTitle] = useState("")
  const [creatingEstimate, setCreatingEstimate] = useState(false)
  const [existingEstimateCount, setExistingEstimateCount] = useState(0)

  // SO-2 カスタムボタン
  const [soSlots, setSOSlots] = useState<[SOCustomButtonId, SOCustomButtonId, SOCustomButtonId]>(SO_DEFAULTS)
  useEffect(() => {
    setSOSlots(getSOCustomSlots())
  }, [])

  function handleSOCustomClick(btnId: SOCustomButtonId) {
    const pid = projectId
    const addr = pAddress
    switch (btnId) {
      case "estimate":
        if (pid) window.open(`/projects/${pid}`, "_blank")
        else toast.info("プロジェクト情報がありません")
        break
      case "schedule":
        window.open("/schedules", "_blank")
        break
      case "call": {
        const phone = activeSchedule?.project?.contact?.phone
          ?? projectInfo?.contactName // fallback - but this is name not phone
        if (phone && phone.match(/[\d-]+/)) window.location.href = `tel:${phone}`
        else toast.info("担当者の電話番号が登録されていません")
        break
      }
      case "safety":
        toast.info("安全管理機能は準備中です")
        break
      case "report":
        toast.info("作業日報機能は準備中です")
        break
      case "weather":
        if (addr) window.open(`https://www.google.com/search?q=${encodeURIComponent(addr + " 天気")}`, "_blank")
        else toast.info("住所が登録されていません")
        break
      case "memo":
        toast.info("メモ機能は準備中です")
        break
    }
  }

  // 作業内容の新規追加
  const [addingWorkContent, setAddingWorkContent] = useState(false)
  const [newWorkContentName, setNewWorkContentName] = useState("")
  const [newWorkContentType, setNewWorkContentType] = useState("")
  const [savingWorkContent, setSavingWorkContent] = useState(false)

  // scheduleId のみの場合: APIから取得
  useEffect(() => {
    if (!open || scheduleProp || !scheduleIdProp) return
    setLoadingSchedule(true)
    fetch(`/api/schedules?scheduleId=${scheduleIdProp}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: ScheduleData[]) => {
        if (data.length > 0) setFetchedSchedule(data[0])
      })
      .catch(() => {})
      .finally(() => setLoadingSchedule(false))
  }, [open, scheduleProp, scheduleIdProp])

  // projectIdのみの場合: プロジェクト情報とWorkContent一覧を取得
  useEffect(() => {
    if (!open || scheduleProp || scheduleIdProp || !projectIdProp) return
    setLoadingSchedule(true)
    setProjectInfo(null)
    Promise.all([
      fetch(`/api/projects/${projectIdProp}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/work-contents?projectId=${projectIdProp}`).then((r) => r.ok ? r.json() : []),
    ])
      .then(([proj, wcs]: [Record<string, unknown> | null, WorkContentItem[]]) => {
        if (proj) {
          const branch = proj.branch as Record<string, unknown> | undefined
          const company = branch?.company as Record<string, unknown> | undefined
          const contact = proj.contact as Record<string, unknown> | undefined
          setProjectInfo({
            id: proj.id as string,
            name: proj.name as string,
            address: proj.address as string | null,
            companyName: company?.name as string | undefined,
            contactName: contact?.name as string | undefined,
          })
        }
        setWorkContents(wcs)
        const allSchedules = wcs.flatMap((wc) => wc.schedules.map((s) => ({ ...s, workContentId: wc.id, name: s.name ?? wc.name })))
        setSiblings(allSchedules)
        if (wcs.length > 0) {
          setActiveWorkContentId(wcs[0].id)
          if (wcs[0].schedules.length > 0) {
            setFetchedSchedule(wcs[0].schedules[0] as ScheduleData)
            setActiveScheduleId(wcs[0].schedules[0].id)
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSchedule(false))
  }, [open, scheduleProp, scheduleIdProp, projectIdProp])

  // テンプレート一覧を取得
  useEffect(() => {
    if (!open) return
    fetch("/api/templates")
      .then((r) => r.ok ? r.json() : [])
      .then((data: EstimateTemplate[]) => setEstimateTemplates(data))
      .catch(() => {})
  }, [open])

  const projectId = schedule?.project?.id ?? projectIdProp ?? undefined
  const fetchWorkContents = useCallback(async (projId: string) => {
    setLoadingSiblings(true)
    try {
      const res = await fetch(`/api/work-contents?projectId=${projId}`)
      if (!res.ok) throw new Error()
      const data: WorkContentItem[] = await res.json()
      setWorkContents(data)
      // siblings はすべての WorkContent のスケジュールをフラットに
      const allSchedules = data.flatMap((wc) => wc.schedules.map((s) => ({ ...s, workContentId: wc.id, name: s.name ?? wc.name })))
      setSiblings(allSchedules)
    } catch {
      setWorkContents([])
      setSiblings([])
    } finally {
      setLoadingSiblings(false)
    }
  }, [])

  useEffect(() => {
    if (open && schedule && projectId) {
      setActiveScheduleId(schedule.id)
      setActiveWorkContentId(schedule.workContentId ?? null)
      setSiblings([schedule])
      fetchWorkContents(projectId)
    }
    if (!open) {
      setSiblings([])
      setWorkContents([])
      setActiveScheduleId(null)
      setActiveWorkContentId(null)
      setFetchedSchedule(null)
      setProjectInfo(null)
      setShowEstimateCreate(false)
      setSelectedTemplateId(null)
      setPreviewTemplateId(null)
      setEstimateTitle("")
    }
  }, [open, schedule, projectId, fetchWorkContents])

  // グループが1つだけの場合は自動的にそのグループを選択
  useEffect(() => {
    if (workContents.length === 1 && activeWorkContentId === ALL_GROUP_KEY) {
      setActiveWorkContentId(workContents[0].id)
      if (workContents[0].schedules.length > 0) {
        setActiveScheduleId(workContents[0].schedules[0].id)
      }
    }
  }, [workContents, activeWorkContentId])

  const isAllView = activeWorkContentId === ALL_GROUP_KEY

  const activeWC = isAllView
    ? null
    : workContents.find((wc) => wc.id === activeWorkContentId)
      ?? workContents.find((wc) => wc.schedules.some((s) => s.id === activeScheduleId))
      ?? workContents[0]
      ?? null

  // 全体表示時は全siblings、個別グループ時はそのWorkContentのスケジュール
  const displaySchedules = isAllView ? siblings : (activeWC?.schedules ?? [])

  const activeSchedule = schedule
    ? (displaySchedules.find((s) => s.id === activeScheduleId)
      ?? displaySchedules[0]
      ?? siblings.find((s) => s.id === activeScheduleId)
      ?? siblings[0]
      ?? schedule)
    : (displaySchedules.find((s) => s.id === activeScheduleId)
      ?? displaySchedules[0]
      ?? siblings.find((s) => s.id === activeScheduleId)
      ?? siblings[0]
      ?? null)

  const statusInfo = activeSchedule ? deriveStatus(activeSchedule.actualStartDate, activeSchedule.actualEndDate) : null

  function handleGroupChange(wcId: string) {
    setActiveWorkContentId(wcId)
    if (wcId === ALL_GROUP_KEY) return
    const wc = workContents.find((w) => w.id === wcId)
    if (wc && wc.schedules.length > 0) {
      setActiveScheduleId(wc.schedules[0].id)
    }
  }

  async function handleSaveGroupName(wc: WorkContentItem) {
    setSavingGroupName(true)
    try {
      const newName = editGroupNameValue.trim()
      if (!newName) { toast.error("名前を入力してください"); return }
      const res = await fetch(`/api/work-contents/${wc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) throw new Error()
      toast.success("作業内容名を更新しました")
      setEditingGroupName(null)
      handleUpdated()
    } catch {
      toast.error("作業内容名の更新に失敗しました")
    } finally {
      setSavingGroupName(false)
    }
  }

  async function handleDeleteGroup(wc: WorkContentItem) {
    const ok = window.confirm(`「${wc.name}」と関連する全工事日程（${wc.schedules.length}件）を削除しますか？\nこの操作は取り消せません。`)
    if (!ok) return

    setDeletingGroupName(wc.id)
    try {
      const res = await fetch(`/api/work-contents/${wc.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success(`「${wc.name}」を削除しました`)
      if (activeWorkContentId === wc.id) {
        const remaining = workContents.filter((w) => w.id !== wc.id)
        if (remaining.length > 0) {
          setActiveWorkContentId(remaining[0].id)
          setActiveScheduleId(remaining[0].schedules[0]?.id ?? null)
        } else {
          onClose()
        }
      }
      handleUpdated()
    } catch {
      toast.error("削除に失敗しました")
    } finally {
      setDeletingGroupName(null)
    }
  }

  async function handleAddWorkContent() {
    if (!newWorkContentName.trim() || !projectId) {
      toast.error("作業内容名を入力してください")
      return
    }
    setSavingWorkContent(true)
    try {
      const res = await fetch("/api/work-contents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: newWorkContentName.trim(),
        }),
      })
      if (!res.ok) throw new Error()
      const created: WorkContentItem = await res.json()
      toast.success(`作業内容「${newWorkContentName.trim()}」を追加しました`)
      setAddingWorkContent(false)
      setNewWorkContentName("")
      setNewWorkContentType("")
      setActiveWorkContentId(created.id)
      handleUpdated()
    } catch {
      toast.error("追加に失敗しました")
    } finally {
      setSavingWorkContent(false)
    }
  }

  function handleScheduleDeleted() {
    handleUpdated()
  }

  // 一式テンプレートを検出
  const issikiTemplate = estimateTemplates.find((t) => t.name === ISSIKI_TEMPLATE_NAME) ?? null

  // 見積作成
  async function handleCreateEstimate() {
    if (!projectId) return
    const isMasterPicker = selectedTemplateId === MASTER_PICKER_ID
    setCreatingEstimate(true)
    try {
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          templateId: isMasterPicker ? undefined : (selectedTemplateId || undefined),
          title: estimateTitle.trim() || `${activeSchedule?.project?.name ?? projectInfo?.name ?? ""} ${existingEstimateCount + 1}`.trim() || null,
          estimateType,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()

      // 自動確定
      try {
        await fetch(`/api/estimates/${data.id}/confirm`, { method: "POST" })
      } catch {}

      toast.success(selectedTemplateId && !isMasterPicker ? "テンプレートから見積を作成しました" : "見積を作成しました")
      setShowEstimateCreate(false)
      setSelectedTemplateId(null)
      setPreviewTemplateId(null)
      setEstimateTitle("")
      setExistingEstimateCount((c) => c + 1)
      handleUpdated()
      // 項目マスタの場合はピッカー付きで遷移
      const url = isMasterPicker
        ? `/estimates/${data.id}?openPicker=true`
        : `/estimates/${data.id}`
      router.push(url)
    } catch {
      toast.error("見積の作成に失敗しました")
    } finally {
      setCreatingEstimate(false)
    }
  }

  function openEstimateCreate() {
    const type = existingEstimateCount > 0 ? "ADDITIONAL" : "INITIAL"
    setEstimateType(type)
    setSelectedTemplateId(null)
    setPreviewTemplateId(null)
    // 見積タイトル = 「現場名 連番」（常に自動入力）
    const siteName = activeSchedule?.project?.name ?? projectInfo?.name ?? projectNameProp ?? ""
    const nextNum = existingEstimateCount + 1
    setEstimateTitle(siteName ? `${siteName} ${nextNum}` : "")
    // テンプレートが1つだけならば自動選択
    const filtered = estimateTemplates.filter((t) => t.estimateType === "BOTH" || t.estimateType === type)
    if (filtered.length === 1) setSelectedTemplateId(filtered[0].id)
    setShowEstimateCreate(true)
  }

  const handleUpdated = () => {
    if (projectId) {
      fetchWorkContents(projectId)
    }
    onUpdated?.()
  }

  const showLoading = loadingSchedule && !schedule && !projectInfo

  // projectInfoモード用の表示データ
  const pSiteName = activeSchedule?.project?.name ?? projectInfo?.name ?? projectNameProp ?? "読み込み中..."
  const pAddress = activeSchedule?.project?.address ?? projectInfo?.address ?? null
  const pCompanyName = activeSchedule?.project?.branch?.company?.name ?? projectInfo?.companyName ?? "―"
  const pContactName = activeSchedule?.project?.contact?.name ?? projectInfo?.contactName ?? "―"

  // ── コンテンツ描画 ──
  const content = (
    <>
        {showLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (activeSchedule || projectInfo) ? (
          <>
            {/* ═══ 全体スクロール ═══ */}
            <div className="flex-1 overflow-y-auto">

            {/* ═══ M1: ヘッダー（全情報集約） ═══ */}
            <div className="bg-slate-50 border-b border-slate-200 relative">
              <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">SO-1</span>
              {/* 閉じるボタン */}
              <div className="flex justify-end px-4 pt-3">
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-bold text-slate-500 hover:bg-slate-200 active:bg-slate-300 transition-colors active:scale-95"
                >
                  <X className="w-4 h-4" />
                  閉じる
                </button>
              </div>

              <div className="px-6 pb-4 space-y-2.5">
                {/* 現場名 + ステータス */}
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-2xl font-extrabold text-slate-900 leading-tight truncate min-w-0 flex-1">
                    {pSiteName}
                  </h2>
                  {statusInfo && (
                    <span className={cn(
                      "px-3 py-1.5 rounded-sm text-sm font-extrabold flex-shrink-0",
                      statusInfo.badgeBg, statusInfo.badgeText
                    )}>
                      {statusInfo.label}
                    </span>
                  )}
                </div>

                {/* 詳細情報グリッド */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 font-bold">元請会社</span>
                    <p className="text-slate-800 font-extrabold text-sm truncate">{pCompanyName}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-bold">契約番号</span>
                    <p className="text-slate-800 font-extrabold text-sm tabular-nums">{activeSchedule?.contract?.contractNumber ?? "―"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-bold">契約金額</span>
                    <p className="text-slate-800 font-black text-sm tabular-nums">{activeSchedule ? `¥${Number(activeSchedule.contract?.contractAmount ?? 0).toLocaleString()}` : "―"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-bold">合計金額</span>
                    <p className="text-slate-800 font-black text-sm tabular-nums">{activeSchedule ? `¥${Number(activeSchedule.contract?.totalAmount ?? 0).toLocaleString()}` : "―"}</p>
                  </div>
                </div>

                {/* 日程 + 住所 + 担当者 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 font-bold">実績</span>
                    <p className="text-slate-800 font-medium text-xs tabular-nums">
                      {activeSchedule?.actualStartDate ? new Date(activeSchedule.actualStartDate).toLocaleDateString("ja-JP") : "―"}
                      {" 〜 "}
                      {activeSchedule?.actualEndDate ? new Date(activeSchedule.actualEndDate).toLocaleDateString("ja-JP") : "―"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-bold">住所</span>
                    {pAddress ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-green-700 font-bold hover:text-green-800 truncate"
                      >
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{pAddress}</span>
                      </a>
                    ) : (
                      <p className="text-slate-400 text-xs">―</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-bold">担当者</span>
                    <p className="text-slate-800 font-medium text-xs truncate">{pContactName}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ M2: アクションカード群（V2: 4ボタン） ═══ */}
            <div className="px-6 py-3 border-b border-slate-200 bg-white relative">
              <span className="absolute top-1 left-1 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">SO-2</span>
              <div className="grid grid-cols-5 gap-2">
                {/* Googleマップ（固定） */}
                <a
                  href={pAddress
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pAddress)}`
                    : undefined
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-sm border-2 transition-all active:scale-95 ${
                    pAddress
                      ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100 cursor-pointer"
                      : "bg-slate-50 border-dashed border-slate-300 text-slate-400 cursor-not-allowed"
                  }`}
                  onClick={(e) => { if (!pAddress) e.preventDefault() }}
                >
                  <MapPin className="w-5 h-5" />
                  <span className="text-xs font-bold">Googleマップ</span>
                </a>

                {/* 画像登録（固定） */}
                <button
                  onClick={() => {
                    document.getElementById("siteops-photo-section")?.scrollIntoView({ behavior: "smooth" })
                  }}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-sm border-2 bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100 active:scale-95 transition-all"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-xs font-bold">画像登録</span>
                </button>

                {/* カスタムスロット 1〜3 */}
                {([0, 1, 2] as const).map((slotIdx) => {
                  const btnDef = SO_CUSTOM_MAP[soSlots[slotIdx]]
                  const Icon = btnDef.icon
                  return (
                    <div key={slotIdx} className="relative group">
                      <button
                        onClick={() => handleSOCustomClick(soSlots[slotIdx])}
                        className={`w-full flex flex-col items-center justify-center gap-1.5 p-3 rounded-sm border-2 ${btnDef.dashed ? "border-dashed" : ""} ${btnDef.bg} ${btnDef.border} ${btnDef.text} hover:brightness-95 active:scale-95 transition-all`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs font-bold">{btnDef.label}</span>
                      </button>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <SOCustomSelector
                          slotIndex={slotIdx}
                          currentId={soSlots[slotIdx]}
                          onSelect={(id) => {
                            setSOCustomSlot(slotIdx, id)
                            setSOSlots(getSOCustomSlots())
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ═══ 見積スロット（SO-2とSO-3の間） ═══ */}
            {estimateSlot && (
              <div className="px-6 py-3 border-b border-slate-200 bg-white relative">
                <span className="absolute top-1 left-1 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">SO-2.5</span>
                {estimateSlot}
              </div>
            )}

            {/* ═══ コンテンツ（全セクション一画面表示） ═══ */}
            <div className="bg-white p-6 space-y-4">

              {/* M3: 作業内容タブ */}
              <div className="relative">
                <span className="absolute -top-1 -left-1 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">SO-3</span>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-base font-extrabold text-slate-800 ml-7">作業内容</h3>
                  {loadingSiblings && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  {/* ★ 全体表示ボタン */}
                  <button
                    onClick={() => handleGroupChange(ALL_GROUP_KEY)}
                    className={cn(
                      "text-left rounded-sm border-2 px-4 py-2.5 transition-all hover:shadow-md active:scale-[0.99] flex items-center gap-2",
                      isAllView
                        ? "bg-gradient-to-r from-violet-50 to-purple-50 border-violet-400 ring-2 ring-violet-300 shadow-md"
                        : "bg-white border-slate-200 hover:border-violet-300 hover:bg-violet-50/50"
                    )}
                  >
                    <Layers className={cn("w-4 h-4", isAllView ? "text-violet-600" : "text-slate-400")} />
                    <span className={cn("text-sm font-extrabold", isAllView ? "text-violet-700" : "text-slate-600")}>全体</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-sm text-xs font-bold",
                      isAllView ? "bg-violet-200 text-violet-700" : "bg-slate-100 text-slate-500"
                    )}>
                      {siblings.length}件
                    </span>
                  </button>

                  {/* 個別作業内容タブ */}
                  {workContents.map((wc) => {
                    const isActive = !isAllView && wc.id === activeWC?.id
                    const allCompleted = wc.schedules.length > 0 && wc.schedules.every((s) => s.actualEndDate)
                    const someStarted = wc.schedules.some((s) => s.actualStartDate)
                    const isEditingThis = editingGroupName === wc.id
                    const isDeletingThis = deletingGroupName === wc.id
                    const workTypeLabels = wc.schedules.map((s) =>
                      (WORK_TYPE_BADGE[s.workType] ?? WORK_TYPE_BADGE.REWORK).label
                    )
                    const uniqueLabels = [...new Set(workTypeLabels)]
                    const primaryType = WORK_TYPE_BADGE[wc.schedules[0]?.workType] ?? WORK_TYPE_BADGE.REWORK

                    return (
                      <div key={wc.id} className="relative group/tab">
                        {isEditingThis ? (
                          <div className="flex items-center gap-2 rounded-sm border-2 border-blue-400 bg-blue-50 px-3 py-2">
                            <Input
                              value={editGroupNameValue}
                              onChange={(e) => setEditGroupNameValue(e.target.value)}
                              className="h-7 text-xs font-bold flex-1 w-24"
                              autoFocus
                              maxLength={100}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveGroupName(wc)
                                if (e.key === "Escape") setEditingGroupName(null)
                              }}
                            />
                            <button
                              onClick={() => handleSaveGroupName(wc)}
                              disabled={savingGroupName}
                              className="px-2 py-1 rounded-sm bg-green-500 text-white text-xs font-bold hover:bg-green-600 active:scale-95 transition-all"
                            >
                              {savingGroupName ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            </button>
                            <button
                              onClick={() => setEditingGroupName(null)}
                              className="px-1.5 py-1 rounded-sm bg-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-300 active:scale-95 transition-all"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleGroupChange(wc.id)}
                            className={cn(
                              "text-left rounded-sm border-l-[5px] border-2 px-4 py-2.5 transition-all hover:shadow-md active:scale-[0.99]",
                              primaryType.cardBorder,
                              isActive
                                ? `${primaryType.cardBg} ring-2 ring-blue-300 shadow-md border-slate-200`
                                : "bg-white border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-extrabold text-slate-800 truncate">{wc.name}</span>
                              {uniqueLabels.map((label) => {
                                const code = Object.entries(WORK_TYPE_BADGE).find(([, v]) => v.label === label)?.[0] ?? "REWORK"
                                const badge = WORK_TYPE_BADGE[code] ?? WORK_TYPE_BADGE.REWORK
                                return (
                                  <span key={label} className={cn("px-1.5 py-0.5 rounded-sm text-xs font-bold", badge.className)}>
                                    {label}
                                  </span>
                                )
                              })}
                              {allCompleted ? (
                                <span className="px-2 py-0.5 rounded-sm text-xs font-extrabold bg-emerald-500 text-white">完工</span>
                              ) : someStarted ? (
                                <span className="px-2 py-0.5 rounded-sm text-xs font-extrabold bg-amber-500 text-white">作業中</span>
                              ) : null}
                              <span className="px-1.5 py-0.5 rounded-sm text-xs font-bold bg-slate-100 text-slate-500">
                                {wc.schedules.length}件
                              </span>
                            </div>
                          </button>
                        )}
                        {/* 編集・削除ボタン（ホバー時に表示） */}
                        {!isEditingThis && (
                          <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 opacity-0 group-hover/tab:opacity-100 transition-all z-10">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditGroupNameValue(wc.name)
                                setEditingGroupName(wc.id)
                              }}
                              className="px-1.5 py-1 rounded-sm bg-white border-2 border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 text-xs font-bold transition-all active:scale-95 shadow-sm"
                              title="名前を編集"
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteGroup(wc)
                              }}
                              disabled={isDeletingThis}
                              className="px-1.5 py-1 rounded-sm bg-white border-2 border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-500 hover:bg-red-50 text-xs font-bold transition-all active:scale-95 shadow-sm"
                              title="削除"
                            >
                              {isDeletingThis ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* 作業内容を追加 */}
                  {!addingWorkContent && (
                    <button
                      onClick={() => setAddingWorkContent(true)}
                      className="rounded-sm border-2 border-dashed border-blue-300 px-4 py-2.5 text-sm font-bold text-blue-500 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-50 transition-all active:scale-[0.99] flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      追加
                    </button>
                  )}
                </div>

                {/* 作業内容の新規追加フォーム（名前のみ、日程はガントで管理） */}
                {addingWorkContent && (
                  <div className="mt-2 rounded-sm border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 space-y-3">
                    <div className="text-sm font-extrabold text-blue-700 flex items-center gap-1.5">
                      <Plus className="w-4 h-4" />
                      作業内容を追加
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 font-bold mb-1 block">作業内容名</label>
                      <Input
                        className="h-9 text-sm font-medium border-2"
                        placeholder="例: 北面足場、1階部分など"
                        value={newWorkContentName}
                        onChange={(e) => setNewWorkContentName(e.target.value)}
                        maxLength={100}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddWorkContent()
                          if (e.key === "Escape") setAddingWorkContent(false)
                        }}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setAddingWorkContent(false)}
                        disabled={savingWorkContent}
                        className="px-4 py-2 rounded-sm text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={handleAddWorkContent}
                        disabled={savingWorkContent || !newWorkContentName.trim()}
                        className="px-4 py-2 rounded-sm text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingWorkContent ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin inline" /> : <Plus className="w-4 h-4 mr-1.5 inline" />}
                        追加
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* M4: 工事日程 */}
              <div className="relative">
                <span className="absolute -top-1 -left-1 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">SO-4</span>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-extrabold text-slate-800 ml-7">
                    工事日程
                    {isAllView && (
                      <span className="ml-2 text-xs font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-sm">全体表示</span>
                    )}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setScheduleViewMode("list")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-bold transition-all active:scale-95",
                        scheduleViewMode === "list"
                          ? "bg-blue-500 text-white shadow-lg shadow-blue-200"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}
                    >
                      <List className="w-3.5 h-3.5" />
                      リスト
                    </button>
                    <button
                      onClick={() => setScheduleViewMode("gantt")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-bold transition-all active:scale-95",
                        scheduleViewMode === "gantt"
                          ? "bg-blue-500 text-white shadow-lg shadow-blue-200"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      ガント
                    </button>
                  </div>
                </div>

                {/* 工程0件でも現場名をデフォルトの作業内容名として使う */}
                {(() => {
                  const effectiveWcId = isAllView ? undefined : (activeWC?.id ?? undefined)
                  const effectiveGroupName = isAllView ? undefined : (activeWC?.name ?? projectInfo?.name ?? projectNameProp ?? undefined)
                  return (
                <div className="rounded-sm border-2 border-slate-200 bg-white overflow-hidden">
                  {scheduleViewMode === "list" ? (
                    <div className="p-4">
                      <SiteOpsDateSection
                        key={`date-${isAllView ? "all" : effectiveWcId ?? projectId}`}
                        activeScheduleId={activeSchedule?.id ?? displaySchedules[0]?.id ?? ""}
                        siblings={displaySchedules}
                        projectId={projectId!}
                        workContentId={effectiveWcId}
                        groupName={effectiveGroupName}
                        onUpdated={handleUpdated}
                      />
                    </div>
                  ) : (
                    <div className="p-3">
                      <ScheduleMiniGantt
                        key={`gantt-${isAllView ? "all" : effectiveWcId ?? projectId}`}
                        schedules={displaySchedules.map((s) => ({
                          id: s.id,
                          contractId: s.contractId,
                          estimateId: s.estimateId,
                          workContentId: s.workContentId,
                          workType: s.workType,
                          name: s.name,
                          plannedStartDate: s.plannedStartDate,
                          plannedEndDate: s.plannedEndDate,
                          actualStartDate: s.actualStartDate,
                          actualEndDate: s.actualEndDate,
                          workersCount: s.workersCount ?? null,
                          notes: s.notes,
                        }))}
                        displayDays={15}
                        promptGroupName={isAllView}
                        defaultGroupName={isAllView ? null : (effectiveGroupName ?? null)}
                        defaultWorkContentId={effectiveWcId ?? null}
                        onCreateSchedule={async (workType, name, startDate, endDate, workContentId) => {
                          try {
                            const wcId = workContentId || effectiveWcId
                            if (!wcId) { toast.error("作業内容が選択されていません"); return }
                            const res = await fetch("/api/schedules", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                projectId,
                                workContentId: wcId,
                                workType,
                                name: name || effectiveGroupName || null,
                                plannedStartDate: startDate,
                                plannedEndDate: endDate,
                              }),
                            })
                            if (!res.ok) throw new Error()
                            toast.success("工事日程を追加しました")
                            handleUpdated()
                          } catch { toast.error("追加に失敗しました") }
                        }}
                        onUpdateDates={async (scheduleId, startDate, endDate) => {
                          try {
                            const res = await fetch(`/api/schedules/${scheduleId}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ plannedStartDate: startDate, plannedEndDate: endDate }),
                            })
                            if (!res.ok) throw new Error()
                            toast.success("日付を更新しました")
                            handleUpdated()
                          } catch { toast.error("更新に失敗しました") }
                        }}
                      />
                    </div>
                  )}
                </div>
                  )
                })()}
              </div>

              {/* M5: 見積作成（estimateSlot がある場合はボタンのみ表示） */}
              <div className="rounded-sm border-2 border-slate-200 bg-white p-4 space-y-4 relative">
                <span className="absolute top-1 left-1 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">SO-5</span>

                {/* 見積を追加ボタン */}
                {projectId && !showEstimateCreate && (
                  <button
                    onClick={openEstimateCreate}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-sm border-2 border-dashed border-blue-300 text-blue-600 font-bold text-sm hover:bg-blue-50 hover:border-blue-400 active:scale-[0.99] transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    {existingEstimateCount > 0 ? "追加見積を作成" : "新規見積を作成"}
                  </button>
                )}

                {/* 見積作成フォーム（テンプレート選択） */}
                {showEstimateCreate && (
                  <div className="rounded-sm border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-extrabold text-blue-700 flex items-center gap-1.5">
                        <Receipt className="w-4 h-4" />
                        見積を作成
                      </h4>
                      <button onClick={() => setShowEstimateCreate(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* 見積タイトル */}
                    <div>
                      <label className="text-xs text-slate-600 font-bold mb-1 block">見積タイトル（任意）</label>
                      <Input
                        placeholder="例: A棟工事、追加養生"
                        value={estimateTitle}
                        onChange={(e) => setEstimateTitle(e.target.value)}
                        className="h-9 text-sm border-2"
                      />
                    </div>

                    {/* 見積種別（通常/追加） */}
                    <div>
                      <label className="text-xs text-slate-600 font-bold mb-1.5 block">見積の種別</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => { setEstimateType("INITIAL"); setSelectedTemplateId(null) }}
                          className={cn(
                            "p-2.5 rounded-sm border-2 text-left transition-all active:scale-[0.99]",
                            estimateType === "INITIAL"
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <FilePlus2 className="w-4 h-4 text-blue-500" />
                            <span className="font-bold text-sm">通常見積</span>
                            {estimateType === "INITIAL" && <CheckCircle2 className="w-4 h-4 text-blue-500 ml-auto" />}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">初回・通常の見積</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEstimateType("ADDITIONAL"); setSelectedTemplateId(null) }}
                          className={cn(
                            "p-2.5 rounded-sm border-2 text-left transition-all active:scale-[0.99]",
                            estimateType === "ADDITIONAL"
                              ? "border-amber-500 bg-amber-50"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-amber-500" />
                            <span className="font-bold text-sm">追加見積</span>
                            {estimateType === "ADDITIONAL" && <CheckCircle2 className="w-4 h-4 text-amber-500 ml-auto" />}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">追加・変更工事</p>
                        </button>
                      </div>
                    </div>

                    {/* 作成方法 */}
                    <div>
                      <label className="text-xs text-slate-600 font-bold mb-1.5 block">作成方法</label>
                      <div className="space-y-1.5">
                        {/* 一式見積作成 */}
                        {issikiTemplate && (
                          <button
                            type="button"
                            onClick={() => setSelectedTemplateId(selectedTemplateId === issikiTemplate.id ? null : issikiTemplate.id)}
                            className={cn(
                              "w-full text-left p-2.5 rounded-sm border-2 transition-all active:scale-[0.99]",
                              selectedTemplateId === issikiTemplate.id
                                ? "border-blue-500 bg-blue-50"
                                : "border-slate-200 hover:border-slate-300 bg-white"
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={cn("w-6 h-6 rounded-full flex items-center justify-center", selectedTemplateId === issikiTemplate.id ? "bg-blue-500" : "bg-slate-200")}>
                                {selectedTemplateId === issikiTemplate.id ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <Zap className="w-3 h-3 text-slate-500" />}
                              </span>
                              <div>
                                <p className={cn("font-bold text-sm", selectedTemplateId === issikiTemplate.id ? "text-blue-800" : "text-slate-900")}>一式見積作成</p>
                                <p className="text-xs text-slate-500">「{ISSIKI_TEMPLATE_NAME}」テンプレートで作成</p>
                              </div>
                            </div>
                          </button>
                        )}

                        {/* 項目マスタから作成 */}
                        <button
                          type="button"
                          onClick={() => setSelectedTemplateId(MASTER_PICKER_ID)}
                          className={cn(
                            "w-full text-left p-2.5 rounded-sm border-2 transition-all active:scale-[0.99]",
                            selectedTemplateId === MASTER_PICKER_ID
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={cn("w-6 h-6 rounded-full flex items-center justify-center", selectedTemplateId === MASTER_PICKER_ID ? "bg-emerald-500" : "bg-slate-200")}>
                              {selectedTemplateId === MASTER_PICKER_ID ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <Package className="w-3 h-3 text-slate-500" />}
                            </span>
                            <div>
                              <p className={cn("font-bold text-sm", selectedTemplateId === MASTER_PICKER_ID ? "text-emerald-800" : "text-slate-900")}>項目マスタから作成</p>
                              <p className={cn("text-xs", selectedTemplateId === MASTER_PICKER_ID ? "text-emerald-600" : "text-slate-500")}>マスタから必要な項目を選んで見積を作成</p>
                            </div>
                          </div>
                        </button>

                        {/* 空の見積 */}
                        <button
                          type="button"
                          onClick={() => setSelectedTemplateId(null)}
                          className={cn(
                            "w-full text-left p-2.5 rounded-sm border-2 transition-all active:scale-[0.99]",
                            selectedTemplateId === null
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={cn("w-6 h-6 rounded-full flex items-center justify-center", selectedTemplateId === null ? "bg-blue-500" : "bg-slate-200")}>
                              {selectedTemplateId === null ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <FileText className="w-3 h-3 text-slate-500" />}
                            </span>
                            <div>
                              <p className="font-bold text-sm text-slate-900">空の見積から作成</p>
                              <p className="text-xs text-slate-500">一から明細を入力する</p>
                            </div>
                          </div>
                        </button>
                      </div>

                      {/* その他テンプレート一覧 */}
                      {(() => {
                        const filtered = estimateTemplates.filter((t) =>
                          t.id !== issikiTemplate?.id && (t.estimateType === "BOTH" || t.estimateType === estimateType)
                        )
                        if (filtered.length === 0) return null
                        return (
                          <div className="space-y-1.5">
                            <p className="text-xs font-bold text-slate-500 px-1">
                              {estimateType === "INITIAL" ? "通常" : "追加"}見積用テンプレート
                            </p>
                            {filtered.map((tpl) => {
                              const isSelected = selectedTemplateId === tpl.id
                              const isPreviewing = previewTemplateId === tpl.id
                              const secs = tpl.sections ?? []
                              const itemCount = secs.reduce(
                                (s, sec) => s + sec.groups.reduce((gs, g) => gs + g.items.length, 0), 0
                              )
                              return (
                                <div key={tpl.id} className={cn("rounded-sm border-2 overflow-hidden transition-all", isSelected ? "border-blue-500 shadow-sm" : "border-slate-200")}>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedTemplateId(isSelected ? null : tpl.id)}
                                    className={cn("w-full flex items-start gap-2.5 p-2.5 text-left transition-colors", isSelected ? "bg-blue-50" : "bg-white hover:bg-slate-50")}
                                  >
                                    <span className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5", isSelected ? "bg-blue-500" : "bg-slate-200")}>
                                      {isSelected ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <LayoutTemplate className="w-3 h-3 text-slate-500" />}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                      <span className={cn("block font-bold text-sm", isSelected ? "text-blue-800" : "text-slate-800")}>{tpl.name}</span>
                                      {tpl.description && <span className="block text-xs text-slate-500 mt-0.5">{tpl.description}</span>}
                                      <span className="text-xs text-slate-500 mt-0.5 block">{secs.length}セクション / {itemCount}項目</span>
                                    </span>
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setPreviewTemplateId(isPreviewing ? null : tpl.id)
                                        if (!isPreviewing) setSelectedTemplateId(tpl.id)
                                      }}
                                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setPreviewTemplateId(isPreviewing ? null : tpl.id); if (!isPreviewing) setSelectedTemplateId(tpl.id) } }}
                                      className={cn("shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold cursor-pointer transition-colors", isPreviewing ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                                    >
                                      <Eye className="w-3 h-3" />
                                      {isPreviewing ? "閉じる" : "中身を見る"}
                                      {isPreviewing ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    </span>
                                  </button>
                                  {isPreviewing && secs.length > 0 && (
                                    <div className="border-t border-slate-100 bg-slate-50 px-3 py-2.5 space-y-2">
                                      {secs.map((sec) => (
                                        <div key={sec.id}>
                                          <p className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                                            {sec.name}
                                          </p>
                                          {sec.groups.map((grp) => (
                                            <div key={grp.id} className="ml-3 mb-1.5">
                                              <p className="text-xs font-medium text-slate-500 mb-0.5">{grp.name}</p>
                                              <div className="rounded overflow-hidden border border-slate-200">
                                                <table className="w-full text-xs">
                                                  <thead>
                                                    <tr className="bg-slate-100 text-slate-500">
                                                      <th className="text-left px-2 py-0.5 font-medium">品名</th>
                                                      <th className="text-right px-2 py-0.5 font-medium w-14">数量</th>
                                                      <th className="text-left px-2 py-0.5 font-medium w-10">単位</th>
                                                      <th className="text-right px-2 py-0.5 font-medium w-20">単価</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-slate-100 bg-white">
                                                    {grp.items.map((item) => (
                                                      <tr key={item.id}>
                                                        <td className="px-2 py-1 text-slate-700">{item.name}</td>
                                                        <td className="px-2 py-1 text-right text-slate-600 tabular-nums">{item.quantity > 0 ? item.quantity : "—"}</td>
                                                        <td className="px-2 py-1 text-slate-500">{item.unit?.name ?? "—"}</td>
                                                        <td className="px-2 py-1 text-right text-slate-700 tabular-nums">¥{Number(item.unitPrice).toLocaleString()}</td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>

                    {/* 作成ボタン */}
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setShowEstimateCreate(false)}
                        disabled={creatingEstimate}
                        className="px-4 py-2 rounded-sm text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={handleCreateEstimate}
                        disabled={creatingEstimate}
                        className="px-4 py-2 rounded-sm text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                      >
                        {creatingEstimate ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin inline" /> : <Plus className="w-4 h-4 mr-1.5 inline" />}
                        {selectedTemplateId === MASTER_PICKER_ID ? "項目マスタで作成" : selectedTemplateId ? "テンプレートで作成" : "空の見積で作成"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* M6: 写真 */}
              <div id="siteops-photo-section" className="rounded-sm border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 relative">
                <span className="absolute top-1 left-1 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">SO-6</span>
                <SiteOpsPhotoSection projectId={projectId!} />
              </div>
            </div>

            </div>{/* 全体スクロール end */}
          </>
        ) : (
          <div className="px-6 pb-6 text-center text-base font-bold text-slate-400 py-16">
            データが見つかりませんでした
          </div>
        )}
    </>
  )

  // インラインモード: Dialogなしでそのまま描画
  if (mode === "inline") {
    if (!open) return null
    return (
      <div className="overflow-hidden bg-white">
        {content}
      </div>
    )
  }

  // ダイアログモード
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-sm border-2 border-slate-300">
        {content}
      </DialogContent>
    </Dialog>
  )
}
