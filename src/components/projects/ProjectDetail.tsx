/**
 * [COMPONENT] 現場詳細 - ProjectDetail
 *
 * 現場の基本情報・担当者・見積一覧を表示。
 * 1現場に複数見積を持てる。見積ごとに「通常見積 / 追加見積」の区別あり。
 *
 * 新規見積作成フロー:
 * 1. 「新規見積追加」ボタン → ダイアログ
 * 2. 見積タイトル入力（任意）・種別選択（通常/追加）・テンプレート選択
 * 3. POST /api/estimates → 作成された見積の編集画面へ遷移
 *
 * autoOpenDialog=true の場合（?newEstimate=1 付きでアクセス時）は
 * ページロード直後にダイアログを自動で開く。
 *
 * ビュー分離:
 * - ProjectDetailMobile.tsx: モバイル用レイアウト
 * - ProjectDetailDesktop.tsx: デスクトップ・コンパクト・埋め込みレイアウト
 */
"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Plus,
  FileText,
  LayoutTemplate,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ChevronDown,
  FilePlus2,
  Wrench,
  Eye,
  Pencil,
} from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { ContractProcessingDialog } from "@/components/contracts/ContractProcessingDialog"
import type { ContractEstimateItem } from "@/components/contracts/contract-types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { useEstimateCreate, type EstimateTemplate } from "@/hooks/use-estimate-create"
import type { EstimateStatus, ContractStatus, EstimateType, AddressType } from "@prisma/client"
import { EstimateDetail } from "@/components/estimates/EstimateDetail"
import { ProjectDetailMobile } from "./ProjectDetailMobile"
import { ProjectDetailDesktop } from "./ProjectDetailDesktop"

// ─── ステータス表示設定 ────────────────────────────────

const statusConfig: Record<EstimateStatus, { label: string; className: string }> = {
  DRAFT: { label: "下書き", className: "bg-orange-100 text-orange-700" },
  CONFIRMED: { label: "確定", className: "bg-blue-100 text-blue-700" },
  SENT: { label: "送付済", className: "bg-green-100 text-green-700" },
  OLD: { label: "旧版", className: "bg-slate-100 text-slate-500" },
}

const contractStatusConfig: Record<ContractStatus, { label: string; className: string }> = {
  CONTRACTED: { label: "契約済", className: "bg-green-100 text-green-700" },
  SCHEDULE_CREATED: { label: "工程作成済", className: "bg-cyan-100 text-cyan-700" },
  IN_PROGRESS: { label: "着工", className: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "完工", className: "bg-teal-100 text-teal-700" },
  BILLED: { label: "請求済", className: "bg-purple-100 text-purple-700" },
  PAID: { label: "入金済", className: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "キャンセル", className: "bg-red-100 text-red-600" },
}

// ─── 型定義 ────────────────────────────────────────────

interface TemplateItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  unit: { name: string } | null
}

interface TemplateGroup {
  id: string
  name: string
  items: TemplateItem[]
}

interface TemplateSection {
  id: string
  name: string
  groups: TemplateGroup[]
}

interface Template {
  id: string
  name: string
  description: string | null
  estimateType: "INITIAL" | "ADDITIONAL" | "BOTH"
  sections: TemplateSection[]
}

export interface EstimateInProject {
  id: string
  estimateNumber: string | null
  revision: number
  title: string | null
  estimateType: EstimateType
  status: EstimateStatus
  addressType: AddressType
  validDays: number
  note: string | null
  discountAmount: number | null
  createdAt: Date
  confirmedAt: Date | null
  sentAt: Date | null
  user: { id: string; name: string }
  contract: { id: string; status: ContractStatus } | null
  sections: {
    id: string
    name: string
    sortOrder: number
    groups: {
      id: string
      name: string
      items: {
        id: string
        name: string
        quantity: number
        unitPrice: number
        unit: { id: string; name: string }
      }[]
    }[]
  }[]
}

interface ContactOption {
  id: string
  name: string
  phone: string
  email: string
}

interface UnitOption {
  id: string
  name: string
}

