/**
 * [COMPONENT] 新規見積作成フォーム - NewEstimateForm
 *
 * Step 1: 会社を選択
 * Step 2: その会社の現場を選択（または新規現場をインラインで作成）
 * Step 3: テンプレートと特記事項を設定して送信
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
  X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// ─── 型定義 ────────────────────────────────────────────

interface Branch {
  id: string
  name: string
}

interface Company {
  id: string
  name: string
  branches: Branch[]
}

interface Project {
  id: string
  name: string
  branch: {
    name: string
    company: { name: string }
  }
  contact: { name: string } | null
}

interface Template {
  id: string
  name: string
  description: string | null
}

interface Props {
  projects: Project[]
  templates: Template[]
  companies: Company[]
  currentUser: { id: string; name: string }
}

// ─── コンポーネント ────────────────────────────────────

export function NewEstimateForm({ projects, templates, companies }: Props) {
  const router = useRouter()

  // Step 管理
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1: 会社選択
  const [companyId, setCompanyId] = useState("")

  // Step 2: 現場選択 or 新規作成
  const [projectId, setProjectId] = useState("")
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectBranchId, setNewProjectBranchId] = useState("")
  const [creatingProject, setCreatingProject] = useState(false)
  const [createdProject, setCreatedProject] = useState<Project | null>(null)

  // Step 3: テンプレート・特記事項
  const [templateId, setTemplateId] = useState("")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

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
    setShowNewProject(false)
    setStep(2)
  }

  function handleSelectProject(id: string) {
    setProjectId(id)
    setShowNewProject(false)
    setStep(3)
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) {
      toast.error("現場名を入力してください")
      return
    }
    const branchId = newProjectBranchId || selectedCompany?.branches[0]?.id
    if (!branchId) {
      toast.error("支店を選択してください")
      return
    }
    setCreatingProject(true)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim(), branchId }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const newProject: Project = {
        id: data.id,
        name: data.name,
        branch: {
          name: selectedCompany?.branches.find((b) => b.id === branchId)?.name ?? "",
          company: { name: selectedCompany?.name ?? "" },
        },
        contact: null,
      }
      setCreatedProject(newProject)
      setProjectId(data.id)
      setShowNewProject(false)
      setStep(3)
      toast.success(`現場「${data.name}」を作成しました`)
    } catch {
      toast.error("現場の作成に失敗しました")
    } finally {
      setCreatingProject(false)
    }
  }

  async function handleSubmit() {
    if (!projectId) {
      toast.error("現場を選択してください")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          templateId: templateId || undefined,
          note: note || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success("見積を作成しました")
      router.push(`/estimates/${data.id}`)
    } catch {
      toast.error("見積の作成に失敗しました")
    } finally {
      setSubmitting(false)
    }
  }

  // ─── ステップインジケーター ────────────────────────

  const steps = [
    { num: 1, label: "会社を選ぶ" },
    { num: 2, label: "現場を選ぶ" },
    { num: 3, label: "見積設定" },
  ]

  return (
    <div className="max-w-xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
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
                  "w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold",
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
              <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
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
              <h2 className="font-semibold text-slate-900">現場を選択</h2>
            </div>

            {companyProjects.length > 0 ? (
              <div className="space-y-2">
                <Label>
                  現場 <span className="text-red-500">*</span>
                </Label>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
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
                      <p className="text-xs text-slate-400 mt-0.5">
                        {p.branch.name}
                        {p.contact ? ` · ${p.contact.name}` : ""}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">
                  {selectedCompany.name} の現場がまだありません
                </p>
              </div>
            )}

            {/* 新規現場作成 */}
            {!showNewProject ? (
              <button
                onClick={() => {
                  setShowNewProject(true)
                  setNewProjectBranchId(selectedCompany.branches[0]?.id ?? "")
                }}
                className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                新規現場を作成する
              </button>
            ) : (
              <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-blue-800 flex items-center gap-1.5">
                    <Plus className="w-4 h-4" />
                    新規現場を作成
                  </p>
                  <button
                    onClick={() => setShowNewProject(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">
                    現場名 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="例：港区倉庫新築工事"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="bg-white text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleCreateProject()
                      }
                    }}
                  />
                </div>

                {selectedCompany.branches.length > 1 && (
                  <div className="space-y-2">
                    <Label className="text-xs">支店</Label>
                    <Select
                      value={newProjectBranchId}
                      onValueChange={setNewProjectBranchId}
                    >
                      <SelectTrigger className="bg-white text-sm">
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

                <Button
                  onClick={handleCreateProject}
                  disabled={creatingProject || !newProjectName.trim()}
                  size="sm"
                  className="w-full"
                >
                  {creatingProject ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  {creatingProject ? "作成中..." : "現場を作成して選択"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ━━ Step 3: テンプレート・特記事項 ━━━━━━━━━━━━ */}
      {step === 3 && selectedProject && (
        <Card>
          <CardContent className="pt-5 space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <LayoutTemplate className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-slate-900">見積の設定</h2>
            </div>

            <div className="space-y-2">
              <Label>テンプレート（任意）</Label>
              {templates.length > 0 ? (
                <div className="space-y-1.5">
                  {/* 空白から作成 */}
                  <button
                    onClick={() => setTemplateId("")}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg border transition-colors",
                      templateId === ""
                        ? "border-blue-500 bg-blue-50 text-blue-800"
                        : "border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <p className="font-medium text-sm">空の見積から作成</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      ゼロから明細を入力する
                    </p>
                  </button>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTemplateId(t.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-lg border transition-colors",
                        templateId === t.id
                          ? "border-blue-500 bg-blue-50 text-blue-800"
                          : "border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-700"
                      )}
                    >
                      <p className="font-medium text-sm">{t.name}</p>
                      {t.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          {t.description}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 px-1">
                  テンプレートが登録されていません（空の見積から作成します）
                </p>
              )}
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
                disabled={submitting}
                className="flex-1"
              >
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                見積を作成する
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
