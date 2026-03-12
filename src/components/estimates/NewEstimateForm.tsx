/**
 * [COMPONENT] 新規見積作成フォーム - NewEstimateForm
 *
 * Step 1: 会社を選択
 * Step 2: その会社の現場を選択（または新規現場をインラインで作成）
 * Step 3: テンプレートと特記事項を設定して見積作成（下書き）
 * Step 4: 確定処理 → 工程を追加するか選択
 * Step 5: 工程を個別追加（組み立て・解体など）
 */
"use client"

import { useState, useMemo } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Loader2,
  ArrowLeft,
  Building2,
  MapPin,
  Plus,
  LayoutTemplate,
  ChevronRight,
  ChevronDown,
  X,
  Eye,
  CheckCircle2,
  Zap,
  Package,
  FilePlus2,
  Wrench,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useEstimateCreate, ISSIKI_TEMPLATE_NAME } from "@/hooks/use-estimate-create"
import { SiteOpsDialog } from "@/components/site-operations/SiteOpsDialog"

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

interface TemplateItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  unit: { name: string } | null
}

interface Template {
  id: string
  name: string
  description: string | null
  estimateType: "INITIAL" | "ADDITIONAL" | "BOTH"
  sections?: {
    id: string
    name: string
    groups: {
      id: string
      name: string
      items: TemplateItem[]
    }[]
  }[]
}

interface Props {
  projects: Project[]
  templates: Template[]
  companies: Company[]
  currentUser: { id: string; name: string }
}

// ─── コンポーネント ────────────────────────────────────