interface Props {
  project: {
    id: string
    shortId: string
    name: string
    address: string | null
    startDate: Date | null
    endDate: Date | null
    branch: { name: string; company: { name: string } }
    contact: { id: string; name: string; phone: string; email: string } | null
    estimates: EstimateInProject[]
  }
  templates: Template[]
  currentUser: { id: string; name: string }
  autoOpenDialog?: boolean
  contacts: ContactOption[]
  units: UnitOption[]
  taxRate: number
  estimateBundles?: Array<{
    id: string
    bundleNumber: string | null
    title: string | null
    createdAt: string
    items: Array<{
      estimateId: string
      estimateNumber: string | null
      title: string | null
    }>
  }>
  embedded?: boolean
  compact?: boolean
  activeEstimateId?: string | null
  onClose?: () => void
  onRefresh?: () => void
  onSelectEstimate?: (estimateId: string) => void
}

// Select の「未設定」用センチネル値（空文字列は Radix UI で不可）
const NO_CONTACT = "__none__"

// ─── 金額計算 ─────────────────────────────────────────

function calcTotal(
  sections: { groups: { items: { quantity: number; unitPrice: number }[] }[] }[]
): number {
  return sections.reduce(
    (s, sec) => s + sec.groups.reduce((gs, g) => gs + g.items.reduce((is, i) => is + i.quantity * i.unitPrice, 0), 0),
    0
  )
}

// ─── ビュー用 Props インターフェース ──────────────────

export interface ProjectDetailViewProps {
  project: Props["project"]
  templates: Template[]
  currentUser: { id: string; name: string }
  contacts: ContactOption[]
  units: UnitOption[]
  taxRate: number
  estimateBundles: NonNullable<Props["estimateBundles"]>
  embedded: boolean
  compact: boolean
  selectedEstimateId: string | null
  setSelectedEstimateId: (id: string | null) => void
  isEstimateEditing: boolean
  setIsEstimateEditing: (v: boolean) => void
  guardedAction: (action: () => void) => void
  confirmDiscard: () => void
  cancelDiscard: () => void
  unsavedDialogOpen: boolean
  pendingAction: (() => void) | null
  dialogOpen: boolean
  openDialog: () => void
  selectedTemplateId: string | null
  setSelectedTemplateId: (id: string | null) => void
  previewTemplateId: string | null
  setPreviewTemplateId: (id: string | null) => void
  estimateTitle: string
  setEstimateTitle: (v: string) => void
  estimateType: "INITIAL" | "ADDITIONAL"
  setEstimateType: (v: "INITIAL" | "ADDITIONAL") => void
  handleCreateEstimate: () => void
  handleQuickCreateEstimate: () => void
  creating: boolean
  issikiTemplate: EstimateTemplate | null
  checkedEstimateIds: Set<string>
  toggleCheck: (id: string) => void
  setCheckedEstimateIds: (ids: Set<string>) => void
  checkableEstimates: EstimateInProject[]
  bulkContractOpen: boolean
  setBulkContractOpen: (v: boolean) => void
  contractDialogItems: ContractEstimateItem[]
  handleBulkPrint: () => void
  handleCreateBundle: () => void
  handleDeleteBundle: (bundleId: string) => void
  editOpen: boolean
  openEdit: (focusField?: string) => void
  handleSaveEdit: () => void
  editSaving: boolean
  editName: string
  setEditName: (v: string) => void
  editAddress: string
  setEditAddress: (v: string) => void
  editContactId: string
  setEditContactId: (v: string) => void
  editStartDate: string
  setEditStartDate: (v: string) => void
  editEndDate: string
  setEditEndDate: (v: string) => void
  editFocusField: string | null
  editNameRef: React.RefObject<HTMLInputElement | null>
  editAddressRef: React.RefObject<HTMLInputElement | null>
  editContactRef: React.RefObject<HTMLButtonElement | null>
  editStartDateRef: React.RefObject<HTMLInputElement | null>
  editEndDateRef: React.RefObject<HTMLInputElement | null>
  onClose?: () => void
  onRefresh?: () => void
  onSelectEstimateProp?: (estimateId: string) => void
  refreshData: () => void
  router: ReturnType<typeof useRouter>
  statusConfig: Record<EstimateStatus, { label: string; className: string }>
  contractStatusConfig: Record<ContractStatus, { label: string; className: string }>
  calcTotal: typeof calcTotal
  initialEstimates: EstimateInProject[]
  additionalEstimates: EstimateInProject[]
  selectedEstimate: EstimateInProject | null
  estimateDetailData: {
    id: string
    estimateNumber: string | null
    revision: number
    title: string | null
    estimateType: EstimateType
    status: EstimateStatus
    addressType: AddressType
    validDays: number
    note: string | null
    discountAmount: number | null
    createdAt: Date
    confirmedAt: Date | null
    sentAt: Date | null
    user: { id: string; name: string }
    contract: { id: string; status: ContractStatus } | null
    sections: EstimateInProject["sections"]
    project: {
      id: string
      shortId: string
      name: string
      address: string | null
      startDate: Date | null
      endDate: Date | null
      branch: { name: string; company: { name: string } }
      contact: { id: string; name: string } | null
    }
  } | null
  isContractable: (est: EstimateInProject) => boolean
  isPrintable: (est: EstimateInProject) => boolean
  isCheckable: (est: EstimateInProject) => boolean
  autoOpenDialog: boolean
  activeEstimateId?: string | null
  isMobile: boolean
}

