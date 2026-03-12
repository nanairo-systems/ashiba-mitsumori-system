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
import {
  Loader2,
  ArrowLeft,
  Building2,
  MapPin,
  Plus,
  ChevronRight,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
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

interface Props {
  projects: Project[]
  templates?: unknown[]
  companies: Company[]
  currentUser: { id: string; name: string }
}

// ─── コンポーネント ────────────────────────────────────

export function NewEstimateForm({ projects, companies, presetProjectId }: Props & { presetProjectId?: string }) {
  const router = useRouter()

  // プリセットされたプロジェクトの会社を特定
  const presetProject = presetProjectId ? projects.find((p) => p.id === presetProjectId) : null
  const presetCompany = presetProject
    ? companies.find((c) => c.name === presetProject.branch.company.name)
    : null

  // Step 管理（1~3）
  const [step, setStep] = useState<1 | 2 | 3>(presetProject ? 3 : 1)

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

  // Step 3: 工程追加 + 見積作成（SiteOpsDialog に統合）

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
      setStep(3)
      toast.success(`現場「${data.name}」を作成しました`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "現場の作成に失敗しました")
    } finally {
      setCreatingProject(false)
    }
  }


  // ─── ステップインジケーター ────────────────────────

  const steps = [
    { num: 1, label: "会社" },
    { num: 2, label: "現場" },
    { num: 3, label: "工程・見積" },
  ]

  return (
    <div className="max-w-3xl">
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
            会社 → 現場の順に選択してください
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
        <Card className="relative">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">NE-3</span>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
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
          </CardContent>
        </Card>
      )}

      {/* ━━ Step 2: 現場選択 ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {step === 2 && selectedCompany && (
        <Card className="relative">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">NE-4</span>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-5 h-5 text-blue-600 ml-7" />
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

      {/* ━━ Step 3: 工程追加 + 見積作成（SiteOpsDialog内に統合） ━━ */}
      {step === 3 && projectId && (
        <div className="relative">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">NE-5</span>
          <SiteOpsDialog
            open={true}
            onClose={() => setStep(2)}
            projectId={projectId}
            projectName={selectedProject?.name}
            onUpdated={() => {}}
            mode="inline"
          />
        </div>
      )}

    </div>
  )
}
