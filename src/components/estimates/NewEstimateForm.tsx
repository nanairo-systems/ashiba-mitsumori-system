/**
 * [COMPONENT] 新規見積作成フォーム - NewEstimateForm
 *
 * Step 1: 会社選択 + 現場選択（既存 or 新規作成）
 * Step 2: 見積作成（テンプレート選択）
 * Step 3: 日程作成（SiteOpsDialog統合）
 */
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Loader2,
  ArrowLeft,
  Building2,
  MapPin,
  Plus,
  ChevronRight,
  X,
  Receipt,
  FilePlus2,
  Wrench,
  CheckCircle2,
  FileText,
  Zap,
  Package,
  LayoutTemplate,
  ChevronDown,
  Handshake,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { SiteOpsDialog } from "@/components/site-operations/SiteOpsDialog"
import { ContractProcessingDialog } from "@/components/contracts/ContractProcessingDialog"
import type { ContractEstimateItem } from "@/components/contracts/contract-types"
import { ItemPickerDialog, type PickedItem } from "@/components/estimates/ItemPickerDialog"
import { ISSIKI_TEMPLATE_NAME, type EstimateTemplate } from "@/hooks/use-estimate-create"

// ─── 型定義 ────────────────────────────────────────────

interface Branch {
  id: string
  name: string
}

interface Contact {
  id: string
  name: string
  phone: string
  email: string
}

interface Company {
  id: string
  name: string
  branches: Branch[]
  contacts: Contact[]
}

interface Project {
  id: string
  name: string
  branch: {
    name: string
    company: { name: string }
  }
  contact: { name: string } | null
  estimateCount?: number
}

interface Props {
  projects: Project[]
  templates?: unknown[]
  companies: Company[]
  currentUser: { id: string; name: string }
}

// ─── コンポーネント ────────────────────────────────────

/** 項目マスタから作成の特殊キー */
const MASTER_PICKER_ID = "__master__"

