/**
 * [COMPONENT] 商談一覧 v2 - カラフルブロック型 + 元の全情報量
 *
 * 元のバージョンの情報量をすべて維持しつつ、
 * 大きな文字・カラフルなカードブロックで直感的に表示する。
 */
"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { formatCurrency, formatDate, formatRelativeDate } from "@/lib/utils"
import { toast } from "sonner"
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
  X,
  Archive,
  EyeOff,
  RotateCcw,
  Trash2,
  HandshakeIcon,
  CheckSquare,
  Square,
  CalendarDays,
  CalendarPlus,
  CalendarCheck,
  MapPin,
  Users,
  Camera,
  ShieldCheck,
  ExternalLink,
  FileText,
  CircleCheck,
  CircleDashed,
  Eye,
  LayoutTemplate,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { EstimateDetailV2 as EstimateDetailPanel } from "@/components/estimates/EstimateDetailV2"
import { SiteOpsPhotoSection } from "@/components/site-operations/SiteOpsPhotoSection"
import { SiteOpsDialog } from "@/components/site-operations/SiteOpsDialog"
import { ContractProcessingDialog } from "@/components/contracts/ContractProcessingDialog"
import type { ContractEstimateItem } from "@/components/contracts/contract-types"
import type { EstimateStatus } from "@prisma/client"
import { useEstimateCreate } from "@/hooks/use-estimate-create"
import type { EstimateTemplate } from "@/hooks/use-estimate-create"

// ─── 型定義 ────────────────────────────────────────────

interface EstimateRow {
  id: string
  title: string | null
  estimateType: string
  status: EstimateStatus
  isArchived: boolean
  confirmedAt: Date | null
  createdAt: Date
  user: { id: string; name: string }
  totalAmount: number
  contract: { id: string; status: string } | null
}

interface Project {
  id: string
  shortId: string
  name: string
  address: string | null
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
  branch: {
    name: string
    company: {
      id: string
      name: string
      taxRate: number
      paymentClosingDay: number | null
      paymentMonthOffset: number
      paymentPayDay: number | null
      paymentNetDays: number | null
    }
  }
  contact: { name: string } | null
  estimates: EstimateRow[]
}

