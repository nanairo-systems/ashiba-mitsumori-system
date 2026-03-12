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
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  X, Loader2, Pencil, Trash2, Check, Plus, List, BarChart3,
  MapPin, Camera,
  Users, ShieldCheck, Layers,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { SiteOpsDateSection } from "./SiteOpsDateSection"
import { SiteOpsPhotoSection } from "./SiteOpsPhotoSection"
import { SiteOpsEstimateSection } from "./SiteOpsEstimateSection"
import { ScheduleMiniGantt } from "@/components/schedules/ScheduleMiniGantt"
import { cn } from "@/lib/utils"
import type { ScheduleData } from "@/components/worker-assignments/types"

/** 作業種別のスタイル（V2準拠） */
const WORK_TYPE_BADGE: Record<string, { label: string; className: string; cardBg: string; cardBorder: string }> = {
  ASSEMBLY: { label: "組立", className: "bg-blue-100 text-blue-700 border-blue-300", cardBg: "bg-gradient-to-r from-blue-50 to-indigo-50", cardBorder: "border-l-blue-500" },
  DISASSEMBLY: { label: "解体", className: "bg-orange-100 text-orange-700 border-orange-300", cardBg: "bg-gradient-to-r from-orange-50 to-amber-50", cardBorder: "border-l-orange-500" },
  REWORK: { label: "その他", className: "bg-slate-100 text-slate-600 border-slate-300", cardBg: "bg-slate-50", cardBorder: "border-l-slate-400" },
}

/** 「全体」表示のための特殊キー */
const ALL_GROUP_KEY = "__ALL__"

/** 作業内容（schedule.name）単位のグループ */
interface WorkContentGroup {
  name: string
  schedules: ScheduleData[]
}

/** siblingsをschedule.name単位でグループ化 */
function groupByWorkContent(siblings: ScheduleData[]): WorkContentGroup[] {
  const namedMap = new Map<string, ScheduleData[]>()
  const unnamed: ScheduleData[] = []

  for (const s of siblings) {
    if (s.name) {
      if (!namedMap.has(s.name)) namedMap.set(s.name, [])
      namedMap.get(s.name)!.push(s)
    } else {
      unnamed.push(s)
    }
  }

  const groups: WorkContentGroup[] = []
  const sortedNames = [...namedMap.keys()].sort()
  for (const name of sortedNames) {
    groups.push({ name, schedules: namedMap.get(name)! })
  }
  for (const s of unnamed) {
    const label = (WORK_TYPE_BADGE[s.workType] ?? WORK_TYPE_BADGE.REWORK).label
    groups.push({ name: label, schedules: [s] })
  }
  return groups
}

/** ステータス判定（V2スタイル） */
function deriveStatus(actualStart: string | null, actualEnd: string | null) {
  if (actualEnd) return { label: "完工済", badgeBg: "bg-emerald-500", badgeText: "text-white" }
  if (actualStart) return { label: "作業中", badgeBg: "bg-amber-500", badgeText: "text-white" }
  return { label: "未着工", badgeBg: "bg-slate-400", badgeText: "text-white" }
}

interface SiteOpsDialogProps {
  open: boolean
  onClose: () => void
  schedule?: ScheduleData | null
  scheduleId?: string | null
  onUpdated?: () => void
}