export function NewEstimateForm({ projects, companies, presetProjectId }: Props & { presetProjectId?: string }) {
  const router = useRouter()

  // プリセットされたプロジェクトの会社を特定
  const presetProject = presetProjectId ? projects.find((p) => p.id === presetProjectId) : null
  const presetCompany = presetProject
    ? companies.find((c) => c.name === presetProject.branch.company.name)
    : null

  // Step 管理（1~3）
  const [step, setStep] = useState<1 | 2 | 3>(presetProject ? 2 : 1)

  // Step 1: 会社選択
  const [companyId, setCompanyId] = useState(presetCompany?.id ?? "")

  // Step 1: 現場選択 or 新規作成
  const [projectId, setProjectId] = useState(presetProjectId ?? "")
  const [projectMode, setProjectMode] = useState<"select" | "new">("new")
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectAddress, setNewProjectAddress] = useState("")
  const [newProjectBranchId, setNewProjectBranchId] = useState("")
  const [newProjectContactId, setNewProjectContactId] = useState("")
  const [creatingProject, setCreatingProject] = useState(false)
  const [createdProject, setCreatedProject] = useState<Project | null>(null)

  // Step 2: 見積作成
  const [estimateTemplates, setEstimateTemplates] = useState<EstimateTemplate[]>([])
  const [estimateType, setEstimateType] = useState<"INITIAL" | "ADDITIONAL">("INITIAL")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [estimateTitle, setEstimateTitle] = useState(presetProject?.name ?? "")
  const [creatingEstimate, setCreatingEstimate] = useState(false)
  // 一式見積の項目編集用（itemId → { name?, unitPrice? }）
  const [issikiEdits, setIssikiEdits] = useState<Record<string, { name?: string; unitPrice?: string }>>({})
  // 金額入力モード: "subtotal"（税抜）or "total"（税込）
  const [issikiPriceMode, setIssikiPriceMode] = useState<"subtotal" | "total">("subtotal")

  // Step 3: 契約処理
  const [createdEstimateId, setCreatedEstimateId] = useState<string | null>(null)
  const [contractDialogOpen, setContractDialogOpen] = useState(false)
  const [contractItems, setContractItems] = useState<ContractEstimateItem[]>([])

  // 項目マスタピッカー
  const [masterPickerOpen, setMasterPickerOpen] = useState(false)
  const [masterPickerEstimateId, setMasterPickerEstimateId] = useState<string | null>(null)

  // テンプレート一覧を取得
  useEffect(() => {
    if (step < 2) return
    fetch("/api/templates")
      .then((r) => r.ok ? r.json() : [])
      .then((data: EstimateTemplate[]) => {
        setEstimateTemplates(data)
        // 一式テンプレートをデフォルト選択
        const issiki = data.find((t) => t.name === ISSIKI_TEMPLATE_NAME)
        if (issiki && !selectedTemplateId) {
          setSelectedTemplateId(issiki.id)
        }
      })
      .catch(() => {})
  }, [step])

  // 一式テンプレートを検出
  const issikiTemplate = estimateTemplates.find((t) => t.name === ISSIKI_TEMPLATE_NAME) ?? null

  // Step 3: 日程作成（SiteOpsDialog に統合）

  // 選択中の会社情報
  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === companyId),
    [companies, companyId]
  )

  // その会社の現場一覧（既存 + 新規作成後）
  const companyProjects = useMemo(() => {
    const existing = projects.filter((p) => {
      const match = companies.find((c) => c.id === companyId)
      if (!match) return false
      return p.branch.company.name === match.name
    })
    if (createdProject) {
      return [createdProject, ...existing]
    }
    return existing
  }, [projects, companies, companyId, createdProject])

  // 選択中の現場
  const selectedProject =
    companyProjects.find((p) => p.id === projectId) ??
    (createdProject?.id === projectId ? createdProject : null)

  // ─── ハンドラ ──────────────────────────────────────

  function handleSelectCompany(id: string) {
    setCompanyId(id)
    setProjectId("")
    setCreatedProject(null)
    setNewProjectName("")
    setNewProjectAddress("")
    setProjectMode("new")

    // 担当者が1名の場合は自動選択
    const company = companies.find((c) => c.id === id)
    if (company?.contacts.length === 1) {
      setNewProjectContactId(company.contacts[0].id)
    } else {
      setNewProjectContactId("")
    }
  }

  function handleSelectProject(id: string) {
    setProjectId(id)
    const proj = companyProjects.find((p) => p.id === id)
    if (proj) setEstimateTitle(proj.name)
    setStep(2)
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) {
      toast.error("現場名を入力してください")
      return
    }
    // 支店は選択中か、なければ最初の支店（本社）を自動使用
    const branchId = newProjectBranchId || selectedCompany?.branches[0]?.id
    if (!branchId) {
      toast.error("会社に支店が登録されていません。マスター管理で確認してください。")
      return
    }
    const contactId = newProjectContactId || undefined
    setCreatingProject(true)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim(), address: newProjectAddress.trim() || null, branchId, contactId }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg = typeof errData.error === "string" ? errData.error : `現場の作成に失敗しました (${res.status})`
        throw new Error(msg)
      }
      const data = await res.json()
      const usedContact = selectedCompany?.contacts.find((c) => c.id === contactId)
      const newProject: Project = {
        id: data.id,
        name: data.name,
        branch: {
          name: selectedCompany?.branches.find((b) => b.id === branchId)?.name ?? "",
          company: { name: selectedCompany?.name ?? "" },
        },
        contact: usedContact ? { name: usedContact.name } : null,
      }
      setCreatedProject(newProject)
      setProjectId(data.id)
      setProjectMode("select")
      setEstimateTitle(data.name)
      setStep(2)
      toast.success(`現場「${data.name}」を作成しました`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "現場の作成に失敗しました")
    } finally {
      setCreatingProject(false)
    }
  }

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
          title: estimateTitle.trim() || `${selectedProject?.name ?? ""} 1`.trim() || null,
          estimateType,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()

      // 項目マスタの場合はピッカーダイアログを開く（ページ遷移しない）
      if (isMasterPicker) {
        setMasterPickerEstimateId(data.id)
        setMasterPickerOpen(true)
        return
      }

      // 一式テンプレートでユーザーが金額を編集していた場合、PATCHで反映
      // issikiEdits のキーはテンプレートのitem.id、DB保存後は新しいIDになるため
      // テンプレートのアイテム順と保存後のアイテム順（sortOrder）でマッチングする
      const hasEdits = Object.keys(issikiEdits).length > 0
      if (hasEdits && data.sections && issikiTemplate) {
        // テンプレートのアイテムをフラット化（sortOrder順）
        const tplItems = (issikiTemplate.sections ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .flatMap((s: any) => (s.groups ?? []).flatMap((g: any) => g.items ?? []))
        // テンプレートitem.id → issikiEdits のマップを、順序ベースでDB item に適用
        const editByIndex = new Map<number, { name?: string; unitPrice?: string }>()
        tplItems.forEach((tplItem: { id: string }, idx: number) => {
          const edit = issikiEdits[tplItem.id]
          if (edit) editByIndex.set(idx, edit)
        })

        let itemIdx = 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const patchSections = data.sections.map((sec: any) => ({
          id: sec.id,
          name: sec.name,
          sortOrder: sec.sortOrder,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          groups: sec.groups.map((grp: any) => ({
            id: grp.id,
            name: grp.name,
            sortOrder: grp.sortOrder,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            items: grp.items.map((item: any) => {
              const edit = editByIndex.get(itemIdx)
              itemIdx++
              return {
                id: item.id,
                name: edit?.name ?? item.name,
                quantity: Number(item.quantity) || 1,
                unitId: item.unitId ?? item.unit?.id,
                unitPrice: edit?.unitPrice !== undefined ? Number(edit.unitPrice) || 0 : Number(item.unitPrice),
                sortOrder: item.sortOrder,
              }
            }),
          })),
        }))
        await fetch(`/api/estimates/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sections: patchSections }),
        })
      }

      toast.success(selectedTemplateId ? "テンプレートから見積を作成しました" : "見積を作成しました")

      // それ以外はStep 3（日程作成）へ進む
      setCreatedEstimateId(data.id)
      setStep(3)
    } catch {
      toast.error("見積の作成に失敗しました")
    } finally {
      setCreatingEstimate(false)
    }
  }




  // 項目マスタピッカーで項目選択後の処理
  async function handleMasterPickerConfirm(items: PickedItem[]) {
    if (!masterPickerEstimateId || items.length === 0) return
    try {
      // カテゴリ名でグループ化
      const groupMap = new Map<string, PickedItem[]>()
      for (const item of items) {
        const key = item.categoryName || "その他"
        const list = groupMap.get(key) || []
        list.push(item)
        groupMap.set(key, list)
      }

      // セクション構造を組み立て
      const sections = [{
        name: "足場工事",
        sortOrder: 1,
        groups: Array.from(groupMap.entries()).map(([name, groupItems], gi) => ({
          name,
          sortOrder: gi + 1,
          items: groupItems.map((item, ii) => ({
            name: item.name,
            quantity: 1,
            unitId: item.unitId,
            unitPrice: item.unitPrice,
            sortOrder: ii + 1,
          })),
        })),
      }]

      // 見積にPATCHで項目を保存
      const res = await fetch(`/api/estimates/${masterPickerEstimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      })
      if (!res.ok) throw new Error()

      toast.success("項目マスタから見積を作成しました")
      setCreatedEstimateId(masterPickerEstimateId)
      setStep(3)
    } catch {
      toast.error("見積の保存に失敗しました")
    } finally {
      setMasterPickerOpen(false)
      setMasterPickerEstimateId(null)
      setCreatingEstimate(false)
    }
  }

  // ─── ステップインジケーター ────────────────────────

  const steps = [
    { num: 1, label: "会社・現場" },
    { num: 2, label: "見積作成" },
    { num: 3, label: "日程作成" },
  ]

  // 選択中のテンプレート名を取得
  const selectedTemplateName = selectedTemplateId === MASTER_PICKER_ID
    ? "項目マスタから作成"
    : selectedTemplateId === issikiTemplate?.id
      ? "一式見積作成"
      : selectedTemplateId
        ? estimateTemplates.find(t => t.id === selectedTemplateId)?.name ?? "テンプレート"
        : "空の見積から作成"

  return (
    <div className={cn("transition-all duration-300", step === 2 ? "max-w-5xl" : "max-w-3xl")}>
      {/* ヘッダー */}
      <div className="relative flex items-center gap-4 mb-6">
        <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">NE-1</span>
        <Button variant="ghost" size="sm" className="ml-7" onClick={() => {
          if (step > 1) {
            setStep((step - 1) as 1 | 2 | 3)
          } else {
            router.back()
          }
        }}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          戻る
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">新規見積作成</h1>
          <p className="text-sm text-slate-500 mt-1">
            会社・現場を選択して見積を作成します
          </p>
        </div>
      </div>

      {/* ステップインジケーター */}
      <div className="relative flex items-center gap-1 mb-6">
        <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">NE-2</span>
        {steps.map(({ num, label }, idx) => (
          <div key={num} className="flex items-center gap-1">
            <button
              onClick={() => {
                if (num < step) setStep(num as 1 | 2 | 3)
              }}
              disabled={num > step}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                step === num
                  ? "bg-blue-600 text-white"
                  : num < step
                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer"
                  : "bg-slate-100 text-slate-400 cursor-default"
              )}
            >
              <span
                className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold",
                  step === num
                    ? "bg-white/30 text-white"
                    : num < step
                    ? "bg-blue-600 text-white"
                    : "bg-slate-300 text-white"
                )}
              >
                {num}
              </span>
              {label}
            </button>
            {idx < steps.length - 1 && (
              <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* 選択済みサマリー */}
      {(selectedCompany || selectedProject) && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {selectedCompany && (
            <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm">
              <Building2 className="w-3.5 h-3.5" />
              {selectedCompany.name}
              <button
                onClick={() => {
                  setCompanyId("")
                  setProjectId("")
                  setCreatedProject(null)
                  setProjectMode("new")
                  setStep(1)
                }}
                className="ml-1 hover:text-slate-900"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          {selectedProject && (
            <div className="flex items-center gap-1.5 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
              <MapPin className="w-3.5 h-3.5" />
              {selectedProject.name}
              <button
                onClick={() => {
                  setProjectId("")
                  setStep(1)
                }}
                className="ml-1 hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ━━ Step 1: 会社・現場選択 ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {step === 1 && (
        <Card className="relative">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">NE-3</span>
          <CardContent className="pt-5 space-y-5">

            {/* ① 会社選択 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-5 h-5 text-blue-600 ml-7" />
                <h2 className="font-semibold text-slate-900">会社を選択</h2>
              </div>
              <div className="space-y-2">
                <Label>会社名 <span className="text-red-500">*</span></Label>
                <Select onValueChange={handleSelectCompany} value={companyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="会社を選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {companies.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">
                  会社が登録されていません。
                  <br />
                  マスター管理から先に会社を追加してください。
                </p>
              )}
            </div>

            {/* ② 現場選択（会社選択後に表示） */}
            {selectedCompany && (
              <div>
                <div className="border-t border-slate-200 pt-4 mt-1" />
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-5 h-5 text-blue-600 ml-7" />
                  <h2 className="font-semibold text-slate-900">現場を設定</h2>
                </div>

                {/* タブ切り替え */}
                <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setProjectMode("new")
                      setNewProjectBranchId(selectedCompany.branches[0]?.id ?? "")
                    }}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium transition-colors",
                      projectMode === "new"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <Plus className="w-3.5 h-3.5 inline mr-1" />
                    新しく作る
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectMode("select")}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium transition-colors border-l border-slate-200",
                      projectMode === "select"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    既存の現場から選ぶ
                    {companyProjects.length > 0 && (
                      <span className={cn(
                        "ml-1.5 text-xs px-1.5 py-0.5 rounded-full",
                        projectMode === "select" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                      )}>
                        {companyProjects.length}件
                      </span>
                    )}
                  </button>
                </div>

                {/* 既存の現場から選ぶ */}
                {projectMode === "select" && (
                  <>
                    {companyProjects.length > 0 ? (
                      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                        {companyProjects.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleSelectProject(p.id)}
                            className={cn(
                              "w-full text-left px-4 py-3 rounded-lg border transition-colors",
                              projectId === p.id
                                ? "border-blue-500 bg-blue-50 text-blue-800"
                                : "border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-700"
                            )}
                          >
                            <p className="font-medium text-sm">{p.name}</p>
                            <p className="text-xs text-slate-600 mt-0.5">
                              {p.branch.name !== "本社" ? p.branch.name : ""}
                              {p.contact ? (p.branch.name !== "本社" ? ` · ${p.contact.name}` : p.contact.name) : ""}
                            </p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-400">
                        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm mb-3">
                          {selectedCompany.name} の現場がまだありません
                        </p>
                        <button
                          onClick={() => {
                            setProjectMode("new")
                            setNewProjectBranchId(selectedCompany.branches[0]?.id ?? "")
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-600 font-medium hover:bg-blue-100 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          新しい現場を作成する
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* 新しく作る */}
                {projectMode === "new" && (
                  <div className="space-y-3">
                    <div className={cn(
                      "space-y-2 rounded-lg p-4 border-2 transition-colors",
                      newProjectName.trim()
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-red-500 bg-red-50"
                    )}>
                      <Label className={cn("text-base font-bold", newProjectName.trim() ? "text-emerald-700" : "text-red-700")}>
                        現場名 <span className="text-red-600 text-lg font-black">*</span>
                      </Label>
                      <Input
                        placeholder="例：港区倉庫新築工事"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        autoFocus
                        className={cn(
                          "text-base",
                          newProjectName.trim() ? "border-emerald-300" : "border-red-300 bg-white"
                        )}
                      />
                    </div>

                    <div className="flex gap-2 items-stretch">
                      <div className={cn(
                        "flex-1 space-y-2 rounded-lg p-4 border-2 transition-colors",
                        newProjectAddress.trim()
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-orange-300 bg-orange-50/70"
                      )}>
                        <Label className={cn("text-base font-bold", newProjectAddress.trim() ? "text-emerald-700" : "text-slate-700")}>
                          現場住所
                        </Label>
                        <Input
                          placeholder="例：東京都港区芝1-1-1"
                          value={newProjectAddress}
                          onChange={(e) => setNewProjectAddress(e.target.value)}
                          className={cn(
                            "text-base",
                            newProjectAddress.trim() ? "border-emerald-300" : "border-orange-300 bg-white"
                          )}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => toast.info("Googleマップ連携は準備中です")}
                        className="flex flex-col items-center justify-center gap-1.5 w-24 rounded-lg border-2 border-green-300 bg-green-50 text-green-700 hover:bg-green-100 active:scale-95 transition-all shrink-0"
                      >
                        <MapPin className="w-6 h-6" />
                        <span className="text-xs font-bold leading-tight text-center">Google<br />マップ</span>
                      </button>
                    </div>

                    {/* 支店・担当者（横並び） */}
                    {(selectedCompany.branches.length > 1 || selectedCompany.contacts.length > 0) && (
                      <div className="grid grid-cols-2 gap-2">
                        {/* 支店（2つ以上の場合のみ表示） */}
                        {selectedCompany.branches.length > 1 && (
                          <div className={cn(
                            "space-y-2 rounded-lg p-4 border-2 transition-colors",
                            newProjectBranchId
                              ? "border-emerald-400 bg-emerald-50"
                              : "border-orange-300 bg-orange-50/70"
                          )}>
                            <Label className={cn("text-base font-bold", newProjectBranchId ? "text-emerald-700" : "text-slate-700")}>
                              支店
                            </Label>
                            <Select
                              value={newProjectBranchId}
                              onValueChange={setNewProjectBranchId}
                            >
                              <SelectTrigger className={cn(
                                "text-base",
                                newProjectBranchId ? "border-emerald-300" : "border-orange-300"
                              )}>
                                <SelectValue placeholder="支店を選択" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedCompany.branches.map((b) => (
                                  <SelectItem key={b.id} value={b.id}>
                                    {b.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* 担当者（登録されている場合のみ） */}
                        {selectedCompany.contacts.length > 0 && (
                          <div className={cn(
                            "space-y-2 rounded-lg p-4 border-2 transition-colors",
                            newProjectContactId
                              ? "border-emerald-400 bg-emerald-50"
                              : "border-orange-300 bg-orange-50/70"
                          )}>
                            <Label className={cn("text-base font-bold", newProjectContactId ? "text-emerald-700" : "text-slate-700")}>
                              担当者
                            </Label>
                            <Select
                              value={newProjectContactId || "__none__"}
                              onValueChange={(v) => setNewProjectContactId(v === "__none__" ? "" : v)}
                            >
                              <SelectTrigger className={cn(
                                "text-base",
                                newProjectContactId ? "border-emerald-300" : "border-orange-300"
                              )}>
                                <SelectValue placeholder="担当者を選択" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">なし</SelectItem>
                                {selectedCompany.contacts.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      onClick={handleCreateProject}
                      disabled={creatingProject || !newProjectName.trim()}
                      className="w-full"
                    >
                      {creatingProject ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      {creatingProject ? "作成中..." : "現場を作成して次へ"}
                    </Button>
                  </div>
                )}
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* ━━ Step 2: 見積作成 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {step === 2 && projectId && (
        <div className="flex gap-3 items-start">
        <Card className="relative flex-1 min-w-0">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">NE-4</span>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-5 h-5 text-blue-600 ml-7" />
              <h2 className="font-semibold text-slate-900">見積を作成</h2>
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
                  onClick={() => { setEstimateType("INITIAL"); setSelectedTemplateId(issikiTemplate?.id ?? null); }}
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
                  onClick={() => { setEstimateType("ADDITIONAL"); setSelectedTemplateId(issikiTemplate?.id ?? null); }}
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
                    onClick={() => {
                      if (selectedTemplateId === issikiTemplate.id) {
                        setSelectedTemplateId(null)
                        setIssikiEdits({})
                      } else {
                        setSelectedTemplateId(issikiTemplate.id)
                        // 全項目の金額を0にリセット（ユーザーが新規入力できるように）
                        const allItems = (issikiTemplate.sections ?? []).flatMap(sec => sec.groups.flatMap(g => g.items))
                        const resetEdits: Record<string, { unitPrice: string }> = {}
                        for (const item of allItems) {
                          resetEdits[item.id] = { unitPrice: "0" }
                        }
                        setIssikiEdits(resetEdits)
                      }
                    }}
                    className={cn(
                      "w-full text-left p-2.5 rounded-sm border-2 transition-all active:scale-[0.99]",
                      selectedTemplateId === issikiTemplate.id
                        ? "border-amber-500 bg-amber-50"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={cn("w-6 h-6 rounded-full flex items-center justify-center", selectedTemplateId === issikiTemplate.id ? "bg-amber-500" : "bg-slate-200")}>
                        {selectedTemplateId === issikiTemplate.id ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <Zap className="w-3 h-3 text-slate-500" />}
                      </span>
                      <div>
                        <p className={cn("font-bold text-sm", selectedTemplateId === issikiTemplate.id ? "text-amber-800" : "text-slate-900")}>一式見積作成</p>
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
                  <div className="space-y-1.5 mt-3">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-xs font-bold text-slate-500">
                        {estimateType === "INITIAL" ? "通常" : "追加"}見積用テンプレート
                      </p>
                      <a
                        href="/templates"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border-2 border-blue-300 bg-blue-50 text-xs font-bold text-blue-700 hover:bg-blue-100 hover:border-blue-400 active:scale-95 transition-all"
                      >
                        <LayoutTemplate className="w-3.5 h-3.5" />
                        テンプレートマスター
                      </a>
                    </div>
                    {filtered.map((tpl) => {
                      const isSelected = selectedTemplateId === tpl.id
                      const secs = tpl.sections ?? []
                      const itemCount = secs.reduce(
                        (s, sec) => s + sec.groups.reduce((gs, g) => gs + g.items.length, 0), 0
                      )
                      const tplTotal = secs.reduce((s, sec) => s + sec.groups.reduce((gs, g) => gs + g.items.reduce((is, item) => is + Number(item.unitPrice) * (item.quantity > 0 ? item.quantity : 1), 0), 0), 0)
                      const tplTax = Math.floor(tplTotal * 0.1)
                      const tplGrandTotal = tplTotal + tplTax
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => setSelectedTemplateId(isSelected ? null : tpl.id)}
                          className={cn("w-full rounded-sm border-2 overflow-hidden transition-all text-left", isSelected ? "border-blue-500 shadow-sm" : "border-slate-200")}
                        >
                          <div className={cn("flex items-start gap-2.5 p-2.5 transition-colors", isSelected ? "bg-blue-50" : "bg-white hover:bg-slate-50")}>
                            <span className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5", isSelected ? "bg-blue-500" : "bg-slate-200")}>
                              {isSelected ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <LayoutTemplate className="w-3 h-3 text-slate-500" />}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className={cn("block font-bold text-sm", isSelected ? "text-blue-800" : "text-slate-800")}>{tpl.name}</span>
                              {tpl.description && <span className="block text-xs text-slate-500 mt-0.5">{tpl.description}</span>}
                              <span className="text-xs text-slate-500 mt-0.5 block">{secs.length}セクション / {itemCount}項目</span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className={cn("block text-base font-extrabold tabular-nums", isSelected ? "text-blue-700" : "text-slate-700")}>¥{tplGrandTotal.toLocaleString()}</span>
                              <span className="block text-[10px] text-slate-400">税込</span>
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            {/* スキップボタン */}
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(3)}
              >
                スキップして日程作成へ
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 右側: 確認パネル（常に表示） */}
        <div className="w-[380px] shrink-0 sticky top-4">
          <Card className={cn(
            "border-2 transition-all duration-200",
            selectedTemplateId !== undefined
              ? "border-green-400 bg-gradient-to-b from-green-50 to-emerald-50"
              : "border-slate-200"
          )}>
            <CardContent className="pt-5 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                見積内容の確認
              </h3>

              {/* サマリー */}
              <div className="space-y-2.5 text-sm">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-slate-500 shrink-0 w-14">種別</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-bold",
                    estimateType === "INITIAL"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700"
                  )}>
                    {estimateType === "INITIAL" ? "通常見積" : "追加見積"}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-slate-500 shrink-0 w-14">方法</span>
                  <span className="font-bold text-slate-800">{selectedTemplateName}</span>
                </div>
                {estimateTitle && (
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-slate-500 shrink-0 w-14">タイトル</span>
                    <span className="text-slate-700">{estimateTitle}</span>
                  </div>
                )}
              </div>

              {/* テンプレート内容プレビュー */}
              {(() => {
                const tpl = selectedTemplateId && selectedTemplateId !== MASTER_PICKER_ID
                  ? estimateTemplates.find(t => t.id === selectedTemplateId)
                  : null
                const secs = tpl?.sections ?? []

                if (selectedTemplateId === MASTER_PICKER_ID) {
                  return (
                    <div className="rounded-md border border-emerald-200 bg-white p-3">
                      <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" />
                        項目マスタから作成
                      </p>
                      <p className="text-xs text-slate-500">作成後にマスタ一覧から必要な項目を選択できます</p>
                    </div>
                  )
                }

                if (selectedTemplateId === null) {
                  return (
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <p className="text-xs font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        空の見積
                      </p>
                      <p className="text-xs text-slate-500">空の状態から明細を手入力します</p>
                    </div>
                  )
                }

                if (secs.length === 0) return null

                const totalItems = secs.reduce((s, sec) => s + sec.groups.reduce((gs, g) => gs + g.items.length, 0), 0)
                const isIssiki = tpl?.id === issikiTemplate?.id

                if (isIssiki) {
                  // 一式見積 - 全項目の合計を計算
                  const allItems = secs.flatMap(sec => sec.groups.flatMap(g => g.items))
                  const subtotal = allItems.reduce((sum, item) => {
                    const edit = issikiEdits[item.id]
                    const price = edit?.unitPrice !== undefined ? Number(edit.unitPrice) || 0 : Number(item.unitPrice)
                    return sum + price
                  }, 0)
                  const tax = Math.floor(subtotal * 0.1)
                  const total = subtotal + tax

                  return (
                    <div className="space-y-3">
                      <p className="text-xs font-extrabold text-amber-700">一式見積の内容</p>

                      {/* 項目一覧（編集可） */}
                      <div className="space-y-2.5 max-h-[200px] overflow-y-auto">
                        {allItems.map((item) => {
                          const edit = issikiEdits[item.id] ?? {}
                          return (
                            <div key={item.id} className="rounded-lg border-2 border-amber-200 bg-white p-3 space-y-2">
                              <label className="text-[11px] font-bold text-amber-700 block">品名</label>
                              <input
                                type="text"
                                value={edit.name ?? item.name}
                                onChange={(e) => setIssikiEdits(prev => ({ ...prev, [item.id]: { ...prev[item.id], name: e.target.value } }))}
                                className="w-full px-3 py-2 text-sm font-bold border-2 border-amber-200 rounded-md bg-amber-50/50 focus:outline-none focus:border-amber-400 focus:bg-white"
                              />
                              <label className="text-[11px] font-bold text-amber-700 block">
                                {issikiPriceMode === "subtotal" ? "金額（税抜）" : "金額（税込）"}
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={(() => {
                                    const rawYen = Number(edit.unitPrice ?? item.unitPrice) || 0
                                    const yen = issikiPriceMode === "total" ? rawYen + Math.floor(rawYen * 0.1) : rawYen
                                    const sen = yen / 1000
                                    return sen === 0 ? "" : String(sen)
                                  })()}
                                  onChange={(e) => {
                                    // 先頭の0を除去（小数点の場合は残す）
                                    let val = e.target.value.replace(/[^0-9.]/g, "")
                                    val = val.replace(/^0+(?=\d)/, "")
                                    const senYen = Number(val) || 0
                                    const yen = Math.round(senYen * 1000)
                                    if (issikiPriceMode === "total") {
                                      const subtotalVal = Math.ceil(yen / 1.1)
                                      setIssikiEdits(prev => ({ ...prev, [item.id]: { ...prev[item.id], unitPrice: String(subtotalVal) } }))
                                    } else {
                                      setIssikiEdits(prev => ({ ...prev, [item.id]: { ...prev[item.id], unitPrice: String(yen) } }))
                                    }
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  placeholder="0"
                                  className={cn(
                                    "flex-1 px-3 py-2 text-lg font-extrabold text-right border-2 rounded-md tabular-nums focus:outline-none",
                                    (Number(edit.unitPrice ?? item.unitPrice) || 0) > 0
                                      ? "border-amber-200 bg-amber-50/50 focus:border-amber-400 focus:bg-white"
                                      : "border-red-400 bg-red-50/50 focus:border-red-500 focus:bg-white"
                                  )}
                                />
                                <span className="text-base font-extrabold text-amber-700 shrink-0">千円</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* 入力モード切替 */}
                      <div className="flex rounded-md border border-slate-200 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            if (issikiPriceMode === "subtotal") return
                            // 税込→税抜: 表示値を維持するため、内部unitPriceを逆算
                            // 現在の表示値 = (unitPrice + floor(unitPrice*0.1)) / 1000
                            // 新しいunitPrice = 表示値 * 1000（税抜としてそのまま保存）
                            const newEdits = { ...issikiEdits }
                            for (const item of allItems) {
                              const rawYen = Number(newEdits[item.id]?.unitPrice ?? item.unitPrice) || 0
                              const displayYen = rawYen + Math.floor(rawYen * 0.1)
                              newEdits[item.id] = { ...newEdits[item.id], unitPrice: String(displayYen) }
                            }
                            setIssikiEdits(newEdits)
                            setIssikiPriceMode("subtotal")
                          }}
                          className={cn(
                            "flex-1 py-1.5 text-xs font-bold transition-colors",
                            issikiPriceMode === "subtotal" ? "bg-amber-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                          )}
                        >
                          税抜で入力
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (issikiPriceMode === "total") return
                            // 税抜→税込: 表示値を維持するため、内部unitPriceを逆算
                            // 現在の表示値 = unitPrice / 1000
                            // 新しい表示値(税込) = (newUP + floor(newUP*0.1)) / 1000 = 同じ
                            // → newUP = ceil(unitPrice / 1.1)
                            const newEdits = { ...issikiEdits }
                            for (const item of allItems) {
                              const rawYen = Number(newEdits[item.id]?.unitPrice ?? item.unitPrice) || 0
                              const newUP = Math.ceil(rawYen / 1.1)
                              newEdits[item.id] = { ...newEdits[item.id], unitPrice: String(newUP) }
                            }
                            setIssikiEdits(newEdits)
                            setIssikiPriceMode("total")
                          }}
                          className={cn(
                            "flex-1 py-1.5 text-xs font-bold transition-colors border-l border-slate-200",
                            issikiPriceMode === "total" ? "bg-amber-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                          )}
                        >
                          税込で入力
                        </button>
                      </div>

                      {/* 合計エリア */}
                      <div className={cn(
                        "rounded-lg border-2 p-3 space-y-1.5",
                        subtotal > 0 ? "border-slate-200 bg-slate-50" : "border-red-300 bg-red-50"
                      )}>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500 font-bold">小計（税抜）</span>
                          <span className="font-bold tabular-nums">¥{subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500 font-bold">消費税（10%）</span>
                          <span className="font-bold tabular-nums">¥{tax.toLocaleString()}</span>
                        </div>
                        <div className="border-t border-slate-300 pt-1.5 flex justify-between">
                          <span className="text-base font-extrabold text-slate-800">合計（税込）</span>
                          <span className={cn("text-base font-extrabold tabular-nums", subtotal > 0 ? "text-amber-700" : "text-red-500")}>¥{total.toLocaleString()}</span>
                        </div>
                        {subtotal === 0 && (
                          <p className="text-xs font-bold text-red-500 pt-1">金額を入力してください</p>
                        )}
                      </div>
                    </div>
                  )
                }

                return (
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-600">
                      テンプレート内容（{secs.length}セクション / {totalItems}項目）
                    </p>
                    <div className="max-h-[320px] overflow-y-auto rounded-md border border-slate-200 bg-white">
                      {secs.map((sec) => (
                        <div key={sec.id} className="border-b border-slate-100 last:border-b-0">
                          <p className="text-xs font-bold text-slate-700 px-2.5 py-1.5 bg-slate-50 flex items-center gap-1 sticky top-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                            {sec.name}
                          </p>
                          {sec.groups.map((grp) => (
                            <div key={grp.id} className="px-2.5 py-1">
                              <p className="text-[10px] font-medium text-slate-400 mb-0.5">{grp.name}</p>
                              <table className="w-full text-[11px]">
                                <tbody className="divide-y divide-slate-50">
                                  {grp.items.map((item) => (
                                    <tr key={item.id}>
                                      <td className="py-0.5 text-slate-700">{item.name}</td>
                                      <td className="py-0.5 text-right text-slate-500 tabular-nums w-10">{item.quantity > 0 ? item.quantity : "—"}</td>
                                      <td className="py-0.5 text-slate-400 w-8 text-center">{item.unit?.name ?? ""}</td>
                                      <td className="py-0.5 text-right text-slate-600 tabular-nums w-16">¥{Number(item.unitPrice).toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              <div className="border-t border-green-200 pt-3" />

              {/* 確定ボタン */}
              {(() => {
                // 一式見積の場合、金額未入力なら無効化
                const isIssikiSelected = selectedTemplateId === issikiTemplate?.id
                const issikiHasZero = isIssikiSelected && (() => {
                  const tpl = estimateTemplates.find(t => t.id === selectedTemplateId)
                  const allItems = (tpl?.sections ?? []).flatMap(sec => sec.groups.flatMap(g => g.items))
                  return allItems.every(item => {
                    const price = Number(issikiEdits[item.id]?.unitPrice ?? item.unitPrice) || 0
                    return price === 0
                  })
                })()
                const isDisabled = creatingEstimate || !!issikiHasZero
                return (<>
              <button
                onClick={handleCreateEstimate}
                disabled={isDisabled}
                className="w-full py-3 rounded-lg text-base font-extrabold bg-green-500 text-white hover:bg-green-600 active:scale-[0.98] transition-all shadow-lg shadow-green-200 disabled:opacity-50"
              >
                {creatingEstimate ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin inline" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 mr-2 inline" />
                )}
                {creatingEstimate ? "作成中..." : "この内容で作成"}
              </button>

              <p className="text-xs text-slate-400 text-center">
                左の作成方法を選んでこのボタンで確定
              </p>
                </>)
              })()}
            </CardContent>
          </Card>
        </div>
        </div>
      )}

      {/* ━━ Step 3: 日程作成（SiteOpsDialog内に統合） ━━ */}
      {step === 3 && projectId && (
        <div className="relative">
          <SiteOpsDialog
            open={true}
            onClose={() => setStep(2)}
            projectId={projectId}
            projectName={selectedProject?.name}
            onUpdated={() => {}}
            mode="inline"
            defaultScheduleView="list"
            actionSlot={
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!createdEstimateId) { toast.error("見積情報が見つかりません"); return }
                    try {
                      const res = await fetch(`/api/estimates/${createdEstimateId}`)
                      if (!res.ok) throw new Error()
                      const data = await res.json()
                      const est = data.estimate
                      const apiTaxRate = data.taxRate ?? 0.1
                      // セクション→グループ→アイテムから税抜小計を計算
                      let subtotal = 0
                      for (const sec of est.sections) {
                        for (const grp of sec.groups) {
                          for (const item of grp.items) {
                            subtotal += item.quantity * item.unitPrice
                          }
                        }
                      }
                      const discount = est.discountAmount ?? 0
                      const taxExcludedAmount = subtotal - discount
                      const company = companies.find(c => c.id === companyId)
                      setContractItems([{
                        estimateId: est.id,
                        estimateName: est.title || est.estimateNumber || "見積",
                        estimateNumber: est.estimateNumber,
                        projectId,
                        projectName: selectedProject?.name ?? "",
                        companyName: company?.name ?? "",
                        taxExcludedAmount,
                        taxRate: apiTaxRate,
                      }])
                      setContractDialogOpen(true)
                    } catch {
                      toast.error("見積情報の取得に失敗しました")
                    }
                  }}
                  className="px-5 py-2.5 rounded-lg text-sm font-extrabold bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.97] transition-all shadow-md shadow-amber-200 flex items-center gap-2"
                >
                  <Handshake className="w-4.5 h-4.5" />
                  契約処理へ進む
                </button>
                <button
                  onClick={() => router.push(`/projects/${projectId}`)}
                  className="px-4 py-2.5 rounded-lg text-sm font-bold border-2 border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-400 active:scale-[0.97] transition-all"
                >
                  現場詳細を開く
                </button>
              </div>
            }
          />

          {/* 契約処理ダイアログ */}
          <ContractProcessingDialog
            open={contractDialogOpen}
            onOpenChange={setContractDialogOpen}
            items={contractItems}
            mode="individual"
            onCompleted={() => {
              setContractDialogOpen(false)
              router.push(`/projects/${projectId}`)
            }}
          />
        </div>
      )}

      {/* 項目マスタピッカーダイアログ */}
      <ItemPickerDialog
        open={masterPickerOpen}
        onOpenChange={(open) => {
          setMasterPickerOpen(open)
          if (!open) setCreatingEstimate(false)
        }}
        onConfirm={handleMasterPickerConfirm}
      />

    </div>
  )
}