// ─── メインコンポーネント ───────────────────────────────

export function ProjectDetail({ project, templates, currentUser, autoOpenDialog = false, contacts, units, taxRate, estimateBundles = [], embedded = false, compact = false, activeEstimateId, onClose, onRefresh, onSelectEstimate: onSelectEstimateProp }: Props) {
  const router = useRouter()
  const isMobile = useIsMobile()

  const [internalSelectedEstimateId, setInternalSelectedEstimateId] = useState<string | null>(null)
  const selectedEstimateId = (embedded && onSelectEstimateProp) ? (activeEstimateId ?? null) : internalSelectedEstimateId
  const setSelectedEstimateId = (embedded && onSelectEstimateProp)
    ? (_id: string | null) => {}
    : setInternalSelectedEstimateId

  useEffect(() => {
    if (embedded || isMobile) return
    const el = document.getElementById("app-content")
    if (!el) return
    if (selectedEstimateId) {
      el.classList.remove("max-w-7xl", "mx-auto")
    } else {
      el.classList.add("max-w-7xl", "mx-auto")
    }
    return () => { el.classList.add("max-w-7xl", "mx-auto") }
  }, [selectedEstimateId, embedded, isMobile])

  function refreshData() {
    if (embedded && onRefresh) {
      onRefresh()
    } else {
      router.refresh()
    }
  }

  // ── 編集中の保護 ──────────────────────────────────────
  const [isEstimateEditing, setIsEstimateEditing] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false)

  function guardedAction(action: () => void) {
    if (isEstimateEditing) {
      setPendingAction(() => action)
      setUnsavedDialogOpen(true)
    } else {
      action()
    }
  }

  function confirmDiscard() {
    setIsEstimateEditing(false)
    setUnsavedDialogOpen(false)
    pendingAction?.()
    setPendingAction(null)
  }

  function cancelDiscard() {
    setUnsavedDialogOpen(false)
    setPendingAction(null)
  }

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null)
  const [estimateTitle, setEstimateTitle] = useState("")
  // "INITIAL" = 通常見積, "ADDITIONAL" = 追加見積
  const [estimateType, setEstimateType] = useState<"INITIAL" | "ADDITIONAL">("INITIAL")

  // ── 見積作成の共通ロジック ──
  const {
    creating,
    issikiTemplate,
    getEstimateType,
    getFilteredTemplates,
    createEstimate,
    quickCreate,
  } = useEstimateCreate({
    templates,
    onCreated: (estimateId) => {
      refreshData()
      setSelectedEstimateId(estimateId)
    },
  })

  // ── 現場情報編集 ──────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState(project.name)
  const [editAddress, setEditAddress] = useState(project.address ?? "")
  const [editContactId, setEditContactId] = useState(
    project.contact
      ? contacts.find((c) => c.name === project.contact?.name)?.id ?? NO_CONTACT
      : NO_CONTACT
  )
  const [editStartDate, setEditStartDate] = useState(
    project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : ""
  )
  const [editEndDate, setEditEndDate] = useState(
    project.endDate ? new Date(project.endDate).toISOString().slice(0, 10) : ""
  )
  const [editSaving, setEditSaving] = useState(false)
  const [editFocusField, setEditFocusField] = useState<string | null>(null)
  const editNameRef = useRef<HTMLInputElement>(null)
  const editAddressRef = useRef<HTMLInputElement>(null)
  const editContactRef = useRef<HTMLButtonElement>(null)
  const editStartDateRef = useRef<HTMLInputElement>(null)
  const editEndDateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editOpen && editFocusField) {
      const timer = setTimeout(() => {
        if (editFocusField === "contact") {
          editContactRef.current?.focus()
        } else {
          const refMap: Record<string, React.RefObject<HTMLInputElement | null>> = {
            name: editNameRef,
            address: editAddressRef,
            startDate: editStartDateRef,
            endDate: editEndDateRef,
          }
          refMap[editFocusField]?.current?.focus()
        }
        setEditFocusField(null)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [editOpen, editFocusField])

  function openEdit(focusField?: string) {
    setEditName(project.name)
    setEditAddress(project.address ?? "")
    setEditContactId(
      project.contact
        ? contacts.find((c) => c.name === project.contact?.name)?.id ?? NO_CONTACT
        : NO_CONTACT
    )
    setEditStartDate(project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : "")
    setEditEndDate(project.endDate ? new Date(project.endDate).toISOString().slice(0, 10) : "")
    setEditFocusField(focusField ?? "name")
    setEditOpen(true)
  }

  async function handleSaveEdit() {
    if (!editName.trim()) { toast.error("現場名は必須です"); return }
    setEditSaving(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          address: editAddress.trim() || null,
          contactId: editContactId === NO_CONTACT ? null : editContactId,
          startDate: editStartDate || null,
          endDate: editEndDate || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "更新に失敗しました")
      }
      toast.success("現場情報を更新しました")
      setEditOpen(false)
      refreshData()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setEditSaving(false)
    }
  }

  // ── 複数チェック・一括契約・一括印刷 ──────────────────
  const [checkedEstimateIds, setCheckedEstimateIds] = useState<Set<string>>(new Set())
  const [bulkContractOpen, setBulkContractOpen] = useState(false)

  // 契約処理対象：確定済み・送付済みで未契約
  function isContractable(est: EstimateInProject): boolean {
    return !est.contract && (est.status === "CONFIRMED" || est.status === "SENT")
  }

  // 印刷対象：確定済み・送付済み（契約済み含む）
  function isPrintable(est: EstimateInProject): boolean {
    return est.status === "CONFIRMED" || est.status === "SENT"
  }

  // チェックボックスで選択できる（契約処理または印刷できる）
  function isCheckable(est: EstimateInProject): boolean {
    return isContractable(est) || isPrintable(est)
  }

  function toggleCheck(id: string) {
    setCheckedEstimateIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const checkableEstimates = useMemo(
    () => project.estimates.filter(isCheckable),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.estimates]
  )

  // 一括印刷：選択中の印刷可能な見積のIDを使う
  function handleBulkPrint() {
    const printIds = project.estimates
      .filter((e) => checkedEstimateIds.has(e.id) && isPrintable(e))
      .map((e) => e.id)
    if (printIds.length === 0) { toast.error("印刷できる見積がありません（確定済み・送付済みのみ印刷できます）"); return }
    window.open(`/estimates/bulk?ids=${printIds.join(",")}`, "_blank")
  }

  // 見積セット作成
  async function handleCreateBundle() {
    const printableIds = project.estimates
      .filter((e) => checkedEstimateIds.has(e.id) && isPrintable(e))
      .map((e) => e.id)
    if (printableIds.length === 0) { toast.error("セットにできる見積がありません（確定済み・送付済みのみ）"); return }
    try {
      const res = await fetch("/api/estimate-bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, estimateIds: printableIds }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "作成に失敗しました" }))
        toast.error(err.error || "作成に失敗しました")
        return
      }
      const data = await res.json()
      toast.success(`見積セットを作成しました（${data.bundleNumber}）`)
      window.open(`/estimate-bundles/${data.id}/print`, "_blank")
      setCheckedEstimateIds(new Set())
      refreshData()
    } catch {
      toast.error("見積セットの作成に失敗しました")
    }
  }

  async function handleDeleteBundle(bundleId: string) {
    if (!confirm("この提出履歴を削除しますか？")) return
    try {
      const res = await fetch(`/api/estimate-bundles/${bundleId}`, { method: "DELETE" })
      if (!res.ok) { toast.error("削除に失敗しました"); return }
      toast.success("提出履歴を削除しました")
      refreshData()
    } catch {
      toast.error("削除に失敗しました")
    }
  }

  // 契約ダイアログ用の items を組み立て
  const contractDialogItems: ContractEstimateItem[] = useMemo(() => {
    return project.estimates
      .filter((e) => checkedEstimateIds.has(e.id) && isContractable(e))
      .map((est, idx) => ({
        estimateId: est.id,
        estimateName: est.title ?? `見積 ${idx + 1}`,
        estimateNumber: est.estimateNumber ?? null,
        projectId: project.id,
        projectName: project.name,
        companyName: project.branch.company.name,
        taxExcludedAmount: calcTotal(est.sections),
        taxRate,
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, checkedEstimateIds, taxRate])

  // ?newEstimate=1 で自動オープン
  useEffect(() => {
    if (autoOpenDialog) {
      setDialogOpen(true)
    }
  }, [autoOpenDialog])

  // 見積の連番（タイトル未設定時の表示用）
  const nextEstimateIndex = project.estimates.length + 1

  // ── 見積作成 ──────────────────────────────────────────
  async function handleCreateEstimate() {
    const id = await createEstimate({
      projectId: project.id,
      templateId: selectedTemplateId ?? undefined,
      title: estimateTitle,
      estimateType,
    })
    if (id) {
      toast.success(
        selectedTemplateId
          ? "テンプレートから見積を作成しました。内容を確認・編集してください。"
          : "空の見積を作成しました。明細を入力してください。"
      )
      setDialogOpen(false)
    }
  }

  function openDialog() {
    setSelectedTemplateId(null)
    setEstimateTitle("")
    const type = getEstimateType(project.estimates.length)
    setEstimateType(type)
    // テンプレートが1つしかない場合は自動選択
    const filtered = getFilteredTemplates(type)
    if (filtered.length === 1) {
      setSelectedTemplateId(filtered[0].id)
    }
    setDialogOpen(true)
  }

  // ── クイック見積作成（一式テンプレートでワンクリック作成） ──
  async function handleQuickCreateEstimate() {
    await quickCreate(project.id, project.estimates.length)
  }

  // 見積種別ごとにグループ化して表示
  const initialEstimates = project.estimates.filter((e) => e.estimateType === "INITIAL")
  const additionalEstimates = project.estimates.filter((e) => e.estimateType === "ADDITIONAL")

  // 選択中の見積データを EstimateDetail 用に変換
  const selectedEstimate = selectedEstimateId
    ? project.estimates.find((e) => e.id === selectedEstimateId) ?? null
    : null

  const estimateDetailData = selectedEstimate
    ? {
        ...selectedEstimate,
        project: {
          id: project.id,
          shortId: project.shortId,
          name: project.name,
          address: project.address,
          startDate: project.startDate,
          endDate: project.endDate,
          branch: project.branch,
          contact: project.contact ? { id: project.contact.id, name: project.contact.name } : null,
        },
      }
    : null

  // ── ビュー用 props をまとめる ──
  const viewProps: ProjectDetailViewProps = {
    project,
    templates,
    currentUser,
    contacts,
    units,
    taxRate,
    estimateBundles,
    embedded,
    compact,
    selectedEstimateId,
    setSelectedEstimateId,
    isEstimateEditing,
    setIsEstimateEditing,
    guardedAction,
    confirmDiscard,
    cancelDiscard,
    unsavedDialogOpen,
    pendingAction,
    dialogOpen,
    openDialog,
    selectedTemplateId,
    setSelectedTemplateId,
    previewTemplateId,
    setPreviewTemplateId,
    estimateTitle,
    setEstimateTitle,
    estimateType,
    setEstimateType,
    handleCreateEstimate,
    handleQuickCreateEstimate,
    creating,
    issikiTemplate,
    checkedEstimateIds,
    toggleCheck,
    setCheckedEstimateIds,
    checkableEstimates,
    bulkContractOpen,
    setBulkContractOpen,
    contractDialogItems,
    handleBulkPrint,
    handleCreateBundle,
    handleDeleteBundle,
    editOpen,
    openEdit,
    handleSaveEdit,
    editSaving,
    editName,
    setEditName,
    editAddress,
    setEditAddress,
    editContactId,
    setEditContactId,
    editStartDate,
    setEditStartDate,
    editEndDate,
    setEditEndDate,
    editFocusField,
    editNameRef,
    editAddressRef,
    editContactRef,
    editStartDateRef,
    editEndDateRef,
    onClose,
    onRefresh,
    onSelectEstimateProp,
    refreshData,
    router,
    statusConfig,
    contractStatusConfig,
    calcTotal,
    initialEstimates,
    additionalEstimates,
    selectedEstimate,
    estimateDetailData,
    isContractable,
    isPrintable,
    isCheckable,
    autoOpenDialog,
    activeEstimateId,
    isMobile,
  }

  return (
    <div className={embedded ? "" : "flex gap-0"}>
      {/* 左パネル：現場情報 + 見積一覧 */}
      <div className={embedded ? (compact ? "space-y-3" : "space-y-4") : isMobile ? "space-y-4 flex-1" : `space-y-6 transition-all duration-300 ${selectedEstimateId ? "w-[480px] shrink-0 overflow-y-auto max-h-[calc(100vh-4rem)] pr-6" : "flex-1"}`}>

      {/* ビュー分岐 */}
      {isMobile && !embedded ? (
        <ProjectDetailMobile {...viewProps} />
      ) : (
        <ProjectDetailDesktop {...viewProps} />
      )}

      {/* ── 現場情報編集ダイアログ ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              現場情報を編集
            </DialogTitle>
            <DialogDescription>
              住所・担当者・工期を変更できます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>現場名 <span className="text-red-500">*</span></Label>
              <Input
                ref={editNameRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="例：〇〇ビル改修工事"
              />
            </div>
            <div className="space-y-1.5">
              <Label>住所</Label>
              <Input
                ref={editAddressRef}
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="例：東京都渋谷区〇〇1-1-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>先方担当者</Label>
              {contacts.length > 0 ? (
                <Select
                  value={editContactId}
                  onValueChange={setEditContactId}
                >
                  <SelectTrigger ref={editContactRef}>
                    <SelectValue placeholder="担当者を選択（任意）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CONTACT}>未設定</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.phone && <span className="text-slate-600 ml-2 text-xs">{c.phone}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-slate-400 py-1">
                  担当者が登録されていません。マスター管理で追加できます。
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>着工予定日</Label>
                <Input
                  ref={editStartDateRef}
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>完工予定日</Label>
                <Input
                  ref={editEndDateRef}
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
              キャンセル
            </Button>
            <Button onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</> : "保存する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 契約処理ダイアログ（共通モジュール） */}
      <ContractProcessingDialog
        open={bulkContractOpen}
        onOpenChange={setBulkContractOpen}
        items={contractDialogItems}
        mode="individual"
        onCompleted={() => {
          setCheckedEstimateIds(new Set())
          refreshData()
        }}
      />

      {/* 新規見積作成ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              見積を追加
            </DialogTitle>
            <DialogDescription>
              {project.name} に新しい見積を作成します。
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* 見積のタイトル入力 */}
            <div className="space-y-1.5">
              <Label htmlFor="est-title">見積タイトル（任意）</Label>
              <Input
                id="est-title"
                placeholder={`例: A棟工事、追加養生、見積${nextEstimateIndex}`}
                value={estimateTitle}
                onChange={(e) => setEstimateTitle(e.target.value)}
              />
              <p className="text-xs text-slate-400">
                未入力の場合は「見積{nextEstimateIndex}」として表示されます
              </p>
            </div>

            {/* 見積種別 */}
            <div className="space-y-2">
              <Label>見積の種別</Label>
              <div className="grid grid-cols-2 gap-3">
                {/* 通常見積 */}
                <button
                  type="button"
                  onClick={() => { setEstimateType("INITIAL"); setSelectedTemplateId(null) }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    estimateType === "INITIAL"
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FilePlus2 className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-sm">通常見積</span>
                    {estimateType === "INITIAL" && (
                      <CheckCircle2 className="w-4 h-4 text-blue-500 ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500">初回・通常の見積</p>
                </button>

                {/* 追加見積 */}
                <button
                  type="button"
                  onClick={() => { setEstimateType("ADDITIONAL"); setSelectedTemplateId(null) }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    estimateType === "ADDITIONAL"
                      ? "border-amber-500 bg-amber-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench className="w-4 h-4 text-amber-500" />
                    <span className="font-medium text-sm">追加見積</span>
                    {estimateType === "ADDITIONAL" && (
                      <CheckCircle2 className="w-4 h-4 text-amber-500 ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500">工事開始後の追加・変更工事</p>
                </button>
              </div>
            </div>

            {/* テンプレート選択 */}
            <div className="space-y-2">
              <Label>テンプレート</Label>
              {/* 空の見積 */}
              <button
                type="button"
                onClick={() => setSelectedTemplateId(null)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                  selectedTemplateId === null
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${selectedTemplateId === null ? "bg-blue-500" : "bg-slate-200"}`}>
                    {selectedTemplateId === null ? <CheckCircle2 className="w-4 h-4 text-white" /> : <FileText className="w-3.5 h-3.5 text-slate-500" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-slate-900">空の見積から作成</p>
                    <p className="text-xs text-slate-500">一から明細を入力する</p>
                  </div>
                </div>
              </button>

              {/* テンプレート一覧（選択した見積種別に応じてフィルタ） */}
              {(() => {
                const filteredTemplates = templates.filter((tpl) =>
                  tpl.estimateType === "BOTH" || tpl.estimateType === estimateType
                )
                return filteredTemplates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-600 px-1">
                    テンプレートから作成（{estimateType === "INITIAL" ? "通常" : "追加"}見積用）
                  </p>
                  {filteredTemplates.map((tpl) => {
                    const isSelected = selectedTemplateId === tpl.id
                    const isPreviewing = previewTemplateId === tpl.id
                    const total = calcTotal(tpl.sections)
                    const itemCount = tpl.sections.reduce(
                      (s, sec) => s + sec.groups.reduce((gs, g) => gs + g.items.length, 0), 0
                    )
                    return (
                      <div
                        key={tpl.id}
                        className={`rounded-xl border-2 transition-all overflow-hidden ${isSelected ? "border-blue-500 shadow-sm shadow-blue-100" : "border-slate-200"}`}
                      >
                        {/* テンプレートカードヘッダー（カード全体クリックで選択） */}
                        <button
                          type="button"
                          onClick={() => setSelectedTemplateId(isSelected ? null : tpl.id)}
                          className={`w-full flex items-start gap-3 p-3 text-left ${isSelected ? "bg-blue-50" : "bg-white hover:bg-slate-50"} transition-colors`}
                        >
                          {/* 選択チェック */}
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isSelected ? "bg-blue-500" : "bg-slate-200"}`}
                          >
                            {isSelected ? <CheckCircle2 className="w-4 h-4 text-white" /> : <LayoutTemplate className="w-3.5 h-3.5 text-slate-500" />}
                          </span>

                          {/* テンプレート名・説明 */}
                          <span className="flex-1 min-w-0">
                            <span className={`block font-medium text-sm ${isSelected ? "text-blue-800" : "text-slate-800"}`}>{tpl.name}</span>
                            {tpl.description && (
                              <span className="block text-xs text-slate-500 mt-0.5">{tpl.description}</span>
                            )}
                            <span className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-slate-600">
                                {tpl.sections.length}セクション / {itemCount}項目
                              </span>
                              {total > 0 && (
                                <span className="text-xs font-mono text-slate-500">
                                  参考: ¥{formatCurrency(total)}〜
                                </span>
                              )}
                            </span>
                          </span>

                          {/* 中身を見るボタン（クリックが親のbutton bubbleに行かないよう stopPropagation） */}
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (isPreviewing) {
                                setPreviewTemplateId(null)
                              } else {
                                setPreviewTemplateId(tpl.id)
                                setSelectedTemplateId(tpl.id) // プレビューを開いたら自動で選択
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                e.stopPropagation()
                                if (isPreviewing) {
                                  setPreviewTemplateId(null)
                                } else {
                                  setPreviewTemplateId(tpl.id)
                                  setSelectedTemplateId(tpl.id)
                                }
                              }
                            }}
                            className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                              isPreviewing
                                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            <Eye className="w-3 h-3" />
                            {isPreviewing ? "閉じる" : "中身を見る"}
                            {isPreviewing ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </span>
                        </button>

                        {/* テンプレート中身プレビュー */}
                        {isPreviewing && (
                          <div className="border-t border-slate-100 bg-slate-50 px-3 py-3 space-y-3">
                            {tpl.sections.map((sec) => (
                              <div key={sec.id}>
                                {/* セクション名 */}
                                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                                  {sec.name}
                                </p>
                                {sec.groups.map((grp) => (
                                  <div key={grp.id} className="mb-2 ml-3">
                                    {/* グループ名 */}
                                    <p className="text-xs font-semibold text-slate-500 mb-1">{grp.name}</p>
                                    {/* 明細一覧 */}
                                    <div className="rounded-lg overflow-hidden border border-slate-200">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-slate-100 text-slate-500">
                                            <th className="text-left px-2 py-1 font-medium">品名</th>
                                            <th className="text-right px-2 py-1 font-medium w-16">数量</th>
                                            <th className="text-left px-2 py-1 font-medium w-12">単位</th>
                                            <th className="text-right px-2 py-1 font-medium w-24">単価</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                          {grp.items.map((item) => (
                                            <tr key={item.id}>
                                              <td className="px-2 py-1.5 text-slate-700">{item.name}</td>
                                              <td className="px-2 py-1.5 text-right text-slate-600 font-mono">
                                                {item.quantity > 0 ? item.quantity : "—"}
                                              </td>
                                              <td className="px-2 py-1.5 text-slate-500">
                                                {item.unit?.name ?? "—"}
                                              </td>
                                              <td className="px-2 py-1.5 text-right text-slate-700 font-mono">
                                                ¥{formatCurrency(item.unitPrice)}
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
                            {/* プレビュー内に「このテンプレートで作成」ボタン */}
                            <div className="pt-2 border-t border-slate-200 flex justify-end">
                              <Button
                                size="sm"
                                onClick={handleCreateEstimate}
                                disabled={creating}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                              >
                                {creating ? (
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
              )
              })()}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)} disabled={creating}>
              キャンセル
            </Button>
            <Button className="flex-1" onClick={handleCreateEstimate} disabled={creating}>
              {creating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />作成中...</>
              ) : (
                <><Plus className="w-4 h-4 mr-2" />{selectedTemplateId ? "このテンプレートで作成" : "空の見積で作成"}</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>

      {/* 右パネル：見積詳細（embedded・モバイル時は入れ子パネルなし） */}
      {!embedded && !isMobile && selectedEstimateId && estimateDetailData && (
        <div className="flex-1 min-w-0 border-l border-slate-200 bg-white shadow-sm">
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-6 pb-8">
            <EstimateDetail
              key={selectedEstimateId}
              estimate={estimateDetailData}
              taxRate={taxRate}
              units={units}
              currentUser={currentUser}
              contacts={contacts}
              embedded
              onClose={() => guardedAction(() => setSelectedEstimateId(null))}
              onNavigateEstimate={(id) => guardedAction(() => setSelectedEstimateId(id))}
              onEditingChange={setIsEstimateEditing}
              onRefresh={() => refreshData()}
            />
          </div>
        </div>
      )}

      {/* 未保存確認ダイアログ */}
      <Dialog open={unsavedDialogOpen} onOpenChange={(v) => { if (!v) cancelDiscard() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-orange-600 flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              編集中の内容があります
            </DialogTitle>
            <DialogDescription>
              保存されていない変更があります。このまま移動すると編集中の内容は失われます。
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={cancelDiscard}>
              編集に戻る
            </Button>
            <Button variant="destructive" className="flex-1" onClick={confirmDiscard}>
              保存せずに移動
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
