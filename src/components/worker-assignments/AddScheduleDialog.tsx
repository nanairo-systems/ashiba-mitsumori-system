/**
 * [COMPONENT] 人員配置 - 現場（工程）新規追加ダイアログ
 *
 * Step形式で進む:
 *   Step 1: 会社・現場の選択（または新規作成）
 *   Step 2: 工程情報の入力（工事名・日程・金額）
 *   Step 3: 班のアサイン（任意）
 *
 * 完了時に Contract + ConstructionSchedule + WorkerAssignment を一括作成。
 */
"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ResponsiveDialog } from "./ResponsiveDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  Building2,
  MapPin,
  Plus,
  ChevronRight,
  ClipboardList,
  Users,
  Search,
  CheckCircle2,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import type { TeamData } from "./types"

// ─── 型定義 ───

interface Branch {
  id: string
  name: string
}

interface Contact {
  id: string
  name: string
}

interface CompanyData {
  id: string
  name: string
  branches: Branch[]
  contacts: Contact[]
}

interface ProjectData {
  id: string
  name: string
  address: string | null
  branch: {
    id: string
    name: string
    company: { id: string; name: string }
  }
}

interface Props {
  open: boolean
  onClose: () => void
  onComplete: () => void
  teams: TeamData[]
  /** 人員配置画面で選択されていた日付（Step2の初期値） */
  initialDate?: Date | null
  /** 人員配置画面で選択されていた班ID（Step3の初期値） */
  initialTeamId?: string | null
}

type Step = 1 | 2 | 3

// ─── コンポーネント ───