export function SiteOpsDialog({ open, onClose, schedule: scheduleProp, scheduleId: scheduleIdProp, onUpdated }: SiteOpsDialogProps) {
  const router = useRouter()
  const [fetchedSchedule, setFetchedSchedule] = useState<ScheduleData | null>(null)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const schedule = scheduleProp ?? fetchedSchedule

  const [siblings, setSiblings] = useState<ScheduleData[]>([])
  const [loadingSiblings, setLoadingSiblings] = useState(false)
  const [activeGroupName, setActiveGroupName] = useState<string | null>(null)
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null)
  const [scheduleViewMode, setScheduleViewMode] = useState<"list" | "gantt">("gantt")

  // 作業内容タブの編集状態
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null)
  const [editGroupNameValue, setEditGroupNameValue] = useState("")
  const [savingGroupName, setSavingGroupName] = useState(false)
  const [deletingGroupName, setDeletingGroupName] = useState<string | null>(null)

  // 作業内容の新規追加
  const [addingWorkContent, setAddingWorkContent] = useState(false)
  const [newWorkContentName, setNewWorkContentName] = useState("")
  const [newWorkContentType, setNewWorkContentType] = useState("ASSEMBLY")
  const [newWorkContentStartDate, setNewWorkContentStartDate] = useState("")
  const [newWorkContentEndDate, setNewWorkContentEndDate] = useState("")
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

  const projectId = schedule?.contract.project.id
  const fetchSiblings = useCallback(async (projId: string, initialSchedule: ScheduleData) => {
    setLoadingSiblings(true)
    try {
      const res = await fetch(`/api/schedules?projectId=${projId}`)
      if (!res.ok) throw new Error()
      const data: ScheduleData[] = await res.json()
      setSiblings(data.length > 0 ? data : [initialSchedule])
    } catch {
      setSiblings([initialSchedule])
    } finally {
      setLoadingSiblings(false)
    }
  }, [])

  useEffect(() => {
    if (open && schedule && projectId) {
      setActiveScheduleId(schedule.id)
      const initialGroupName = schedule.name
        ?? (WORK_TYPE_BADGE[schedule.workType] ?? WORK_TYPE_BADGE.REWORK).label
      setActiveGroupName(initialGroupName)
      setSiblings([schedule])
      fetchSiblings(projectId, schedule)
    }
    if (!open) {
      setSiblings([])
      setActiveScheduleId(null)
      setActiveGroupName(null)
      setFetchedSchedule(null)
    }
  }, [open, schedule, projectId, fetchSiblings])

  const workContentGroups = useMemo(() => groupByWorkContent(siblings), [siblings])

  const isAllView = activeGroupName === ALL_GROUP_KEY

  const activeGroup = isAllView
    ? null
    : workContentGroups.find((g) => g.name === activeGroupName)
      ?? workContentGroups.find((g) => g.schedules.some((s) => s.id === activeScheduleId))
      ?? workContentGroups[0]
      ?? null

  // 全体表示時は全siblings、個別グループ時はそのグループのスケジュール
  const displaySchedules = isAllView ? siblings : (activeGroup?.schedules ?? [])

  const activeSchedule = schedule
    ? (displaySchedules.find((s) => s.id === activeScheduleId)
      ?? displaySchedules[0]
      ?? siblings.find((s) => s.id === activeScheduleId)
      ?? siblings[0]
      ?? schedule)
    : null

  const siteName = activeSchedule?.contract.project.name ?? "読み込み中..."
  const address = activeSchedule?.contract.project.address ?? null
  const statusInfo = activeSchedule ? deriveStatus(activeSchedule.actualStartDate, activeSchedule.actualEndDate) : null

  function handleGroupChange(groupName: string) {
    setActiveGroupName(groupName)
    if (groupName === ALL_GROUP_KEY) return
    const group = workContentGroups.find((g) => g.name === groupName)
    if (group && group.schedules.length > 0) {
      setActiveScheduleId(group.schedules[0].id)
    }
  }

  async function handleSaveGroupName(group: WorkContentGroup) {
    setSavingGroupName(true)
    try {
      const newName = editGroupNameValue.trim() || null
      await Promise.all(
        group.schedules.map((s) =>
          fetch(`/api/schedules/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newName }),
          })
        )
      )
      toast.success("作業内容名を更新しました")
      setEditingGroupName(null)
      handleUpdated()
    } catch {
      toast.error("作業内容名の更新に失敗しました")
    } finally {
      setSavingGroupName(false)
    }
  }

  async function handleDeleteGroup(group: WorkContentGroup) {
    const ok = window.confirm(`「${group.name}」の全工程（${group.schedules.length}件）を削除しますか？\nこの操作は取り消せません。`)
    if (!ok) return

    setDeletingGroupName(group.name)
    try {
      await Promise.all(
        group.schedules.map((s) =>
          fetch(`/api/schedules/${s.id}`, { method: "DELETE" })
        )
      )
      toast.success(`「${group.name}」を削除しました`)
      if (activeGroupName === group.name) {
        const remaining = workContentGroups.filter((g) => g.name !== group.name)
        if (remaining.length > 0) {
          setActiveGroupName(remaining[0].name)
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
    if (!newWorkContentName.trim() || !newWorkContentStartDate || !newWorkContentEndDate || !projectId) {
      toast.error("作業内容名と日程を入力してください")
      return
    }
    setSavingWorkContent(true)
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          workType: newWorkContentType,
          name: newWorkContentName.trim(),
          plannedStartDate: newWorkContentStartDate,
          plannedEndDate: newWorkContentEndDate,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(`作業内容「${newWorkContentName.trim()}」を追加しました`)
      setAddingWorkContent(false)
      setNewWorkContentName("")
      setNewWorkContentType("ASSEMBLY")
      setNewWorkContentStartDate("")
      setNewWorkContentEndDate("")
      setActiveGroupName(newWorkContentName.trim())
      handleUpdated()
    } catch {
      toast.error("追加に失敗しました")
    } finally {
      setSavingWorkContent(false)
    }
  }

  function handleScheduleDeleted() {
    const remaining = workContentGroups.flatMap((g) => g.schedules)
    if (remaining.length <= 1) {
      onClose()
      onUpdated?.()
      return
    }
    handleUpdated()
  }

  const handleUpdated = () => {
    if (projectId && schedule) {
      fetchSiblings(projectId, schedule)
    }
    onUpdated?.()
  }

  const showLoading = loadingSchedule && !schedule

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-sm border-2 border-slate-300">
        {showLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : activeSchedule ? (
          <>
            {/* ═══ 全体スクロール ═══ */}
            <div className="flex-1 overflow-y-auto">

            {/* ═══ ヘッダー（全情報集約） ═══ */}
            <div className="bg-slate-50 border-b border-slate-200">
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
                    {siteName}
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
                    <p className="text-slate-800 font-extrabold text-sm truncate">{activeSchedule.contract.project.branch.company.name}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-bold">契約番号</span>
                    <p className="text-slate-800 font-extrabold text-sm tabular-nums">{activeSchedule.contract.contractNumber ?? "―"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-bold">契約金額</span>
                    <p className="text-slate-800 font-black text-sm tabular-nums">¥{Number(activeSchedule.contract.contractAmount).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-bold">合計金額</span>
                    <p className="text-slate-800 font-black text-sm tabular-nums">¥{Number(activeSchedule.contract.totalAmount).toLocaleString()}</p>
                  </div>
                </div>

                {/* 日程 + 住所 + 担当者 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 font-bold">予定</span>
                    <p className="text-slate-800 font-medium text-xs tabular-nums">
                      {activeSchedule.plannedStartDate ? new Date(activeSchedule.plannedStartDate).toLocaleDateString("ja-JP") : "―"}
                      {" 〜 "}
                      {activeSchedule.plannedEndDate ? new Date(activeSchedule.plannedEndDate).toLocaleDateString("ja-JP") : "―"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-bold">実績</span>
                    <p className="text-slate-800 font-medium text-xs tabular-nums">
                      {activeSchedule.actualStartDate ? new Date(activeSchedule.actualStartDate).toLocaleDateString("ja-JP") : "―"}
                      {" 〜 "}
                      {activeSchedule.actualEndDate ? new Date(activeSchedule.actualEndDate).toLocaleDateString("ja-JP") : "―"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-bold">住所</span>
                    {address ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-green-700 font-bold hover:text-green-800 truncate"
                      >
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{address}</span>
                      </a>
                    ) : (
                      <p className="text-slate-400 text-xs">―</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-bold">担当者</span>
                    <p className="text-slate-800 font-medium text-xs truncate">
                      {activeSchedule.contract.project.contact?.name ?? "―"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ アクションカード群（V2: 4ボタン） ═══ */}
            <div className="px-6 py-3 border-b border-slate-200 bg-white">
              <div className="grid grid-cols-4 gap-2">
                {/* Googleマップ */}
                <a
                  href={address
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
                    : undefined
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-sm border-2 transition-all active:scale-95 ${
                    address
                      ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100 cursor-pointer"
                      : "bg-slate-50 border-dashed border-slate-300 text-slate-400 cursor-not-allowed"
                  }`}
                  onClick={(e) => { if (!address) e.preventDefault() }}
                >
                  <MapPin className="w-5 h-5" />
                  <span className="text-xs font-bold">Googleマップ</span>
                </a>

                {/* 人員配置 */}
                <button
                  onClick={() => { onClose(); router.push("/worker-assignments") }}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-sm border-2 bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 active:scale-95 transition-all"
                >
                  <Users className="w-5 h-5" />
                  <span className="text-xs font-bold">人員配置</span>
                </button>

                {/* 画像登録 */}
                <button
                  onClick={() => {
                    document.getElementById("siteops-photo-section")?.scrollIntoView({ behavior: "smooth" })
                  }}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-sm border-2 bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100 active:scale-95 transition-all"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-xs font-bold">画像登録</span>
                </button>

                {/* 安全管理 */}
                <button
                  onClick={() => toast.info("安全管理機能は準備中です")}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-sm border-2 border-dashed border-red-300 bg-red-50 text-red-600 hover:bg-red-100 active:scale-95 transition-all"
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-xs font-bold">安全管理</span>
                </button>
              </div>
            </div>

            {/* ═══ コンテンツ（全セクション一画面表示） ═══ */}
            <div className="bg-white p-6 space-y-4">

              {/* 作業内容タブ */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-base font-extrabold text-slate-800">作業内容</h3>
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
                  {workContentGroups.map((group) => {
                    const isActive = !isAllView && group.name === activeGroup?.name
                    const allCompleted = group.schedules.every((s) => s.actualEndDate)
                    const someStarted = group.schedules.some((s) => s.actualStartDate)
                    const isEditingThis = editingGroupName === group.name
                    const isDeletingThis = deletingGroupName === group.name
                    const workTypeLabels = group.schedules.map((s) =>
                      (WORK_TYPE_BADGE[s.workType] ?? WORK_TYPE_BADGE.REWORK).label
                    )
                    const uniqueLabels = [...new Set(workTypeLabels)]
                    const primaryType = WORK_TYPE_BADGE[group.schedules[0]?.workType] ?? WORK_TYPE_BADGE.REWORK

                    return (
                      <div key={group.name} className="relative group/tab">
                        {isEditingThis ? (
                          <div className="flex items-center gap-2 rounded-sm border-2 border-blue-400 bg-blue-50 px-3 py-2">
                            <Input
                              value={editGroupNameValue}
                              onChange={(e) => setEditGroupNameValue(e.target.value)}
                              className="h-7 text-xs font-bold flex-1 w-24"
                              autoFocus
                              maxLength={100}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveGroupName(group)
                                if (e.key === "Escape") setEditingGroupName(null)
                              }}
                            />
                            <button
                              onClick={() => handleSaveGroupName(group)}
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
                            onClick={() => handleGroupChange(group.name)}
                            className={cn(
                              "text-left rounded-sm border-l-[5px] border-2 px-4 py-2.5 transition-all hover:shadow-md active:scale-[0.99]",
                              primaryType.cardBorder,
                              isActive
                                ? `${primaryType.cardBg} ring-2 ring-blue-300 shadow-md border-slate-200`
                                : "bg-white border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-extrabold text-slate-800 truncate">{group.name}</span>
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
                                {group.schedules.length}件
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
                                setEditGroupNameValue(group.name)
                                setEditingGroupName(group.name)
                              }}
                              className="px-1.5 py-1 rounded-sm bg-white border-2 border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 text-xs font-bold transition-all active:scale-95 shadow-sm"
                              title="名前を編集"
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteGroup(group)
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

                {/* 作業内容の新規追加フォーム */}
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
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 font-bold mb-1.5 block">最初の工種</label>
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(WORK_TYPE_BADGE).map(([code, { label, className: cls }]) => (
                          <button
                            key={code}
                            onClick={() => setNewWorkContentType(code)}
                            className={cn(
                              "px-3 py-1.5 rounded-sm text-sm font-bold border-2 transition-all active:scale-95",
                              newWorkContentType === code
                                ? `${cls} ring-2 ring-blue-300 shadow-md`
                                : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-slate-600 font-bold mb-1 block">組み立て日</label>
                        <Input type="date" className="h-9 text-sm font-medium border-2" value={newWorkContentStartDate} onChange={(e) => setNewWorkContentStartDate(e.target.value)} />
                      </div>
                      <span className="text-base text-slate-300 pb-2 font-bold">〜</span>
                      <div className="flex-1">
                        <label className="text-xs text-slate-600 font-bold mb-1 block">解体日</label>
                        <Input type="date" className="h-9 text-sm font-medium border-2" value={newWorkContentEndDate} onChange={(e) => setNewWorkContentEndDate(e.target.value)} />
                      </div>
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
                        disabled={savingWorkContent || !newWorkContentName.trim() || !newWorkContentStartDate || !newWorkContentEndDate}
                        className="px-4 py-2 rounded-sm text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingWorkContent ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin inline" /> : <Plus className="w-4 h-4 mr-1.5 inline" />}
                        追加
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 工程日程 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-extrabold text-slate-800">
                    工程日程
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

                <div className="rounded-sm border-2 border-slate-200 bg-white overflow-hidden">
                  {scheduleViewMode === "list" ? (
                    <div className="p-4">
                      <SiteOpsDateSection
                        key={`date-${isAllView ? "all" : activeGroup?.name ?? projectId}`}
                        activeScheduleId={activeSchedule.id}
                        siblings={displaySchedules}
                        projectId={projectId!}
                        groupName={isAllView ? undefined : activeGroup?.name}
                        onUpdated={handleUpdated}
                      />
                    </div>
                  ) : (
                    <div className="p-3">
                      <ScheduleMiniGantt
                        key={`gantt-${isAllView ? "all" : activeGroup?.name ?? projectId}`}
                        schedules={displaySchedules.map((s) => ({
                          id: s.id,
                          contractId: s.contractId,
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
                        defaultGroupName={isAllView ? null : activeGroup?.name}
                        onCreateSchedule={async (workType, name, startDate, endDate) => {
                          try {
                            const res = await fetch("/api/schedules", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                projectId,
                                workType,
                                name: name || (isAllView ? null : activeGroup?.name) || null,
                                plannedStartDate: startDate,
                                plannedEndDate: endDate,
                              }),
                            })
                            if (!res.ok) throw new Error()
                            toast.success("工程を追加しました")
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
              </div>

              {/* 見積詳細 */}
              <div className="rounded-sm border-2 border-slate-200 bg-white p-4">
                <SiteOpsEstimateSection contractId={activeSchedule.contract.id} />
              </div>

              {/* 写真 */}
              <div id="siteops-photo-section" className="rounded-sm border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
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
      </DialogContent>
    </Dialog>
  )
}