interface Props {
  projects: Project[]
  currentUser: { id: string; name: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  templates: any[]
}

// ─── ステータス設定 ──────────────────────────────────────

type StatusFilter = EstimateStatus | "ALL"

const STATUS_BLOCK: Record<EstimateStatus, {
  label: string
  cardBg: string
  cardBorder: string
  cardHover: string
  badgeBg: string
  badgeText: string
  accent: string
}> = {
  DRAFT: {
    label: "下書き",
    cardBg: "bg-gradient-to-r from-amber-50 to-orange-50",
    cardBorder: "border-l-amber-400",
    cardHover: "hover:from-amber-100 hover:to-orange-100",
    badgeBg: "bg-amber-500",
    badgeText: "text-white",
    accent: "text-amber-600",
  },
  CONFIRMED: {
    label: "確定済",
    cardBg: "bg-gradient-to-r from-blue-50 to-indigo-50",
    cardBorder: "border-l-blue-500",
    cardHover: "hover:from-blue-100 hover:to-indigo-100",
    badgeBg: "bg-blue-500",
    badgeText: "text-white",
    accent: "text-blue-600",
  },
  SENT: {
    label: "送付済",
    cardBg: "bg-gradient-to-r from-emerald-50 to-green-50",
    cardBorder: "border-l-emerald-500",
    cardHover: "hover:from-emerald-100 hover:to-green-100",
    badgeBg: "bg-emerald-500",
    badgeText: "text-white",
    accent: "text-emerald-600",
  },
  OLD: {
    label: "旧版",
    cardBg: "bg-slate-50",
    cardBorder: "border-l-slate-300",
    cardHover: "hover:bg-slate-100",
    badgeBg: "bg-slate-400",
    badgeText: "text-white",
    accent: "text-slate-500",
  },
}

// ─── メインコンポーネント ───────────────────────────────

export function ProjectList({ projects, currentUser, templates }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [showArchived, setShowArchived] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set())
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set())
  const [stageFilter, setStageFilter] = useState<"ALL" | "noEstimate" | "drafted" | "confirmed" | "thisMonth" | "lastMonth">("ALL")
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())

  // 右パネル状態: "project"（現場詳細+見積一覧）or "estimate"（見積詳細）
  const [panelMode, setPanelMode] = useState<"project" | "estimate" | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [estimateData, setEstimateData] = useState<any | null>(null)
  const [estimateLoading, setEstimateLoading] = useState(false)
  const [showProjectPhotos, setShowProjectPhotos] = useState(false)
  // 作成直後に自動編集モードで開くためのフラグ
  const [autoEditEstimateId, setAutoEditEstimateId] = useState<string | null>(null)

  // チェックボックス（契約処理用）
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  // 契約ダイアログ
  const [contractOpen, setContractOpen] = useState(false)
  const [contractItems, setContractItems] = useState<ContractEstimateItem[]>([])
  const [contractMode, setContractMode] = useState<"individual" | "consolidated">("individual")

  // 削除・非表示ダイアログ
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [hideId, setHideId] = useState<string | null>(null)
  const [hideName, setHideName] = useState("")
  const [hiding, setHiding] = useState(false)

  // 新規見積作成ダイアログ
  const [newEstDialogOpen, setNewEstDialogOpen] = useState(false)
  const [newEstProjectId, setNewEstProjectId] = useState<string | null>(null)
  const [newEstType, setNewEstType] = useState<"INITIAL" | "ADDITIONAL">("INITIAL")
  const [newEstTitle, setNewEstTitle] = useState("")
  const [newEstSelectedTemplateId, setNewEstSelectedTemplateId] = useState<string | null>(null)
  const [newEstPreviewId, setNewEstPreviewId] = useState<string | null>(null)
  const newEstProjectIdRef = useRef<string | null>(null)
  // newEstProjectId が変わったら ref も更新
  useEffect(() => { newEstProjectIdRef.current = newEstProjectId }, [newEstProjectId])

  const { creating: newEstCreating, createEstimate } = useEstimateCreate({
    templates: templates as EstimateTemplate[],
    onCreated: async (estimateId) => {
      const projectId = newEstProjectIdRef.current
      setNewEstDialogOpen(false)
      resetNewEstDialog()
      // 作成直後に自動編集モードで開くためのフラグをセット
      setAutoEditEstimateId(estimateId)
      // まず見積を開いてから refresh（状態がリセットされないように）
      if (projectId) {
        await openEstimate(estimateId, projectId)
      }
      router.refresh()
    },
  })

  const resetNewEstDialog = useCallback(() => {
    setNewEstTitle("")
    setNewEstType("INITIAL")
    setNewEstSelectedTemplateId(null)
    setNewEstPreviewId(null)
  }, [])

  const openNewEstimateDialog = useCallback((project: Project) => {
    const activeEstimates = project.estimates.filter((e) => !e.isArchived)
    setNewEstProjectId(project.id)
    setNewEstType(activeEstimates.length > 0 ? "ADDITIONAL" : "INITIAL")
    setNewEstTitle("")
    setNewEstSelectedTemplateId(null)
    setNewEstPreviewId(null)
    setNewEstDialogOpen(true)
  }, [])

  const handleNewEstCreate = useCallback(async () => {
    if (!newEstProjectId) return
    await createEstimate({
      projectId: newEstProjectId,
      templateId: newEstSelectedTemplateId ?? undefined,
      title: newEstTitle.trim() || undefined,
      estimateType: newEstType,
    })
  }, [newEstProjectId, newEstSelectedTemplateId, newEstTitle, newEstType, createEstimate])

  // テンプレートフィルタリング
  const filteredTemplates = useMemo(() => {
    return (templates as EstimateTemplate[]).filter(
      (tpl) => tpl.estimateType === "BOTH" || tpl.estimateType === newEstType
    )
  }, [templates, newEstType])

  // テンプレート合計金額計算
  const calcTemplateTotal = useCallback((sections?: EstimateTemplate["sections"]) => {
    if (!sections) return 0
    let total = 0
    for (const sec of sections) {
      for (const grp of sec.groups) {
        for (const item of grp.items) {
          total += Number(item.quantity) * Number(item.unitPrice)
        }
      }
    }
    return total
  }, [])

  // 担当者フィルター
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())

  // 担当者一覧
  const allUsers = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of projects) {
      for (const est of p.estimates) {
        if (!map.has(est.user.id)) map.set(est.user.id, est.user.name)
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [projects])

  // サマリー
  const summary = useMemo(() => {
    let draft = 0, confirmed = 0, sent = 0
    for (const p of projects) {
      for (const e of p.estimates) {
        if (e.isArchived) continue
        if (e.status === "DRAFT") draft++
        if (e.status === "CONFIRMED") confirmed++
        if (e.status === "SENT") sent++
      }
    }
    return { draft, confirmed, sent, total: draft + confirmed + sent }
  }, [projects])

  // フィルター
  const filtered = useMemo(() => {
    let result = projects

    // アーカイブ
    result = result.filter((p) => showArchived ? p.isArchived : !p.isArchived)

    // 検索
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.branch.company.name.toLowerCase().includes(q) ||
          (p.address && p.address.toLowerCase().includes(q)) ||
          (p.contact?.name && p.contact.name.toLowerCase().includes(q))
      )
    }

    // 担当者フィルター
    if (selectedUsers.size > 0) {
      result = result
        .map((p) => ({
          ...p,
          estimates: p.estimates.filter((e) => selectedUsers.has(e.user.id)),
        }))
        .filter((p) => p.estimates.length > 0)
    }

    return result
  }, [projects, search, showArchived, selectedUsers])

  // 会社別グループ化
  const grouped = useMemo(() => {
    const map = new Map<string, { companyId: string; companyName: string; projects: Project[] }>()
    for (const p of filtered) {
      const cid = p.branch.company.id
      if (!map.has(cid)) {
        map.set(cid, { companyId: cid, companyName: p.branch.company.name, projects: [] })
      }
      map.get(cid)!.projects.push(p)
    }
    return Array.from(map.values())
  }, [filtered])

  // ─── 3段階ステージ分類 ───
  // 1. 見積り未作成: estimates が0件
  // 2. 見積り作成済み: estimates が1件以上あるが、全てDRAFT（確定済みが0）
  // 3. 確定済み: 1件以上が CONFIRMED or SENT
  const stages = useMemo(() => {
    const noEstimate: Project[] = []
    const drafted: Project[] = []
    const confirmed: Project[] = []

    for (const p of filtered) {
      const activeEstimates = p.estimates.filter((e) => !e.isArchived)
      if (activeEstimates.length === 0) {
        noEstimate.push(p)
      } else if (activeEstimates.some((e) => e.status === "CONFIRMED" || e.status === "SENT")) {
        confirmed.push(p)
      } else {
        drafted.push(p)
      }
    }

    return [
      { key: "noEstimate", label: "見積り未作成", icon: "plus", color: "slate", projects: noEstimate },
      { key: "drafted", label: "見積り作成済み", icon: "file", color: "amber", projects: drafted },
      { key: "confirmed", label: "確定済み", icon: "check", color: "blue", projects: confirmed },
    ] as const
  }, [filtered])

  // 今月・先月の見積り依頼件数（作成されたプロジェクト）
  const { thisMonthProjects, lastMonthProjects } = useMemo(() => {
    const now = new Date()
    const thisY = now.getFullYear()
    const thisM = now.getMonth()
    const lastDate = new Date(thisY, thisM - 1, 1)
    const lastY = lastDate.getFullYear()
    const lastM = lastDate.getMonth()
    const thisMonth: Project[] = []
    const lastMonth: Project[] = []
    for (const p of filtered) {
      const d = new Date(p.createdAt)
      const py = d.getFullYear()
      const pm = d.getMonth()
      if (py === thisY && pm === thisM) thisMonth.push(p)
      else if (py === lastY && pm === lastM) lastMonth.push(p)
    }
    return { thisMonthProjects: thisMonth, lastMonthProjects: lastMonth }
  }, [filtered])

  const toggleStage = useCallback((stageKey: string) => {
    setCollapsedStages((prev) => {
      const next = new Set(prev)
      if (next.has(stageKey)) next.delete(stageKey)
      else next.add(stageKey)
      return next
    })
  }, [])

  const toggleCompany = useCallback((companyId: string) => {
    setCollapsedCompanies((prev) => {
      const next = new Set(prev)
      if (next.has(companyId)) next.delete(companyId)
      else next.add(companyId)
      return next
    })
  }, [])

  const toggleProject = useCallback((projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }, [])

  const toggleCheck = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleUser = useCallback((userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }, [])

  // サイドバーを自動で閉じる
  const collapseSidebar = useCallback(() => {
    window.dispatchEvent(new Event("collapse-sidebar"))
  }, [])

  // 現場を開く（右パネルに現場詳細+見積一覧）
  const openProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId)
    setPanelMode("project")
    setSelectedEstimateId(null)
    setEstimateData(null)
    setShowProjectPhotos(false)
    collapseSidebar()
  }, [collapseSidebar])

  // 見積詳細を開く（右パネルに見積詳細）
  const openEstimate = useCallback(async (estimateId: string, fromProjectId?: string) => {
    if (fromProjectId) setSelectedProjectId(fromProjectId)
    setSelectedEstimateId(estimateId)
    setPanelMode("estimate")
    collapseSidebar()
    setEstimateLoading(true)
    try {
      const res = await fetch(`/api/estimates/${estimateId}`)
      if (!res.ok) throw new Error("取得に失敗しました")
      setEstimateData(await res.json())
    } catch {
      toast.error("見積の取得に失敗しました")
      setSelectedEstimateId(null)
      setPanelMode(selectedProjectId ? "project" : null)
    } finally {
      setEstimateLoading(false)
    }
  }, [selectedProjectId])

  // パネルを閉じる / 1つ戻る
  const closePanel = useCallback(() => {
    if (panelMode === "estimate" && selectedProjectId) {
      // 見積詳細 → 現場ビューに戻る
      setPanelMode("project")
      setSelectedEstimateId(null)
      setEstimateData(null)
    } else {
      // 全部閉じる
      setPanelMode(null)
      setSelectedProjectId(null)
      setSelectedEstimateId(null)
      setEstimateData(null)
    }
  }, [panelMode, selectedProjectId])

  // パネルを完全に閉じる
  const closePanelAll = useCallback(() => {
    setPanelMode(null)
    setSelectedProjectId(null)
    setSelectedEstimateId(null)
    setEstimateData(null)
  }, [])

  const refreshEstimate = useCallback(async () => {
    if (!selectedEstimateId) return
    try {
      const res = await fetch(`/api/estimates/${selectedEstimateId}`)
      if (res.ok) setEstimateData(await res.json())
    } catch { /* ignore */ }
  }, [selectedEstimateId])

  // アーカイブ
  const handleArchive = useCallback(async (projectId: string) => {
    if (!confirm("この現場を失注としてアーカイブしますか？")) return
    const res = await fetch(`/api/projects/${projectId}/archive`, { method: "PATCH" })
    if (res.ok) { toast.success("アーカイブしました"); router.refresh() }
    else toast.error("失敗しました")
  }, [router])

  // 削除
  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/estimates/${deleteId}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("見積を削除しました")
        setDeleteId(null)
        if (selectedEstimateId === deleteId) { setSelectedEstimateId(null); setEstimateData(null); if (selectedProjectId) setPanelMode("project"); else setPanelMode(null) }
        router.refresh()
      } else toast.error("削除に失敗しました")
    } catch { toast.error("削除に失敗しました") }
    finally { setDeleting(false) }
  }, [deleteId, selectedEstimateId, router])

  // 非表示
  const handleHide = useCallback(async () => {
    if (!hideId) return
    setHiding(true)
    try {
      const res = await fetch(`/api/estimates/${hideId}/archive`, { method: "POST" })
      if (res.ok) {
        toast.success("非表示にしました")
        setHideId(null)
        if (selectedEstimateId === hideId) { setSelectedEstimateId(null); setEstimateData(null); if (selectedProjectId) setPanelMode("project"); else setPanelMode(null) }
        router.refresh()
      } else toast.error("失敗しました")
    } catch { toast.error("失敗しました") }
    finally { setHiding(false) }
  }, [hideId, selectedEstimateId, router])

  // 復元
  const handleRestore = useCallback(async (estimateId: string) => {
    try {
      const res = await fetch(`/api/estimates/${estimateId}/archive`, { method: "DELETE" })
      if (res.ok) { toast.success("復元しました"); router.refresh() }
      else toast.error("失敗しました")
    } catch { toast.error("失敗しました") }
  }, [router])

  // 契約処理を開く
  const openContract = useCallback((est: EstimateRow, project: Project) => {
    const taxRate = project.branch.company.taxRate
    setContractItems([{
      estimateId: est.id,
      estimateName: est.title ?? "見積",
      projectId: project.id,
      projectName: project.name,
      companyName: project.branch.company.name,
      taxExcludedAmount: Math.round(est.totalAmount / (1 + taxRate)),
      taxRate,
    }])
    setContractMode("individual")
    setContractOpen(true)
  }, [])

  // 一括契約
  const checkedItems = useMemo((): ContractEstimateItem[] => {
    const result: ContractEstimateItem[] = []
    for (const p of projects) {
      for (const est of p.estimates) {
        if (!checkedIds.has(est.id)) continue
        const taxRate = p.branch.company.taxRate
        result.push({
          estimateId: est.id,
          estimateName: est.title ?? "見積",
          projectId: p.id,
          projectName: p.name,
          companyName: p.branch.company.name,
          taxExcludedAmount: Math.round(est.totalAmount / (1 + taxRate)),
          taxRate,
        })
      }
    }
    return result
  }, [checkedIds, projects])

  // Escキー
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      if (checkedIds.size > 0) { setCheckedIds(new Set()); return }
      if (panelMode) { closePanel(); return }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [checkedIds, panelMode, closePanel])

  const hasPanel = panelMode !== null
  const selectedProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) ?? null : null

  return (
    <>
      <div className="flex gap-0 h-full">
        {/* ── 一覧パネル ── */}
        <div className={`${hasPanel ? "w-[32%] min-w-[340px] shrink-0 border-r border-slate-200" : "flex-1"} overflow-y-auto max-h-[calc(100vh-4rem)]`}>
          <div className={`${hasPanel ? "p-2" : "px-6 py-4"} space-y-3`}>

            {/* ヘッダー */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className={`${hasPanel ? "text-base" : "text-3xl"} font-extrabold text-slate-900`}>商談一覧</h1>
                {!hasPanel && <p className="text-base text-slate-500 mt-0.5">{currentUser.name} さん</p>}
              </div>
              <button
                onClick={() => router.push("/projects/new")}
                className={`inline-flex items-center gap-1.5 ${hasPanel ? "px-3 py-1.5 rounded-sm text-sm" : "px-5 py-2.5 rounded-sm text-base"} bg-blue-600 text-white font-bold hover:bg-blue-700 active:bg-blue-800 transition-all shadow-lg shadow-blue-200 active:scale-95`}
              >
                <Plus className={`${hasPanel ? "w-3.5 h-3.5" : "w-5 h-5"} stroke-[2.5]`} />
                新規作成
              </button>
            </div>

            {/* サマリーバー（ステージ別件数） */}
            <div className={`grid ${hasPanel ? "grid-cols-6 gap-1" : "grid-cols-6 gap-2"}`}>
              <SummaryCard
                count={filtered.length} label="すべて" compact={hasPanel}
                active={stageFilter === "ALL"} onClick={() => setStageFilter("ALL")}
                colors={{ activeBg: "border-slate-700 bg-slate-700", activeText: "text-white", activeShadow: "shadow-slate-200", inactiveBg: "border-slate-200 bg-white", inactiveNum: "text-slate-600", inactiveLabel: "text-slate-500" }}
              />
              <SummaryCard
                count={thisMonthProjects.length} label="今月の依頼" compact={hasPanel}
                active={stageFilter === "thisMonth"} onClick={() => setStageFilter(stageFilter === "thisMonth" ? "ALL" : "thisMonth")}
                colors={{ activeBg: "border-emerald-500 bg-emerald-500", activeText: "text-white", activeShadow: "shadow-emerald-200", inactiveBg: "border-emerald-200 bg-emerald-50", inactiveNum: "text-emerald-600", inactiveLabel: "text-emerald-500" }}
              />
              <SummaryCard
                count={lastMonthProjects.length} label="先月の依頼" compact={hasPanel}
                active={stageFilter === "lastMonth"} onClick={() => setStageFilter(stageFilter === "lastMonth" ? "ALL" : "lastMonth")}
                colors={{ activeBg: "border-teal-500 bg-teal-500", activeText: "text-white", activeShadow: "shadow-teal-200", inactiveBg: "border-teal-200 bg-teal-50", inactiveNum: "text-teal-600", inactiveLabel: "text-teal-500" }}
              />
              <SummaryCard
                count={stages[0].projects.length} label="未作成" compact={hasPanel}
                active={stageFilter === "noEstimate"} onClick={() => setStageFilter(stageFilter === "noEstimate" ? "ALL" : "noEstimate")}
                colors={{ activeBg: "border-slate-500 bg-slate-500", activeText: "text-white", activeShadow: "shadow-slate-200", inactiveBg: "border-slate-200 bg-white", inactiveNum: "text-slate-600", inactiveLabel: "text-slate-500" }}
              />
              <SummaryCard
                count={stages[1].projects.length} label="作成済" compact={hasPanel}
                active={stageFilter === "drafted"} onClick={() => setStageFilter(stageFilter === "drafted" ? "ALL" : "drafted")}
                colors={{ activeBg: "border-amber-500 bg-amber-500", activeText: "text-white", activeShadow: "shadow-amber-200", inactiveBg: "border-amber-200 bg-amber-50", inactiveNum: "text-amber-600", inactiveLabel: "text-amber-500" }}
              />
              <SummaryCard
                count={stages[2].projects.length} label="確定済" compact={hasPanel}
                active={stageFilter === "confirmed"} onClick={() => setStageFilter(stageFilter === "confirmed" ? "ALL" : "confirmed")}
                colors={{ activeBg: "border-blue-500 bg-blue-500", activeText: "text-white", activeShadow: "shadow-blue-200", inactiveBg: "border-blue-200 bg-blue-50", inactiveNum: "text-blue-600", inactiveLabel: "text-blue-500" }}
              />
            </div>

            {/* 検索バー */}
            <div className="relative">
              <Search className={`absolute ${hasPanel ? "left-3 w-4 h-4" : "left-4 w-5 h-5"} top-1/2 -translate-y-1/2 text-slate-400`} />
              <input
                type="text"
                placeholder={hasPanel ? "検索" : "会社名・現場名・住所・担当者で検索"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full ${hasPanel ? "pl-9 pr-8 py-2 rounded-sm text-sm" : "pl-12 pr-10 py-3 rounded-sm text-base"} border-2 border-slate-200 font-medium placeholder:text-slate-400 focus:outline-none focus:border-blue-400 transition-all bg-white`}
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-slate-100">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              )}
            </div>

            {/* フィルター行 */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* 担当者フィルター */}
              {allUsers.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-500 mr-1">担当</span>
                  {allUsers.map(({ id, name }) => {
                    const active = selectedUsers.has(id)
                    return (
                      <button
                        key={id}
                        onClick={() => toggleUser(id)}
                        className={`px-3 py-1.5 rounded-sm text-sm font-bold transition-all active:scale-95 ${
                          active
                            ? "bg-indigo-500 text-white shadow-md"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {name.slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="flex-1" />

              {/* 失注表示 */}
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`px-3 py-1.5 rounded-sm text-sm font-bold transition-all ${
                  showArchived ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                <Archive className="w-4 h-4 inline mr-1" />
                失注
              </button>

              {/* 非表示見積 */}
              <button
                onClick={() => setShowHidden(!showHidden)}
                className={`px-3 py-1.5 rounded-sm text-sm font-bold transition-all ${
                  showHidden ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                <EyeOff className="w-4 h-4 inline mr-1" />
                非表示
              </button>
            </div>

            {/* アクティブフィルター表示 */}
            {(search || selectedUsers.size > 0) && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">{filtered.length}件表示</span>
                <button
                  onClick={() => { setSearch(""); setSelectedUsers(new Set()) }}
                  className="text-sm text-blue-600 font-bold hover:underline"
                >
                  リセット
                </button>
              </div>
            )}

            {/* ─── ステージ別一覧（上から下へ流れるパイプライン） ─── */}
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-xl font-bold text-slate-400 mb-2">
                  {search || selectedUsers.size > 0 ? "条件に一致する商談がありません" : "商談がありません"}
                </p>
                {(search || selectedUsers.size > 0) && (
                  <button
                    onClick={() => { setSearch(""); setSelectedUsers(new Set()) }}
                    className="mt-4 px-5 py-2.5 rounded-sm bg-slate-100 text-base font-bold text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"
                  >
                    絞り込みを解除
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {stages.filter((s) => stageFilter === "ALL" || stageFilter === "thisMonth" || stageFilter === "lastMonth" || s.key === stageFilter).map((stage) => {
                  // 月別フィルター時はステージ内のプロジェクトを該当月作成分のみに絞る
                  const monthFilterIds = stageFilter === "thisMonth"
                    ? new Set(thisMonthProjects.map((p) => p.id))
                    : stageFilter === "lastMonth"
                      ? new Set(lastMonthProjects.map((p) => p.id))
                      : null
                  const stageProjects = monthFilterIds ? stage.projects.filter((p) => monthFilterIds.has(p.id)) : stage.projects
                  const isStageCollapsed = collapsedStages.has(stage.key)
                  const stageColors = {
                    confirmed: { bg: "bg-blue-600", hoverBg: "hover:bg-blue-700", lightBg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-700" },
                    drafted: { bg: "bg-amber-500", hoverBg: "hover:bg-amber-600", lightBg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-700" },
                    noEstimate: { bg: "bg-slate-500", hoverBg: "hover:bg-slate-600", lightBg: "bg-slate-50", border: "border-slate-200", text: "text-slate-600", badge: "bg-slate-100 text-slate-600" },
                  }[stage.key]
                  const StageIcon = { confirmed: CircleCheck, drafted: FileText, noEstimate: CircleDashed }[stage.key]

                  return (
                    <div key={stage.key} className="rounded-sm overflow-hidden shadow-sm">
                      {/* ステージヘッダー */}
                      <button
                        onClick={() => toggleStage(stage.key)}
                        className={`w-full flex items-center gap-2 ${hasPanel ? "px-3 py-2" : "px-4 py-3"} ${stageColors.bg} ${stageColors.hoverBg} text-white text-left active:opacity-90 transition-colors`}
                      >
                        {isStageCollapsed
                          ? <ChevronRight className={`${hasPanel ? "w-3.5 h-3.5" : "w-5 h-5"} shrink-0`} />
                          : <ChevronDown className={`${hasPanel ? "w-3.5 h-3.5" : "w-5 h-5"} shrink-0`} />
                        }
                        <StageIcon className={`${hasPanel ? "w-4 h-4" : "w-5 h-5"} shrink-0`} />
                        <span className={`${hasPanel ? "text-sm" : "text-base"} font-bold flex-1`}>{stage.label}</span>
                        <span className={`${hasPanel ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-0.5"} rounded-full bg-white/20 font-bold`}>
                          {stageProjects.length}件
                        </span>
                      </button>

                      {/* ステージ内の現場一覧 */}
                      {!isStageCollapsed && stageProjects.length > 0 && (
                        <div className={`${stageColors.lightBg} border border-t-0 ${stageColors.border} rounded-b-sm divide-y divide-slate-200`}>
                          {stageProjects.map((project) => (
                            <SiteBlock
                              key={project.id}
                              project={project}
                              onProjectClick={openProject}
                              onEstimateClick={(estId) => openEstimate(estId, project.id)}
                              selectedProjectId={selectedProjectId}
                              selectedEstimateId={selectedEstimateId}
                              hasPanel={hasPanel}
                              showHidden={showHidden}
                              collapsedProjects={collapsedProjects}
                              toggleProject={toggleProject}
                              checkedIds={checkedIds}
                              toggleCheck={toggleCheck}
                              onArchive={handleArchive}
                              onContract={openContract}
                              onDelete={(id, name) => { setDeleteId(id); setDeleteName(name) }}
                              onHide={(id, name) => { setHideId(id); setHideName(name) }}
                              onRestore={handleRestore}
                              router={router}
                            />
                          ))}
                        </div>
                      )}

                      {/* 空のステージ */}
                      {!isStageCollapsed && stageProjects.length === 0 && (
                        <div className={`${stageColors.lightBg} border border-t-0 ${stageColors.border} rounded-b-sm px-4 py-6 text-center`}>
                          <p className={`text-sm ${stageColors.text} font-medium opacity-60`}>
                            該当する現場はありません
                          </p>
                        </div>
                      )}

                      {/* ステージ間の接続線（最後以外・フィルター時は非表示） */}
                      {(stageFilter === "ALL" || stageFilter === "thisMonth" || stageFilter === "lastMonth") && stage.key !== "confirmed" && (
                        <div className="flex justify-center py-1">
                          <div className="w-0.5 h-3 bg-slate-300" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── チェック済みバー ── */}
        {checkedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-sm shadow-2xl px-6 py-3 flex items-center gap-4">
            <span className="text-base font-bold">{checkedIds.size}件選択中</span>
            <button
              onClick={() => { setContractItems(checkedItems); setContractMode("consolidated"); setContractOpen(true) }}
              className="px-5 py-2 rounded-sm bg-green-500 text-white font-bold text-sm hover:bg-green-600 active:scale-95 transition-all"
            >
              一括契約
            </button>
            <button
              onClick={() => setCheckedIds(new Set())}
              className="px-4 py-2 rounded-sm bg-slate-700 text-slate-300 font-bold text-sm hover:bg-slate-600 transition-colors"
            >
              解除
            </button>
          </div>
        )}

        {/* ── 右パネル ── */}
        {hasPanel && (
          <div className="flex-1 overflow-y-auto max-h-[calc(100vh-4rem)] bg-white">
            {/* 現場ビュー: SiteOpsDialog（インラインモード） */}
            {panelMode === "project" && selectedProject && (
              <SiteOpsDialog
                open={true}
                onClose={closePanelAll}
                projectId={selectedProject.id}
                projectName={selectedProject.name}
                onUpdated={() => router.refresh()}
                mode="inline"
              />
            )}

            {/* 見積詳細ビュー */}
            {panelMode === "estimate" && (
              <>
                {/* ナビゲーション */}
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-5 py-3 flex items-center justify-end">
                  <button
                    onClick={closePanelAll}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-bold text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors"
                  >
                    <X className="w-5 h-5" />
                    閉じる
                  </button>
                </div>

                {/* 共通: 現場情報ヘッダー + アクションボタン（コンパクト） */}
                {selectedProject && (
                  <ProjectInfoHeader
                    project={selectedProject}
                    showProjectPhotos={showProjectPhotos}
                    setShowProjectPhotos={setShowProjectPhotos}
                    router={router}
                    compact
                  />
                )}

                {estimateLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                ) : estimateData ? (
                  <div>
                    <EstimateDetailPanel
                      key={selectedEstimateId}
                      estimate={estimateData.estimate}
                      taxRate={estimateData.taxRate}
                      units={estimateData.units}
                      contacts={estimateData.contacts}
                      currentUser={currentUser}
                      onRefresh={() => { setAutoEditEstimateId(null); refreshEstimate(); router.refresh() }}
                      onClose={() => { setAutoEditEstimateId(null); closePanel() }}
                      initialEditing={autoEditEstimateId === selectedEstimateId}
                    />
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── ダイアログ群 ── */}
      <ContractProcessingDialog
        open={contractOpen}
        onOpenChange={setContractOpen}
        items={contractItems}
        mode={contractMode}
        onCompleted={() => { setCheckedIds(new Set()); router.refresh() }}
      />

      <Dialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>見積を削除</DialogTitle>
            <DialogDescription>「{deleteName}」を削除します。取り消せません。</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>キャンセル</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!hideId} onOpenChange={(v) => { if (!v) setHideId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>見積を非表示</DialogTitle>
            <DialogDescription>「{hideName}」を非表示にします。いつでも元に戻せます。</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setHideId(null)} disabled={hiding}>キャンセル</Button>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handleHide} disabled={hiding}>
              {hiding && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}非表示
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 新規見積作成ダイアログ ── */}
      <Dialog open={newEstDialogOpen} onOpenChange={(v) => { if (!v) { setNewEstDialogOpen(false); resetNewEstDialog() } }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-extrabold">
              <Plus className="w-5 h-5" />
              見積を追加
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const p = projects.find((p) => p.id === newEstProjectId)
                return p ? `${p.name} に新しい見積を作成します。` : "新しい見積を作成します。"
              })()}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* 見積タイトル */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">見積タイトル（任意）</label>
              <input
                className="w-full rounded-sm border-2 border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="例: A棟工事、追加養生"
                value={newEstTitle}
                onChange={(e) => setNewEstTitle(e.target.value)}
              />
              <p className="text-xs text-slate-400">未入力の場合は自動で番号が付きます</p>
            </div>

            {/* 見積種別 */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">見積の種別</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setNewEstType("INITIAL"); setNewEstSelectedTemplateId(null); setNewEstPreviewId(null) }}
                  className={`p-3 rounded-sm border-2 text-left transition-all active:scale-95 ${
                    newEstType === "INITIAL"
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="font-extrabold text-sm">通常見積</span>
                    {newEstType === "INITIAL" && <CircleCheck className="w-4 h-4 text-blue-500 ml-auto" />}
                  </div>
                  <p className="text-xs text-slate-500">初回・通常の見積</p>
                </button>
                <button
                  type="button"
                  onClick={() => { setNewEstType("ADDITIONAL"); setNewEstSelectedTemplateId(null); setNewEstPreviewId(null) }}
                  className={`p-3 rounded-sm border-2 text-left transition-all active:scale-95 ${
                    newEstType === "ADDITIONAL"
                      ? "border-amber-500 bg-amber-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Plus className="w-4 h-4 text-amber-500" />
                    <span className="font-extrabold text-sm">追加見積</span>
                    {newEstType === "ADDITIONAL" && <CircleCheck className="w-4 h-4 text-amber-500 ml-auto" />}
                  </div>
                  <p className="text-xs text-slate-500">工事開始後の追加・変更工事</p>
                </button>
              </div>
            </div>

            {/* テンプレート選択 */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">テンプレート</label>

              {/* 空の見積 */}
              <button
                type="button"
                onClick={() => { setNewEstSelectedTemplateId(null); setNewEstPreviewId(null) }}
                className={`w-full text-left p-3 rounded-sm border-2 transition-all ${
                  newEstSelectedTemplateId === null
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${newEstSelectedTemplateId === null ? "bg-blue-500" : "bg-slate-200"}`}>
                    {newEstSelectedTemplateId === null ? <CircleCheck className="w-4 h-4 text-white" /> : <FileText className="w-3.5 h-3.5 text-slate-500" />}
                  </div>
                  <div>
                    <p className="font-extrabold text-sm text-slate-900">空の見積から作成</p>
                    <p className="text-xs text-slate-500">一から明細を入力する</p>
                  </div>
                </div>
              </button>

              {/* テンプレート一覧 */}
              {filteredTemplates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-600 px-1">
                    テンプレートから作成（{newEstType === "INITIAL" ? "通常" : "追加"}見積用）
                  </p>
                  {filteredTemplates.map((tpl) => {
                    const isSelected = newEstSelectedTemplateId === tpl.id
                    const isPreviewing = newEstPreviewId === tpl.id
                    const total = calcTemplateTotal(tpl.sections)
                    const itemCount = (tpl.sections ?? []).reduce(
                      (s: number, sec: NonNullable<EstimateTemplate["sections"]>[number]) => s + sec.groups.reduce((gs: number, g: { items: unknown[] }) => gs + g.items.length, 0), 0
                    )
                    return (
                      <div
                        key={tpl.id}
                        className={`rounded-sm border-2 transition-all overflow-hidden ${isSelected ? "border-blue-500 shadow-sm shadow-blue-100" : "border-slate-200"}`}
                      >
                        {/* カードヘッダー */}
                        <button
                          type="button"
                          onClick={() => setNewEstSelectedTemplateId(isSelected ? null : tpl.id)}
                          className={`w-full flex items-start gap-3 p-3 text-left ${isSelected ? "bg-blue-50" : "bg-white hover:bg-slate-50"} transition-colors`}
                        >
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isSelected ? "bg-blue-500" : "bg-slate-200"}`}>
                            {isSelected ? <CircleCheck className="w-4 h-4 text-white" /> : <LayoutTemplate className="w-3.5 h-3.5 text-slate-500" />}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className={`block font-extrabold text-sm ${isSelected ? "text-blue-800" : "text-slate-800"}`}>{tpl.name}</span>
                            {tpl.description && <span className="block text-xs text-slate-500 mt-0.5">{tpl.description}</span>}
                            <span className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-slate-600">
                                {(tpl.sections ?? []).length}セクション / {itemCount}項目
                              </span>
                              {total > 0 && (
                                <span className="text-xs font-mono text-slate-500 tabular-nums">
                                  参考: ¥{formatCurrency(total)}〜
                                </span>
                              )}
                            </span>
                          </span>

                          {/* プレビューボタン */}
                          {tpl.sections && tpl.sections.length > 0 && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (isPreviewing) {
                                  setNewEstPreviewId(null)
                                } else {
                                  setNewEstPreviewId(tpl.id)
                                  setNewEstSelectedTemplateId(tpl.id)
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setNewEstPreviewId(isPreviewing ? null : tpl.id)
                                  if (!isPreviewing) setNewEstSelectedTemplateId(tpl.id)
                                }
                              }}
                              className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-bold transition-colors cursor-pointer ${
                                isPreviewing
                                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              <Eye className="w-3 h-3" />
                              {isPreviewing ? "閉じる" : "中身を見る"}
                              {isPreviewing ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </span>
                          )}
                        </button>

                        {/* テンプレートプレビュー */}
                        {isPreviewing && tpl.sections && (
                          <div className="border-t border-slate-100 bg-slate-50 px-3 py-3 space-y-3">
                            {tpl.sections.map((sec) => (
                              <div key={sec.id}>
                                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                                  {sec.name}
                                </p>
                                {sec.groups.map((grp) => (
                                  <div key={grp.id} className="mb-2 ml-3">
                                    <p className="text-xs font-bold text-slate-500 mb-1">{grp.name}</p>
                                    <div className="rounded-sm overflow-hidden border border-slate-200">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-slate-100 text-slate-500">
                                            <th className="text-left px-2 py-1 font-bold">品名</th>
                                            <th className="text-right px-2 py-1 font-bold w-16">数量</th>
                                            <th className="text-left px-2 py-1 font-bold w-12">単位</th>
                                            <th className="text-right px-2 py-1 font-bold w-24">単価</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                          {grp.items.map((item) => (
                                            <tr key={item.id}>
                                              <td className="px-2 py-1.5 text-slate-700">{item.name}</td>
                                              <td className="px-2 py-1.5 text-right text-slate-600 font-mono tabular-nums">
                                                {Number(item.quantity) > 0 ? Number(item.quantity) : "—"}
                                              </td>
                                              <td className="px-2 py-1.5 text-slate-500">
                                                {item.unit?.name ?? "—"}
                                              </td>
                                              <td className="px-2 py-1.5 text-right text-slate-700 font-mono tabular-nums">
                                                ¥{formatCurrency(Number(item.unitPrice))}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                            <div className="pt-2 border-t border-slate-200 flex justify-end">
                              <Button
                                size="sm"
                                onClick={handleNewEstCreate}
                                disabled={newEstCreating}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 font-bold"
                              >
                                {newEstCreating ? (
                                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />作成中...</>
                                ) : (
                                  <><Plus className="w-3.5 h-3.5 mr-1.5" />このテンプレートで作成</>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" className="flex-1 font-bold" onClick={() => { setNewEstDialogOpen(false); resetNewEstDialog() }} disabled={newEstCreating}>
              キャンセル
            </Button>
            <Button className="flex-1 font-bold" onClick={handleNewEstCreate} disabled={newEstCreating}>
              {newEstCreating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />作成中...</>
              ) : (
                <><Plus className="w-4 h-4 mr-2" />{newEstSelectedTemplateId ? "このテンプレートで作成" : "空の見積で作成"}</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── 共通: 現場情報ヘッダー + アクションボタン ──────────────

function ProjectInfoHeader({
  project,
  showProjectPhotos,
  setShowProjectPhotos,
  router,
  compact,
}: {
  project: Project
  showProjectPhotos: boolean
  setShowProjectPhotos: (v: boolean) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router: any
  /** 見積詳細時などコンパクト表示 */
  compact?: boolean
}) {
  return (
    <>
      {/* 現場情報ヘッダー */}
      <div className={`px-6 ${compact ? "py-3" : "py-5"} border-b border-slate-200 bg-slate-50`}>
        <h2 className={`${compact ? "text-lg" : "text-2xl"} font-extrabold text-slate-900`}>{project.name}</h2>
        <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-500">
          <span>{project.branch.company.name}</span>
          {project.branch.name !== "本社" && (
            <span className="px-2 py-0.5 rounded-sm bg-slate-200 text-xs font-bold text-slate-600">{project.branch.name}</span>
          )}
          <span className="text-slate-300">|</span>
          <span>{project.contact?.name ?? "担当未設定"}</span>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-sm">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-sm bg-blue-50 text-blue-700 font-bold border border-blue-200">
            <CalendarPlus className="w-3.5 h-3.5" />
            立上げ {formatDate(project.createdAt, "yyyy/M/d")}
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-sm bg-slate-100 text-slate-600 font-bold border border-slate-200">
            <CalendarDays className="w-3.5 h-3.5" />
            更新 {formatDate(project.updatedAt, "yyyy/M/d")}
          </span>
        </div>
      </div>

      {/* アクションカード群（4ボタン） */}
      <div className={`px-6 ${compact ? "py-3 grid grid-cols-4 gap-2" : "py-4 grid grid-cols-2 gap-3"}`}>
        {/* Googleマップ */}
        <a
          href={project.address
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.address)}`
            : undefined
          }
          target="_blank"
          rel="noopener noreferrer"
          className={`flex flex-col items-center justify-center gap-1.5 ${compact ? "p-3" : "p-5"} rounded-sm border-2 transition-all active:scale-95 ${
            project.address
              ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100 cursor-pointer"
              : "bg-slate-50 border-dashed border-slate-300 text-slate-400 cursor-not-allowed"
          }`}
          onClick={(e) => { if (!project.address) e.preventDefault() }}
        >
          <MapPin className={compact ? "w-5 h-5" : "w-8 h-8"} />
          <span className={`${compact ? "text-xs" : "text-base"} font-bold`}>Googleマップ</span>
          {!compact && (
            project.address ? (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                {project.address}
              </span>
            ) : (
              <span className="text-xs">住所未設定</span>
            )
          )}
        </a>

        {/* 人員配置 */}
        {(() => {
          const hasContract = project.estimates.some((e) => e.contract !== null)
          return (
            <button
              onClick={() => {
                if (!hasContract) {
                  toast.info("契約が確定してから人員配置が可能になります")
                  return
                }
                router.push(`/worker-assignments`)
              }}
              className={`flex flex-col items-center justify-center gap-1.5 ${compact ? "p-3" : "p-5"} rounded-sm border-2 active:scale-95 transition-all ${
                hasContract
                  ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                  : "bg-slate-50 border-dashed border-slate-300 text-slate-400 cursor-not-allowed"
              }`}
            >
              <Users className={compact ? "w-5 h-5" : "w-8 h-8"} />
              <span className={`${compact ? "text-xs" : "text-base"} font-bold`}>人員配置</span>
              {!compact && <span className={`text-xs ${hasContract ? "text-blue-500" : "text-slate-400"}`}>{hasContract ? "チーム・職人管理" : "契約後に利用可能"}</span>}
            </button>
          )
        })()}

        {/* 画像登録 */}
        <button
          onClick={() => setShowProjectPhotos(!showProjectPhotos)}
          className={`flex flex-col items-center justify-center gap-1.5 ${compact ? "p-3" : "p-5"} rounded-sm border-2 active:scale-95 transition-all ${
            showProjectPhotos
              ? "bg-amber-100 border-amber-400 text-amber-700"
              : "bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100"
          }`}
        >
          <Camera className={compact ? "w-5 h-5" : "w-8 h-8"} />
          <span className={`${compact ? "text-xs" : "text-base"} font-bold`}>画像登録</span>
          {!compact && <span className="text-xs text-amber-500">現場写真・図面</span>}
        </button>

        {/* 安全管理 */}
        <button
          onClick={() => toast.info("安全管理機能は準備中です")}
          className={`flex flex-col items-center justify-center gap-1.5 ${compact ? "p-3" : "p-5"} rounded-sm border-2 border-dashed border-red-300 bg-red-50 text-red-600 hover:bg-red-100 active:scale-95 transition-all`}
        >
          <ShieldCheck className={compact ? "w-5 h-5" : "w-8 h-8"} />
          <span className={`${compact ? "text-xs" : "text-base"} font-bold`}>安全管理</span>
          {!compact && <span className="text-xs text-red-500">KY・安全書類</span>}
        </button>
      </div>

      {/* 画像登録セクション（トグル表示） */}
      {showProjectPhotos && (
        <div className="px-6 pb-2">
          <div className="rounded-sm border-2 border-amber-200 bg-amber-50/30 p-4">
            <SiteOpsPhotoSection projectId={project.id} compact />
          </div>
        </div>
      )}
    </>
  )
}

// ─── サマリーカード ─────────────────────────────────────

function SummaryCard({
  count, label, active, onClick, colors, compact,
}: {
  count: number
  label: string
  active: boolean
  onClick: () => void
  colors: { activeBg: string; activeText: string; activeShadow: string; inactiveBg: string; inactiveNum: string; inactiveLabel: string }
  compact?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`${compact ? "rounded-sm p-2" : "rounded-sm p-4"} border-2 transition-all active:scale-95 ${
        active
          ? `${colors.activeBg} ${colors.activeText} shadow-lg ${colors.activeShadow}`
          : `${colors.inactiveBg} hover:opacity-80`
      }`}
    >
      <div className={`${compact ? "text-xl" : "text-3xl"} font-black tabular-nums ${active ? colors.activeText : colors.inactiveNum}`}>{count}</div>
      <div className={`${compact ? "text-xs" : "text-sm"} font-bold ${compact ? "mt-0" : "mt-1"} ${active ? "opacity-70" : colors.inactiveLabel}`}>{label}</div>
    </button>
  )
}

// ─── 現場ブロック ──────────────────────────────────────

function SiteBlock({
  project, onProjectClick, onEstimateClick,
  selectedProjectId, selectedEstimateId, hasPanel,
  showHidden, collapsedProjects, toggleProject,
  checkedIds, toggleCheck,
  onArchive, onContract, onDelete, onHide, onRestore, router,
}: {
  project: Project
  onProjectClick: (id: string) => void
  onEstimateClick: (id: string) => void
  selectedProjectId: string | null
  selectedEstimateId: string | null
  hasPanel: boolean
  showHidden: boolean
  collapsedProjects: Set<string>
  toggleProject: (id: string) => void
  checkedIds: Set<string>
  toggleCheck: (id: string) => void
  onArchive: (id: string) => void
  onContract: (est: EstimateRow, project: Project) => void
  onDelete: (id: string, name: string) => void
  onHide: (id: string, name: string) => void
  onRestore: (id: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router: any
}) {
  const visibleEstimates = project.estimates.filter((e) => showHidden || !e.isArchived)
  const totalAmount = visibleEstimates.filter((e) => !e.isArchived).reduce((sum, e) => sum + e.totalAmount, 0)
  const isCollapsed = collapsedProjects.has(project.id)

  return (
    <div className={`${hasPanel ? "px-2 py-2" : "px-4 py-4"}`}>
      {/* ── 現場ヘッダー（クリックで右パネルに現場ビュー表示） ── */}
      <div
        onClick={() => onProjectClick(project.id)}
        className={`bg-white rounded-sm border-2 ${hasPanel ? "px-2.5 py-2" : "px-4 py-3"} shadow-sm cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors ${
          selectedProjectId === project.id ? "border-blue-400 ring-2 ring-blue-200" : "border-slate-300"
        }`}
      >
        <div className="flex items-center gap-2">
          {/* 展開アイコン（クリックで展開/折りたたみのみ） */}
          {visibleEstimates.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleProject(project.id) }}
              className={`${hasPanel ? "w-5 h-5" : "w-7 h-7"} shrink-0 rounded-sm flex items-center justify-center transition-colors ${
                isCollapsed
                  ? "bg-slate-200 text-slate-600 hover:bg-blue-500 hover:text-white"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            >
              {isCollapsed ? <ChevronRight className={`${hasPanel ? "w-3 h-3" : "w-4 h-4"}`} /> : <ChevronDown className={`${hasPanel ? "w-3 h-3" : "w-4 h-4"}`} />}
            </button>
          )}

          {/* 現場名 + 支店 */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <h3 className={`${hasPanel ? "text-sm" : "text-lg"} font-extrabold text-slate-900 leading-tight truncate`}>
              {project.name}
            </h3>
            {project.branch.name !== "本社" && (
              <span className="shrink-0 px-2 py-0.5 rounded-sm bg-slate-200 text-xs font-bold text-slate-600">
                {project.branch.name}
              </span>
            )}
          </div>

          {/* 日付（コンパクト） */}
          {!hasPanel && (
            <span className="shrink-0 text-sm text-slate-500 font-medium tabular-nums">
              {formatDate(project.createdAt, "yyyy/M/d")} 立上
            </span>
          )}

          {/* 件数 */}
          <span className={`shrink-0 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-2.5 py-1 text-sm"} rounded-sm bg-blue-100 text-blue-700 font-bold`}>
            {visibleEstimates.length}件
          </span>

          {/* アクションボタン（stopPropagationで現場クリックと独立） */}
          {!hasPanel && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/projects/${project.id}`) }}
                className="px-3 py-1.5 rounded-sm bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200 active:scale-95 transition-all"
              >
                詳細
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/projects/${project.id}?newEstimate=1`) }}
                className="px-3 py-1.5 rounded-sm bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5 inline mr-0.5" />見積追加
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onArchive(project.id) }}
                className="px-2 py-1.5 rounded-sm bg-slate-100 text-slate-400 hover:bg-orange-100 hover:text-orange-600 active:scale-95 transition-all"
                title="失注アーカイブ"
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* 住所・担当（1行にまとめる） */}
        <div className={`flex items-center gap-2 mt-0.5 ${hasPanel ? "ml-7 text-xs" : "ml-10 text-sm"} text-slate-500`}>
          {project.address ? (
            <span className={`truncate ${hasPanel ? "max-w-[180px]" : "max-w-[300px]"}`}>{project.address}</span>
          ) : (
            <span className="text-amber-500 font-medium">住所未設定</span>
          )}
          {!hasPanel && (
            <>
              <span className="text-slate-300">|</span>
              <span className="font-medium">{project.contact?.name ?? "担当未設定"}</span>
            </>
          )}
        </div>
      </div>

      {/* ── 見積ブロック群（左線でぶら下がり表現） ── */}
      {!isCollapsed && visibleEstimates.length > 0 && (
        <div className={`${hasPanel ? "ml-4" : "ml-8"} border-l-3 border-slate-300 ${hasPanel ? "pl-2" : "pl-4"} mt-1 space-y-1.5 pt-1.5 pb-1`}>
          {visibleEstimates.map((est, idx) => {
            const displayName = est.title ?? (visibleEstimates.length === 1 ? "見積" : `見積 ${idx + 1}`)
            const config = STATUS_BLOCK[est.status]
            const isSelected = selectedEstimateId === est.id
            const isChecked = checkedIds.has(est.id)
            const checkable = est.status === "CONFIRMED" || est.status === "SENT"
            const isHidden = est.isArchived

            // 非表示見積
            if (isHidden) {
              return (
                <div key={est.id} className="flex items-center gap-3 px-4 py-2 rounded-sm bg-slate-100 border border-slate-200 opacity-60">
                  <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-400 truncate flex-1">{displayName}</span>
                  <button
                    onClick={() => onRestore(est.id)}
                    className="px-3 py-1.5 rounded-sm text-sm font-bold bg-blue-100 text-blue-600 hover:bg-blue-200 active:scale-95 transition-all"
                  >
                    復元
                  </button>
                </div>
              )
            }

            return (
              <div
                key={est.id}
                onClick={() => onEstimateClick(est.id)}
                className={`
                  rounded-sm border-l-[5px] ${config.cardBorder}
                  ${isSelected ? "ring-2 ring-blue-400 shadow-lg shadow-blue-100 bg-white" : `${config.cardBg} ${config.cardHover}`}
                  ${isChecked ? "ring-2 ring-green-400 shadow-md" : ""}
                  border border-slate-200 transition-all cursor-pointer
                  ${hasPanel ? "px-2 py-1.5" : "px-4 py-3"}
                `}
              >
                {/* 1行目: 見積名 + 金額 + 担当者 + 作成日 */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className={`${hasPanel ? "text-xs" : "text-base"} font-extrabold text-slate-800 truncate`}>
                      {displayName}
                    </span>
                    {est.estimateType === "ADDITIONAL" && (
                      <span className={`shrink-0 ${hasPanel ? "px-1 py-0 text-[10px]" : "px-2 py-0.5 text-xs"} rounded-sm bg-amber-100 text-amber-700 border border-amber-300 font-bold`}>
                        追加
                      </span>
                    )}
                  </div>

                  {/* 担当者 - パネルオープン時は非表示 */}
                  {!hasPanel && (
                    <span className="shrink-0 px-3 py-1 rounded-sm text-sm font-bold bg-indigo-100 text-indigo-700">
                      {est.user.name}
                    </span>
                  )}

                  {/* 作成日 - パネルオープン時は非表示 */}
                  {!hasPanel && (
                    <span className="shrink-0 text-sm text-slate-500 font-medium tabular-nums">
                      {formatDate(est.createdAt, "M/d")} 作成
                    </span>
                  )}

                  {/* 金額 */}
                  <span className={`shrink-0 ${hasPanel ? "text-sm" : "text-xl"} font-black ${config.accent} tabular-nums`}>
                    ¥{formatCurrency(est.totalAmount)}
                  </span>
                </div>

                {/* 2行目: ステップ進行バー + アクション */}
                <div className={`flex items-center ${hasPanel ? "gap-1 mt-1" : "gap-1.5 mt-2"} flex-wrap`}>
                  {/* STEP 1: 確定 */}
                  {est.status === "DRAFT" ? (
                    <span className={`inline-flex items-center gap-0.5 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} rounded-sm font-bold border-2 border-dashed border-amber-300 text-amber-400 bg-amber-50/50`}>
                      <CalendarCheck className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"}`} />
                      未確定
                    </span>
                  ) : (
                    <span className={`inline-flex items-center gap-0.5 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} rounded-sm font-bold bg-blue-500 text-white shadow-sm`}>
                      <CalendarCheck className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"}`} />
                      {hasPanel ? "確定" : (est.confirmedAt ? `${formatDate(est.confirmedAt, "M/d")} 確定` : "確定済")}
                    </span>
                  )}

                  <ChevronRight className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} text-slate-300 shrink-0`} />

                  {/* STEP 2: 送付 */}
                  {est.status === "SENT" ? (
                    <span className={`inline-flex items-center gap-0.5 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} rounded-sm font-bold bg-emerald-500 text-white shadow-sm`}>
                      送付済
                    </span>
                  ) : est.status === "CONFIRMED" ? (
                    <span className={`inline-flex items-center gap-0.5 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} rounded-sm font-bold border-2 border-dashed border-blue-300 text-blue-400 bg-blue-50/50`}>
                      未送付
                    </span>
                  ) : (
                    <span className={`inline-flex items-center gap-0.5 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} rounded-sm font-bold border-2 border-dashed border-slate-200 text-slate-300 bg-slate-50/50`}>
                      未送付
                    </span>
                  )}

                  <ChevronRight className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} text-slate-300 shrink-0`} />

                  {/* STEP 3: 契約処理 */}
                  {checkable ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onContract(est, project) }}
                      className={`inline-flex items-center gap-0.5 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} rounded-sm font-bold border-2 border-dashed border-green-400 text-green-500 bg-green-50/50 hover:bg-green-100 hover:border-green-500 hover:text-green-700 active:scale-95 transition-all cursor-pointer`}
                    >
                      <HandshakeIcon className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"}`} />
                      契約
                    </button>
                  ) : (
                    <span className={`inline-flex items-center gap-0.5 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} rounded-sm font-bold border-2 border-dashed border-slate-200 text-slate-300 bg-slate-50/50`}>
                      <HandshakeIcon className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"}`} />
                      {hasPanel ? "契約" : "契約に進む"}
                    </span>
                  )}

                  <div className="flex-1" />

                  {/* チェックボックス - パネルオープン時は非表示 */}
                  {checkable && !hasPanel && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleCheck(est.id) }}
                      className={`px-3 py-1.5 rounded-sm text-sm font-bold transition-all active:scale-95 ${
                        isChecked
                          ? "bg-green-100 text-green-700 border-2 border-green-400"
                          : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-green-50 hover:text-green-600"
                      }`}
                    >
                      {isChecked
                        ? <><CheckSquare className="w-3.5 h-3.5 inline mr-0.5" />選択中</>
                        : <><Square className="w-3.5 h-3.5 inline mr-0.5" />選択</>
                      }
                    </button>
                  )}

                  {/* 削除 or 非表示 - パネルオープン時は非表示 */}
                  {!hasPanel && (
                    est.status === "DRAFT" ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(est.id, displayName) }}
                        className="px-2 py-1.5 rounded-sm bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600 active:scale-95 transition-all"
                        title="削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); onHide(est.id, displayName) }}
                        className="px-2 py-1.5 rounded-sm bg-slate-100 text-slate-400 hover:bg-orange-100 hover:text-orange-600 active:scale-95 transition-all"
                        title="非表示"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}
                </div>
              </div>
            )
          })}

          {/* 合計 */}
          {visibleEstimates.filter((e) => !e.isArchived).length >= 2 && (
            <div className="flex justify-end py-0.5">
              <div className={`inline-flex items-center gap-2 ${hasPanel ? "px-2 py-1 text-xs" : "px-4 py-1.5 text-sm"} rounded-sm bg-slate-800`}>
                <span className="text-slate-400 font-medium">合計</span>
                <span className="text-white font-black tabular-nums">¥{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