export function AddScheduleDialog({
  open,
  onClose,
  onComplete,
  teams,
  initialDate,
  initialTeamId,
}: Props) {
  const [step, setStep] = useState<Step>(1)

  // Step 1: 会社・現場
  const [companies, setCompanies] = useState<CompanyData[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [companySearch, setCompanySearch] = useState("")
  const [companyId, setCompanyId] = useState("")
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [projectId, setProjectId] = useState("")
  // 新規現場作成
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectAddress, setNewProjectAddress] = useState("")
  const [creatingProject, setCreatingProject] = useState(false)

  // Step 2: 工程情報
  const [workType, setWorkType] = useState("")
  const [scheduleName, setScheduleName] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [contractAmount, setContractAmount] = useState("")

  // Step 3: 班アサイン
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set())

  // 送信中
  const [submitting, setSubmitting] = useState(false)

  // ── 初期化 ──
  useEffect(() => {
    if (open) {
      setStep(1)
      setCompanyId("")
      setProjectId("")
      setProjects([])
      setShowNewProject(false)
      setNewProjectName("")
      setNewProjectAddress("")
      setCompanySearch("")
      setWorkType("")
      setScheduleName("")
      setContractAmount("")

      // 初期日付のセット
      if (initialDate) {
        setStartDate(format(initialDate, "yyyy-MM-dd"))
        setEndDate(format(initialDate, "yyyy-MM-dd"))
      } else {
        const today = format(new Date(), "yyyy-MM-dd")
        setStartDate(today)
        setEndDate(today)
      }

      // 初期班のセット
      if (initialTeamId) {
        setSelectedTeamIds(new Set([initialTeamId]))
      } else {
        setSelectedTeamIds(new Set())
      }

      fetchCompanies()
    }
  }, [open, initialDate, initialTeamId])

  // ── データ取得 ──
  const fetchCompanies = useCallback(async () => {
    setLoadingCompanies(true)
    try {
      const res = await fetch("/api/companies")
      if (!res.ok) throw new Error()
      setCompanies(await res.json())
    } catch {
      toast.error("会社データの取得に失敗しました")
    } finally {
      setLoadingCompanies(false)
    }
  }, [])

  const fetchProjects = useCallback(async (cId: string) => {
    setLoadingProjects(true)
    try {
      const res = await fetch("/api/projects")
      if (!res.ok) throw new Error()
      const all: ProjectData[] = await res.json()
      setProjects(all.filter((p) => p.branch.company.id === cId))
    } catch {
      toast.error("現場データの取得に失敗しました")
    } finally {
      setLoadingProjects(false)
    }
  }, [])

  // ── 会社検索 ──
  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companies
    const q = companySearch.trim().toLowerCase()
    return companies.filter((c) => c.name.toLowerCase().includes(q))
  }, [companies, companySearch])

  // 選択中の会社・現場
  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === companyId) ?? null,
    [companies, companyId]
  )
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId]
  )

  // 税込金額の計算
  const taxIncludedAmount = useMemo(() => {
    const amount = Number(contractAmount)
    if (!contractAmount || isNaN(amount)) return null
    return Math.floor(amount * 1.1)
  }, [contractAmount])

  // ── ハンドラ ──

  function handleSelectCompany(id: string) {
    setCompanyId(id)
    setProjectId("")
    setShowNewProject(false)
    fetchProjects(id)
  }

  function handleSelectProject(id: string) {
    setProjectId(id)
    setStep(2)
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) {
      toast.error("現場名を入力してください")
      return
    }
    if (!selectedCompany) return
    const branchId = selectedCompany.branches[0]?.id
    if (!branchId) {
      toast.error("会社に支店が登録されていません")
      return
    }

    setCreatingProject(true)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          name: newProjectName.trim(),
          address: newProjectAddress.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(typeof err.error === "string" ? err.error : "作成に失敗しました")
      }
      const data = await res.json()
      toast.success(`現場「${data.name}」を作成しました`)
      setProjectId(data.id)
      setShowNewProject(false)
      // プロジェクト一覧を再取得
      await fetchProjects(companyId)
      setProjectId(data.id)
      setStep(2)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "現場の作成に失敗しました")
    } finally {
      setCreatingProject(false)
    }
  }

  function handleGoToStep3() {
    if (!workType.trim()) {
      toast.error("工事名を入力してください")
      return
    }
    if (!startDate) {
      toast.error("組み立て日を入力してください")
      return
    }
    if (!endDate) {
      toast.error("解体日を入力してください")
      return
    }
    if (startDate > endDate) {
      toast.error("解体日は組み立て日以降にしてください")
      return
    }
    setStep(3)
  }

  function toggleTeam(teamId: string) {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const amount = contractAmount ? Number(contractAmount) : null

      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          workType: workType.trim(),
          name: scheduleName.trim() || null,
          plannedStartDate: startDate,
          plannedEndDate: endDate,
          contractAmount: amount && !isNaN(amount) ? amount : null,
          teamIds: selectedTeamIds.size > 0 ? Array.from(selectedTeamIds) : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(typeof err.error === "string" ? err.error : "追加に失敗しました")
      }
      toast.success("現場を追加しました")
      onComplete()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "現場の追加に失敗しました")
    } finally {
      setSubmitting(false)
    }
  }

  // ── ステップ定義 ──
  const steps = [
    { num: 1, label: "会社・現場", icon: Building2 },
    { num: 2, label: "工程情報", icon: ClipboardList },
    { num: 3, label: "班アサイン", icon: Users },
  ]

  const activeTeams = teams.filter((t) => t.isActive)

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="現場（工程）を追加"
      className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
    >

        {/* ステップインジケーター */}
        <div className="flex items-center gap-1 mb-4">
          {steps.map(({ num, label, icon: Icon }, idx) => (
            <div key={num} className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (num < step) setStep(num as Step)
                }}
                disabled={num > step}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  step === num
                    ? "bg-blue-600 text-white"
                    : num < step
                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer"
                    : "bg-slate-100 text-slate-500 cursor-default"
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
                  {num < step ? <CheckCircle2 className="w-3 h-3" /> : num}
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
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {selectedCompany && (
              <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs">
                <Building2 className="w-3 h-3" />
                {selectedCompany.name}
              </div>
            )}
            {selectedProject && (
              <div className="flex items-center gap-1.5 bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-xs">
                <MapPin className="w-3 h-3" />
                {selectedProject.name}
              </div>
            )}
          </div>
        )}

        {/* ━━ Step 1: 会社・現場選択 ━━ */}
        {step === 1 && (
          <div className="space-y-4">
            {/* 会社選択 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-600" />
                会社を選択
              </Label>
              {/* 検索付きセレクト */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="会社名で検索..."
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
              </div>
              {loadingCompanies ? (
                <div className="flex items-center gap-2 py-4 justify-center text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">読み込み中...</span>
                </div>
              ) : (
                <div className="max-h-[180px] overflow-y-auto border rounded-lg divide-y divide-slate-100">
                  {filteredCompanies.length === 0 ? (
                    <div className="text-sm text-slate-600 py-4 text-center">
                      {companySearch ? "該当する会社がありません" : "会社が登録されていません"}
                    </div>
                  ) : (
                    filteredCompanies.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectCompany(c.id)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 transition-colors text-sm",
                          companyId === c.id
                            ? "bg-blue-50 border-l-2 border-l-blue-500"
                            : "hover:bg-slate-50 border-l-2 border-l-transparent"
                        )}
                      >
                        <span className="font-medium text-slate-800">{c.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* 現場選択（会社選択後） */}
            {companyId && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  現場を選択
                </Label>
                {loadingProjects ? (
                  <div className="flex items-center gap-2 py-4 justify-center text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">読み込み中...</span>
                  </div>
                ) : (
                  <>
                    {projects.length > 0 && (
                      <div className="max-h-[180px] overflow-y-auto border rounded-lg divide-y divide-slate-100">
                        {projects.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleSelectProject(p.id)}
                            className={cn(
                              "w-full text-left px-3 py-2.5 transition-colors",
                              projectId === p.id
                                ? "bg-blue-50 border-l-2 border-l-blue-500"
                                : "hover:bg-slate-50 border-l-2 border-l-transparent"
                            )}
                          >
                            <div className="text-sm font-medium text-slate-800">
                              {p.name}
                              {p.address && (
                                <span className="text-slate-600 font-normal ml-1.5">
                                  ({p.address})
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 新しい現場を作成 */}
                    {!showNewProject ? (
                      <button
                        onClick={() => setShowNewProject(true)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        新しい現場を作成
                      </button>
                    ) : (
                      <div className="border rounded-lg p-3 space-y-3 bg-slate-50">
                        <p className="text-xs font-semibold text-slate-600">新しい現場を作成</p>
                        <div className="space-y-2">
                          <Input
                            placeholder="現場名（必須）"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            autoFocus
                            className="text-sm bg-white"
                          />
                          <Input
                            placeholder="住所（任意）"
                            value={newProjectAddress}
                            onChange={(e) => setNewProjectAddress(e.target.value)}
                            className="text-sm bg-white"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowNewProject(false)}
                            className="flex-1"
                          >
                            キャンセル
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleCreateProject}
                            disabled={creatingProject || !newProjectName.trim()}
                            className="flex-1"
                          >
                            {creatingProject ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Plus className="w-4 h-4 mr-1" />
                            )}
                            作成して次へ
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ━━ Step 2: 工程情報入力 ━━ */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                工事名 <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="例：足場仮設工事"
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
                autoFocus
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>作業内容（任意）</Label>
              <Input
                placeholder="例：外壁塗装用足場"
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  組み立て日 <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  解体日 <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>契約金額・税抜（任意）</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">¥</span>
                <Input
                  type="number"
                  placeholder="0"
                  value={contractAmount}
                  onChange={(e) => setContractAmount(e.target.value)}
                  className="text-sm pl-7"
                  min={0}
                />
              </div>
              {taxIncludedAmount !== null && (
                <p className="text-xs text-slate-500">
                  税込金額: <span className="font-medium">¥{taxIncludedAmount.toLocaleString()}</span>
                  <span className="text-slate-600 ml-1">（税率10%）</span>
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                戻る
              </Button>
              <Button onClick={handleGoToStep3} className="flex-1">
                次へ
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ━━ Step 3: 班アサイン ━━ */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              この工程に班をアサインしますか？
            </p>

            {activeTeams.length > 0 ? (
              <div className="max-h-[280px] overflow-y-auto border rounded-lg divide-y divide-slate-100">
                {activeTeams.map((team) => {
                  const isChecked = selectedTeamIds.has(team.id)
                  return (
                    <label
                      key={team.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors",
                        isChecked ? "bg-blue-50" : "hover:bg-slate-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleTeam(team.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                      />
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: team.colorCode ?? "#94a3b8" }}
                      />
                      <span className="text-sm font-medium text-slate-800">
                        {team.name}
                      </span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <div className="text-sm text-slate-600 text-center py-6">
                アクティブな班がありません
              </div>
            )}

            {selectedTeamIds.size > 0 && (
              <p className="text-xs text-blue-600 font-medium">
                {selectedTeamIds.size}班を選択中
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="flex-1"
              >
                戻る
              </Button>
              <Button
                variant="outline"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1"
              >
                {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                スキップして完了
              </Button>
              {selectedTeamIds.size > 0 && (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1"
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  アサインして完了
                </Button>
              )}
            </div>
          </div>
        )}
    </ResponsiveDialog>
  )
}