export function NewEstimateForm({ projects, templates, companies, presetProjectId }: Props & { presetProjectId?: string }) {
  const router = useRouter()

  // プリセットされたプロジェクトの会社を特定
  const presetProject = presetProjectId ? projects.find((p) => p.id === presetProjectId) : null
  const presetCompany = presetProject
    ? companies.find((c) => c.name === presetProject.branch.company.name)
    : null

  // Step 管理（1~4）
  const [step, setStep] = useState<1 | 2 | 3 | 4>(presetProject ? 3 : 1)

  // Step 1: 会社選択
  const [companyId, setCompanyId] = useState(presetCompany?.id ?? "")

  // Step 2: 現場選択 or 新規作成
  const [projectId, setProjectId] = useState(presetProjectId ?? "")
  const [projectMode, setProjectMode] = useState<"select" | "new">("new")
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectAddress, setNewProjectAddress] = useState("")
  const [newProjectBranchId, setNewProjectBranchId] = useState("")
  const [newProjectContactId, setNewProjectContactId] = useState("")
  const [creatingProject, setCreatingProject] = useState(false)
  const [createdProject, setCreatedProject] = useState<Project | null>(null)

  // Step 3: テンプレート・特記事項・見積種別
  const MASTER_PICKER_ID = "__master__"
  const [templateId, setTemplateId] = useState(MASTER_PICKER_ID)
  const [previewTemplateId, setPreviewTemplateId] = useState("")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [estimateType, setEstimateType] = useState<"INITIAL" | "ADDITIONAL">("INITIAL")

  // Step 4: 工程追加
  const [createdEstimateId, setCreatedEstimateId] = useState("")
  const [isMasterPickerFlow, setIsMasterPickerFlow] = useState(false)

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
    const company = companies.find((c) => c.id === id)
    const existingCount = projects.filter(
      (p) => p.branch.company.name === company?.name
    ).length
    setCompanyId(id)
    setProjectId("")
    setCreatedProject(null)
    setNewProjectName("")
    setNewProjectAddress("")
    setNewProjectContactId("")
    // 常に「新しく作る」をデフォルト表示
    setProjectMode("new")
    setStep(2)
  }

  function handleSelectProject(id: string) {
    setProjectId(id)
    // 既存見積があれば追加見積をデフォルトに
    const proj = companyProjects.find((p) => p.id === id) ?? createdProject
    const count = proj?.estimateCount ?? 0
    setEstimateType(count > 0 ? "ADDITIONAL" : "INITIAL")
    // テンプレートが1つしかない場合は自動選択
    if (templates.length === 1) {
      setTemplateId(templates[0].id)
    }
    setStep(3)
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
      // テンプレートが1つしかない場合は自動選択
      if (templates.length === 1) {
        setTemplateId(templates[0].id)
      }
      setStep(3)
      toast.success(`現場「${data.name}」を作成しました`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "現場の作成に失敗しました")
    } finally {
      setCreatingProject(false)
    }
  }

  // ── 見積作成の共通ロジック ──
  const {
    creating: submittingEstimate,
    issikiTemplate,
    createEstimate,
    quickCreate,
  } = useEstimateCreate({
    templates,
    onCreated: async (estimateId) => {
      setCreatedEstimateId(estimateId)

      // 自動確定
      try {
        const confirmRes = await fetch(`/api/estimates/${estimateId}/confirm`, { method: "POST" })
        if (confirmRes.ok) {
          toast.success("見積を作成・確定しました")
        } else {
          toast.success("見積を作成しました（確定は後で行えます）")
        }
      } catch {
        toast.success("見積を作成しました（確定は後で行えます）")
      }
      // 全作成方法で工程管理画面へ
      setStep(4)
    },
  })

  async function handleSubmit() {
    if (!projectId) {
      toast.error("現場を選択してください")
      return
    }
    setSubmitting(true)
    const isMasterPicker = templateId === MASTER_PICKER_ID
    setIsMasterPickerFlow(isMasterPicker)
    await createEstimate({
      projectId,
      templateId: isMasterPicker ? undefined : (templateId || undefined),
      estimateType,
      note: note || undefined,
    })
    setSubmitting(false)
  }

  // ─── ステップインジケーター ────────────────────────

  const steps = [
    { num: 1, label: "会社" },
    { num: 2, label: "現場" },
    { num: 3, label: "見積作成" },
    { num: 4, label: "工程追加" },
  ]

  return (
    <div className="max-w-xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => {
          if (step > 1) {
            setStep((step - 1) as 1 | 2 | 3 | 4)
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
            会社 → 現場の順に選択してください
          </p>
        </div>
      </div>

      {/* ステップインジケーター */}
      <div className="flex items-center gap-1 mb-6">
        {steps.map(({ num, label }, idx) => (
          <div key={num} className="flex items-center gap-1">
            <button
              onClick={() => {
                if (num < step) setStep(num as 1 | 2 | 3 | 4)
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
                  setStep(2)
                }}
                className="ml-1 hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ━━ Step 1: 会社選択 ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {step === 1 && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-5 h-5 text-blue-600" />
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
          </CardContent>
        </Card>
      )}

      {/* ━━ Step 2: 現場選択 ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {step === 2 && selectedCompany && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-slate-900">現場を設定</h2>
            </div>

            {/* タブ切り替え */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
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
                <div className="space-y-2">
                  <Label className="text-xs">
                    現場名 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="例：港区倉庫新築工事"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    autoFocus
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">現場住所（任意）</Label>
                  <Input
                    placeholder="例：東京都港区芝1-1-1"
                    value={newProjectAddress}
                    onChange={(e) => setNewProjectAddress(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {/* 支店が2つ以上の場合のみ表示 */}
                {selectedCompany.branches.length > 1 && (
                  <div className="space-y-2">
                    <Label className="text-xs">支店</Label>
                    <Select
                      value={newProjectBranchId}
                      onValueChange={setNewProjectBranchId}
                    >
                      <SelectTrigger className="text-sm">
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

                {/* 担当者選択（登録されている場合のみ） */}
                {selectedCompany.contacts.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs">担当者（任意）</Label>
                    <Select
                      value={newProjectContactId || "__none__"}
                      onValueChange={(v) => setNewProjectContactId(v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="担当者を選択（任意）" />
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
          </CardContent>
        </Card>
      )}

      {/* ━━ Step 3: テンプレート選択・見積作成 ━━━━━━━━━━━━ */}
      {step === 3 && selectedProject && (
        <Card>
          <CardContent className="pt-5 space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <LayoutTemplate className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-slate-900">見積の設定</h2>
            </div>

            {/* 見積種別（通常/追加） */}
            <div className="space-y-2">
              <Label>見積の種別</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setEstimateType("INITIAL"); setTemplateId("") }}
                  className={cn(
                    "p-3 rounded-lg border-2 text-left transition-all",
                    estimateType === "INITIAL"
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  )}
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
                <button
                  type="button"
                  onClick={() => { setEstimateType("ADDITIONAL"); setTemplateId("") }}
                  className={cn(
                    "p-3 rounded-lg border-2 text-left transition-all",
                    estimateType === "ADDITIONAL"
                      ? "border-amber-500 bg-amber-50"
                      : "border-slate-200 hover:border-slate-300"
                  )}
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

            <div className="space-y-2">
              <Label>作成方法</Label>
              <div className="space-y-1.5">
                {/* 一式見積作成 */}
                {issikiTemplate && (
                  <div className={cn(
                    "rounded-lg border-2 overflow-hidden transition-all",
                    templateId === issikiTemplate.id ? "border-blue-500 shadow-sm shadow-blue-100" : "border-slate-200"
                  )}>
                    <button
                      type="button"
                      onClick={() => setTemplateId(templateId === issikiTemplate.id ? "" : issikiTemplate.id)}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
                        templateId === issikiTemplate.id ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                      )}
                    >
                      <span className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                        templateId === issikiTemplate.id ? "bg-blue-500" : "bg-slate-200"
                      )}>
                        {templateId === issikiTemplate.id
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          : <Zap className="w-3 h-3 text-slate-500" />
                        }
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={cn("block font-medium text-sm", templateId === issikiTemplate.id ? "text-blue-800" : "text-slate-700")}>
                          一式見積作成
                        </span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                          「{ISSIKI_TEMPLATE_NAME}」テンプレートで見積と工程を同時に作成
                        </span>
                      </span>
                    </button>
                  </div>
                )}

                {/* 項目マスタから作成 */}
                <button
                  onClick={() => setTemplateId(MASTER_PICKER_ID)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-lg border-2 transition-colors",
                    templateId === MASTER_PICKER_ID
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50 text-slate-600"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors",
                      templateId === MASTER_PICKER_ID ? "bg-emerald-500" : "bg-slate-200"
                    )}>
                      {templateId === MASTER_PICKER_ID
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        : <Package className="w-3 h-3 text-slate-500" />
                      }
                    </span>
                    <div>
                      <p className="font-medium text-sm">項目マスタから作成</p>
                      <p className={cn(
                        "text-xs mt-0.5",
                        templateId === MASTER_PICKER_ID ? "text-emerald-600" : "text-slate-400"
                      )}>
                        マスタから必要な項目を選んで見積を作成する
                      </p>
                    </div>
                  </div>
                </button>

                {/* その他テンプレート（一式テンプレート以外 + estimateTypeフィルタ） */}
                {templates.filter((t) => t.id !== issikiTemplate?.id && (t.estimateType === "BOTH" || t.estimateType === estimateType)).map((t) => {
                  const isSelected = templateId === t.id
                  const isPreviewing = previewTemplateId === t.id
                  const itemCount = (t.sections ?? []).reduce(
                    (s, sec) => s + sec.groups.reduce((gs, g) => gs + g.items.length, 0), 0
                  )
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "rounded-lg border-2 overflow-hidden transition-all",
                        isSelected ? "border-blue-500 shadow-sm shadow-blue-100" : "border-slate-200"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setTemplateId(isSelected ? "" : t.id)}
                        className={cn(
                          "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
                          isSelected ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                        )}
                      >
                        <span className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                          isSelected ? "bg-blue-500" : "bg-slate-200"
                        )}>
                          {isSelected
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                            : <LayoutTemplate className="w-3 h-3 text-slate-500" />
                          }
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={cn("block font-medium text-sm", isSelected ? "text-blue-800" : "text-slate-700")}>
                            {t.name}
                          </span>
                          {t.description && (
                            <span className="block text-xs text-slate-600 mt-0.5">{t.description}</span>
                          )}
                          {itemCount > 0 && (
                            <span className="block text-xs text-slate-600 mt-0.5">
                              {(t.sections ?? []).length}セクション / {itemCount}項目
                            </span>
                          )}
                        </span>
                        {t.sections && t.sections.length > 0 && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (isPreviewing) {
                                setPreviewTemplateId("")
                              } else {
                                setPreviewTemplateId(t.id)
                                setTemplateId(t.id)
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                e.stopPropagation()
                                if (isPreviewing) {
                                  setPreviewTemplateId("")
                                } else {
                                  setPreviewTemplateId(t.id)
                                  setTemplateId(t.id)
                                }
                              }
                            }}
                            className={cn(
                              "shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer",
                              isPreviewing
                                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                          >
                            <Eye className="w-3 h-3" />
                            {isPreviewing ? "閉じる" : "中身を見る"}
                            {isPreviewing ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </span>
                        )}
                      </button>
                      {isPreviewing && t.sections && (
                        <div className="border-t border-slate-100 bg-slate-50 px-3 py-3 space-y-3">
                          {t.sections.map((sec) => (
                            <div key={sec.id}>
                              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                                {sec.name}
                              </p>
                              {sec.groups.map((grp) => (
                                <div key={grp.id} className="mb-2 ml-3">
                                  <p className="text-xs font-semibold text-slate-500 mb-1">{grp.name}</p>
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
                          <div className="pt-2 border-t border-slate-200 flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleSubmit}
                              disabled={submitting}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                            >
                              {submitting ? (
                                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />作成中...</>
                              ) : (
                                <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />このテンプレートで作成</>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>特記事項（任意）</Label>
              <Textarea
                placeholder="見積書に記載する特記事項を入力"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(2)}
                className="flex-1"
              >
                戻る
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !templateId}
                className="flex-1"
              >
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                見積を作成
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ━━ Step 4: 工程管理（インライン表示） ━━ */}
      {step === 4 && (
        <>
          <SiteOpsDialog
            open={true}
            onClose={() => {
              if (createdEstimateId) {
                const url = isMasterPickerFlow
                  ? `/estimates/${createdEstimateId}?openPicker=true`
                  : `/estimates/${createdEstimateId}`
                router.push(url)
              }
            }}
            projectId={projectId}
            onUpdated={() => {}}
            mode="inline"
          />
          <div className="mt-3">
            <Button
              variant="outline"
              onClick={() => {
                if (createdEstimateId) {
                  const url = isMasterPickerFlow
                    ? `/estimates/${createdEstimateId}?openPicker=true`
                    : `/estimates/${createdEstimateId}`
                  router.push(url)
                }
              }}
              className="w-full"
            >
              見積を確認する
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
