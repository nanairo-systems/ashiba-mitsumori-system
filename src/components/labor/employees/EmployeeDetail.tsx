/**
 * [COMPONENT] 労務・人事システム - 社員詳細（5タブUI）
 */
"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  User, Briefcase, DollarSign, Shield, Clock,
  ArrowLeft, Pencil, Eye, EyeOff, Loader2, X,
  Check, AlertCircle,
} from "lucide-react"
import { formatDate } from "@/lib/utils"

// ────────────────────────── 型定義 ──────────────────────────
interface Department {
  id: string
  name: string
  company?: { id: string; name: string; colorCode?: string }
}
interface Store { id: string; name: string }

interface Employee {
  id: string
  name: string
  nameKana: string | null
  gender: string | null
  birthDate: string | null
  address: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
  myNumber: string | null
  phone: string | null
  email: string | null
  note: string | null
  isActive: boolean
  // 雇用情報
  employeeNumber: string | null
  hireDate: string | null
  employmentType: string
  position: string | null
  departmentId: string | null
  storeId: string | null
  contractStart: string | null
  contractEnd: string | null
  department: Department | null
  store: Store | null
  // 給与・税務
  baseSalary: number | null
  bankName: string | null
  bankBranch: string | null
  bankAccountType: string | null
  bankAccountNumber: string | null
  hasDependents: boolean
  dependentCount: number
  // 社会保険
  healthInsuranceNumber: string | null
  pensionNumber: string | null
  employmentInsuranceNumber: string | null
  workersCompCategory: string | null
  // 勤務条件
  scheduledWorkHours: number | null
  contractSignDate: string | null
  paidLeaveRemaining: number
}

// ────────────────────────── 定数 ──────────────────────────
const EMPLOYMENT_TYPES: Record<string, string> = {
  FULL_TIME: "正社員",
  PART_TIME: "パート",
  CONTRACT: "契約社員",
  DISPATCH: "派遣",
  OTHER: "その他",
}

const GENDER_OPTIONS = [
  { value: "MALE", label: "男性" },
  { value: "FEMALE", label: "女性" },
  { value: "OTHER", label: "その他" },
]

const BANK_ACCOUNT_TYPES = [
  { value: "ORDINARY", label: "普通" },
  { value: "CURRENT", label: "当座" },
]

const WORKERS_COMP_CATEGORIES = [
  { value: "GENERAL", label: "一般" },
  { value: "CONSTRUCTION", label: "建設" },
  { value: "SPECIAL", label: "特別加入" },
]

// ────────────────────────── 小コンポーネント ──────────────────────────
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-3 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-400 font-medium w-36 shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-slate-700">{value ?? <span className="text-slate-300">—</span>}</span>
    </div>
  )
}

function SectionCard({ title, children, onEdit }: {
  title: string
  children: React.ReactNode
  onEdit?: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        {onEdit && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            編集
          </button>
        )}
      </div>
      <div className="px-5">{children}</div>
    </div>
  )
}

// ────────────────────────── 編集ダイアログ ──────────────────────────
function EditDialog({
  title,
  open,
  onClose,
  onSave,
  saving,
  children,
}: {
  title: string
  open: boolean
  onClose: () => void
  onSave: () => void
  saving: boolean
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">{children}</div>
        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = "w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
const selectCls = `${inputCls} bg-white`

// ────────────────────────── メインコンポーネント ──────────────────────────
export function EmployeeDetail({ id }: { id: string }) {
  const router = useRouter()
  const [emp, setEmp] = useState<Employee | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [myNumberVisible, setMyNumberVisible] = useState(false)
  const [bankNumberVisible, setBankNumberVisible] = useState(false)

  // 編集ダイアログ状態
  const [editSection, setEditSection] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<Partial<Employee>>({})

  // データ取得
  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [empRes, deptRes, storeRes] = await Promise.all([
        fetch(`/api/labor/employees/${id}`),
        fetch("/api/accounting/departments"),
        fetch("/api/accounting/stores"),
      ])
      if (!empRes.ok) throw new Error("社員データの取得に失敗しました")
      const [empData, deptData, storeData] = await Promise.all([
        empRes.json(),
        deptRes.json(),
        storeRes.json(),
      ])
      setEmp(empData)
      setDepartments(deptData)
      setStores(storeData)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // 編集開始
  function startEdit(section: string) {
    if (!emp) return
    setFormData({ ...emp })
    setEditSection(section)
  }

  // 保存
  async function saveEdit() {
    if (!emp) return
    setSaving(true)
    try {
      const res = await fetch(`/api/labor/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error("保存に失敗しました")
      const updated = await res.json()
      setEmp(updated)
      setEditSection(null)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  function setField<K extends keyof Employee>(key: K, value: Employee[K]) {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  // ────────── ローディング・エラー ──────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
        <span className="ml-2 text-sm text-slate-500">読み込み中...</span>
      </div>
    )
  }

  if (error || !emp) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-600">{error ?? "社員が見つかりません"}</p>
        <button onClick={() => router.back()} className="mt-3 text-sm text-violet-600 hover:underline">
          ← 一覧に戻る
        </button>
      </div>
    )
  }

  // ────────── タブ定義 ──────────
  const tabs = [
    { label: "基本情報", icon: <User className="w-4 h-4" /> },
    { label: "雇用情報", icon: <Briefcase className="w-4 h-4" /> },
    { label: "給与・税務", icon: <DollarSign className="w-4 h-4" /> },
    { label: "社会保険", icon: <Shield className="w-4 h-4" /> },
    { label: "勤務条件", icon: <Clock className="w-4 h-4" /> },
  ]

  // ────────── ヘルパー ──────────
  const maskMyNumber = (n: string) => n.replace(/(\d{4})(\d{4})(\d{4})/, "****-****-$3")
  const maskBankNumber = (n: string) => n.replace(/./g, "*").slice(0, -3) + n.slice(-3)

  // ────────── UI ──────────
  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push("/labor/employees")}
          className="mt-1 p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-800">{emp.name}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  emp.isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}>
                  {emp.isActive ? "在籍中" : "退職"}
                </span>
              </div>
              {emp.nameKana && (
                <p className="text-sm text-slate-400 mt-0.5">{emp.nameKana}</p>
              )}
              <div className="flex items-center gap-4 mt-1 flex-wrap">
                {emp.employeeNumber && (
                  <span className="text-xs text-slate-500">社員番号: {emp.employeeNumber}</span>
                )}
                {emp.position && (
                  <span className="text-xs text-slate-500">{emp.position}</span>
                )}
                {emp.department && (
                  <span className="text-xs text-slate-500">
                    {emp.department.company?.name} / {emp.department.name}
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full">
                  {EMPLOYMENT_TYPES[emp.employmentType] ?? emp.employmentType}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`flex items-center gap-1.5 flex-1 justify-center px-2 py-2 text-xs font-medium rounded-lg transition-all ${
              activeTab === i
                ? "bg-white text-violet-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      <div className="space-y-4">
        {/* ── Tab 0: 基本情報 ── */}
        {activeTab === 0 && (
          <div className="space-y-4">
            <SectionCard title="氏名・連絡先" onEdit={() => startEdit("basic")}>
              <InfoRow label="氏名" value={emp.name} />
              <InfoRow label="フリガナ" value={emp.nameKana} />
              <InfoRow label="性別" value={
                emp.gender ? (GENDER_OPTIONS.find(g => g.value === emp.gender)?.label ?? emp.gender) : null
              } />
              <InfoRow label="生年月日" value={emp.birthDate ? formatDate(emp.birthDate) : null} />
              <InfoRow label="電話番号" value={emp.phone ? (
                <a href={`tel:${emp.phone}`} className="text-violet-600 hover:underline">{emp.phone}</a>
              ) : null} />
              <InfoRow label="メールアドレス" value={emp.email ? (
                <a href={`mailto:${emp.email}`} className="text-violet-600 hover:underline">{emp.email}</a>
              ) : null} />
            </SectionCard>

            <SectionCard title="住所・緊急連絡先" onEdit={() => startEdit("address")}>
              <InfoRow label="住所" value={emp.address} />
              <InfoRow label="緊急連絡先" value={emp.emergencyContact} />
              <InfoRow label="緊急連絡先電話" value={emp.emergencyPhone ? (
                <a href={`tel:${emp.emergencyPhone}`} className="text-violet-600 hover:underline">{emp.emergencyPhone}</a>
              ) : null} />
            </SectionCard>

            <SectionCard title="マイナンバー" onEdit={() => startEdit("mynumber")}>
              <div className="py-3 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-medium">マイナンバー</span>
                  <div className="mt-1 text-sm text-slate-700 font-mono">
                    {emp.myNumber
                      ? (myNumberVisible ? emp.myNumber : maskMyNumber(emp.myNumber.padEnd(12, "0")))
                      : <span className="text-slate-300">未登録</span>
                    }
                  </div>
                </div>
                {emp.myNumber && (
                  <button
                    onClick={() => setMyNumberVisible(v => !v)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                  >
                    {myNumberVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </SectionCard>

            {emp.note && (
              <SectionCard title="備考" onEdit={() => startEdit("note")}>
                <InfoRow label="備考" value={emp.note} />
              </SectionCard>
            )}
          </div>
        )}

        {/* ── Tab 1: 雇用情報 ── */}
        {activeTab === 1 && (
          <div className="space-y-4">
            <SectionCard title="雇用情報" onEdit={() => startEdit("employment")}>
              <InfoRow label="社員番号" value={emp.employeeNumber} />
              <InfoRow label="入社日" value={emp.hireDate ? formatDate(emp.hireDate) : null} />
              <InfoRow label="雇用形態" value={
                emp.employmentType ? (EMPLOYMENT_TYPES[emp.employmentType] ?? emp.employmentType) : null
              } />
              <InfoRow label="役職" value={emp.position} />
              <InfoRow label="部門" value={
                emp.department
                  ? `${emp.department.company?.name ?? ""} / ${emp.department.name}`
                  : null
              } />
              <InfoRow label="店舗" value={emp.store?.name} />
            </SectionCard>

            <SectionCard title="雇用契約期間" onEdit={() => startEdit("contract")}>
              <InfoRow label="契約開始日" value={emp.contractStart ? formatDate(emp.contractStart) : null} />
              <InfoRow label="契約終了日" value={emp.contractEnd ? formatDate(emp.contractEnd) : null} />
            </SectionCard>
          </div>
        )}

        {/* ── Tab 2: 給与・税務 ── */}
        {activeTab === 2 && (
          <div className="space-y-4">
            <SectionCard title="給与情報" onEdit={() => startEdit("salary")}>
              <InfoRow label="基本給" value={
                emp.baseSalary != null
                  ? `¥${emp.baseSalary.toLocaleString()}`
                  : null
              } />
            </SectionCard>

            <SectionCard title="銀行口座情報" onEdit={() => startEdit("bank")}>
              <InfoRow label="銀行名" value={emp.bankName} />
              <InfoRow label="支店名" value={emp.bankBranch} />
              <InfoRow label="口座種別" value={
                emp.bankAccountType
                  ? (BANK_ACCOUNT_TYPES.find(t => t.value === emp.bankAccountType)?.label ?? emp.bankAccountType)
                  : null
              } />
              <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-3 border-b border-slate-100 last:border-0">
                <span className="text-xs text-slate-400 font-medium w-36 shrink-0 mt-0.5">口座番号</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-700 font-mono">
                    {emp.bankAccountNumber
                      ? (bankNumberVisible ? emp.bankAccountNumber : maskBankNumber(emp.bankAccountNumber))
                      : <span className="text-slate-300">—</span>
                    }
                  </span>
                  {emp.bankAccountNumber && (
                    <button
                      onClick={() => setBankNumberVisible(v => !v)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                    >
                      {bankNumberVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="扶養家族" onEdit={() => startEdit("dependents")}>
              <InfoRow label="扶養家族あり" value={emp.hasDependents ? "あり" : "なし"} />
              <InfoRow label="扶養人数" value={`${emp.dependentCount}人`} />
            </SectionCard>
          </div>
        )}

        {/* ── Tab 3: 社会保険 ── */}
        {activeTab === 3 && (
          <div className="space-y-4">
            <SectionCard title="社会保険番号" onEdit={() => startEdit("insurance")}>
              <InfoRow label="健康保険番号" value={emp.healthInsuranceNumber} />
              <InfoRow label="厚生年金番号" value={emp.pensionNumber} />
              <InfoRow label="雇用保険番号" value={emp.employmentInsuranceNumber} />
            </SectionCard>

            <SectionCard title="労災" onEdit={() => startEdit("workersComp")}>
              <InfoRow label="労災適用区分" value={
                emp.workersCompCategory
                  ? (WORKERS_COMP_CATEGORIES.find(c => c.value === emp.workersCompCategory)?.label ?? emp.workersCompCategory)
                  : null
              } />
            </SectionCard>
          </div>
        )}

        {/* ── Tab 4: 勤務条件 ── */}
        {activeTab === 4 && (
          <div className="space-y-4">
            <SectionCard title="勤務条件" onEdit={() => startEdit("workConditions")}>
              <InfoRow label="所定労働時間" value={
                emp.scheduledWorkHours != null ? `${emp.scheduledWorkHours}時間/日` : null
              } />
              <InfoRow label="労働契約書締結日" value={emp.contractSignDate ? formatDate(emp.contractSignDate) : null} />
              <InfoRow label="有給残日数" value={`${emp.paidLeaveRemaining}日`} />
            </SectionCard>
          </div>
        )}
      </div>

      {/* ──────────────── 編集ダイアログ群 ──────────────── */}

      {/* 基本情報 編集 */}
      <EditDialog
        title="基本情報を編集"
        open={editSection === "basic"}
        onClose={() => setEditSection(null)}
        onSave={saveEdit}
        saving={saving}
      >
        <FormField label="氏名" required>
          <input className={inputCls} value={formData.name ?? ""} onChange={e => setField("name", e.target.value)} />
        </FormField>
        <FormField label="フリガナ">
          <input className={inputCls} value={formData.nameKana ?? ""} onChange={e => setField("nameKana", e.target.value || null)} />
        </FormField>
        <FormField label="性別">
          <select className={selectCls} value={formData.gender ?? ""} onChange={e => setField("gender", e.target.value || null)}>
            <option value="">選択してください</option>
            {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </FormField>
        <FormField label="生年月日">
          <input type="date" className={inputCls} value={formData.birthDate ?? ""} onChange={e => setField("birthDate", e.target.value || null)} />
        </FormField>
        <FormField label="電話番号">
          <input className={inputCls} value={formData.phone ?? ""} onChange={e => setField("phone", e.target.value || null)} />
        </FormField>
        <FormField label="メールアドレス">
          <input type="email" className={inputCls} value={formData.email ?? ""} onChange={e => setField("email", e.target.value || null)} />
        </FormField>
      </EditDialog>

      {/* 住所・緊急連絡先 編集 */}
      <EditDialog
        title="住所・緊急連絡先を編集"
        open={editSection === "address"}
        onClose={() => setEditSection(null)}
        onSave={saveEdit}
        saving={saving}
      >
        <FormField label="住所">
          <textarea className={inputCls} rows={2} value={formData.address ?? ""} onChange={e => setField("address", e.target.value || null)} />
        </FormField>
        <FormField label="緊急連絡先（氏名・続柄）">
          <input className={inputCls} value={formData.emergencyContact ?? ""} onChange={e => setField("emergencyContact", e.target.value || null)} />
        </FormField>
        <FormField label="緊急連絡先電話">
          <input className={inputCls} value={formData.emergencyPhone ?? ""} onChange={e => setField("emergencyPhone", e.target.value || null)} />
        </FormField>
      </EditDialog>

      {/* マイナンバー 編集 */}
      <EditDialog
        title="マイナンバーを編集"
        open={editSection === "mynumber"}
        onClose={() => setEditSection(null)}
        onSave={saveEdit}
        saving={saving}
      >
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          マイナンバーは厳重に管理してください。入力情報は暗号化して保存されます。
        </div>
        <FormField label="マイナンバー（12桁）">
          <input
            className={inputCls}
            maxLength={12}
            value={formData.myNumber ?? ""}
            onChange={e => setField("myNumber", e.target.value || null)}
            placeholder="123456789012"
          />
        </FormField>
      </EditDialog>

      {/* 備考 編集 */}
      <EditDialog
        title="備考を編集"
        open={editSection === "note"}
        onClose={() => setEditSection(null)}
        onSave={saveEdit}
        saving={saving}
      >
        <FormField label="備考">
          <textarea className={inputCls} rows={4} value={formData.note ?? ""} onChange={e => setField("note", e.target.value || null)} />
        </FormField>
      </EditDialog>

      {/* 雇用情報 編集 */}
      <EditDialog
        title="雇用情報を編集"
        open={editSection === "employment"}
        onClose={() => setEditSection(null)}
        onSave={saveEdit}
        saving={saving}
      >
        <FormField label="社員番号">
          <input className={inputCls} value={formData.employeeNumber ?? ""} onChange={e => setField("employeeNumber", e.target.value || null)} />
        </FormField>
        <FormField label="入社日">
          <input type="date" className={inputCls} value={formData.hireDate ?? ""} onChange={e => setField("hireDate", e.target.value || null)} />
        </FormField>
        <FormField label="雇用形態">
          <select className={selectCls} value={formData.employmentType ?? "FULL_TIME"} onChange={e => setField("employmentType", e.target.value)}>
            {Object.entries(EMPLOYMENT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </FormField>
        <FormField label="役職">
          <input className={inputCls} value={formData.position ?? ""} onChange={e => setField("position", e.target.value || null)} />
        </FormField>
        <FormField label="部門">
          <select
            className={selectCls}
            value={formData.departmentId ?? ""}
            onChange={e => setField("departmentId", e.target.value || null)}
          >
            <option value="">選択なし</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>
                {d.company?.name ? `${d.company.name} / ` : ""}{d.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="店舗">
          <select
            className={selectCls}
            value={formData.storeId ?? ""}
            onChange={e => setField("storeId", e.target.value || null)}
          >
            <option value="">選択なし</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </FormField>
        <FormField label="在籍ステータス">
          <select
            className={selectCls}
            value={formData.isActive ? "true" : "false"}
            onChange={e => setField("isActive", e.target.value === "true")}
          >
            <option value="true">在籍中</option>
            <option value="false">退職</option>
          </select>
        </FormField>
      </EditDialog>

      {/* 雇用契約期間 編集 */}
      <EditDialog
        title="雇用契約期間を編集"
        open={editSection === "contract"}
        onClose={() => setEditSection(null)}
        onSave={saveEdit}
        saving={saving}
      >
        <FormField label="契約開始日">
          <input type="date" className={inputCls} value={formData.contractStart ?? ""} onChange={e => setField("contractStart", e.target.value || null)} />
        </FormField>
        <FormField label="契約終了日">
          <input type="date" className={inputCls} value={formData.contractEnd ?? ""} onChange={e => setField("contractEnd", e.target.value || null)} />
        </FormField>
      </EditDialog>

      {/* 給与情報 編集 */}
      <EditDialog
        title="給与情報を編集"
        open={editSection === "salary"}
        onClose={() => setEditSection(null)}
        onSave={saveEdit}
        saving={saving}
      >
        <FormField label="基本給（円）">
          <input
            type="number"
            className={inputCls}
            value={formData.baseSalary ?? ""}
            onChange={e => setField("baseSalary", e.target.value ? Number(e.target.value) : null)}
          />
        </FormField>
      </EditDialog>

      {/* 銀行口座 編集 */}
      <EditDialog
        title="銀行口座情報を編集"
        open={editSection === "bank"}
        onClose={() => setEditSection(null)}
        onSave={saveEdit}
        saving={saving}
      >
        <FormField label="銀行名">
          <input className={inputCls} value={formData.bankName ?? ""} onChange={e => setField("bankName", e.target.value || null)} />
        </FormField>
        <FormField label="支店名">
          <input className={inputCls} value={formData.bankBranch ?? ""} onChange={e => setField("bankBranch", e.target.value || null)} />
        </FormField>
        <FormField label="口座種別">
          <select className={selectCls} value={formData.bankAccountType ?? ""} onChange={e => setField("bankAccountType", e.target.value || null)}>
            <option value="">選択してください</option>
            {BANK_ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </FormField>
        <FormField label="口座番号">
          <input className={inputCls} value={formData.bankAccountNumber ?? ""} onChange={e => setField("bankAccountNumber", e.target.value || null)} />
        </FormField>
      </EditDialog>

      {/* 扶養家族 編集 */}
      <EditDialog
        title="扶養家族を編集"
        open={editSection === "dependents"}
        onClose={() => setEditSection(null)}
        onSave={saveEdit}
        saving={saving}
      >
        <FormField label="扶養家族">
          <select
            className={selectCls}
            value={formData.hasDependents ? "true" : "false"}
            onChange={e => setField("hasDependents", e.target.value === "true")}
          >
            <option value="false">なし</option>
            <option value="true">あり</option>
          </select>
        </FormField>
        {formData.hasDependents && (
          <FormField label="扶養人数">
            <input
              type="number"
              min={0}
              className={inputCls}
              value={formData.dependentCount ?? 0}
              onChange={e => setField("dependentCount", Number(e.target.value))}
            />
          </FormField>
        )}
      </EditDialog>

      {/* 社会保険番号 編集 */}
      <EditDialog
        title="社会保険番号を編集"
        open={editSection === "insurance"}
        onClose={() => setEditSection(null)}
        onSave={saveEdit}
        saving={saving}
      >
        <FormField label="健康保険番号">
          <input className={inputCls} value={formData.healthInsuranceNumber ?? ""} onChange={e => setField("healthInsuranceNumber", e.target.value || null)} />
        </FormField>
        <FormField label="厚生年金番号">
          <input className={inputCls} value={formData.pensionNumber ?? ""} onChange={e => setField("pensionNumber", e.target.value || null)} />
        </FormField>
        <FormField label="雇用保険番号">
          <input className={inputCls} value={formData.employmentInsuranceNumber ?? ""} onChange={e => setField("employmentInsuranceNumber", e.target.value || null)} />
        </FormField>
      </EditDialog>

      {/* 労災 編集 */}
      <EditDialog
        title="労災適用区分を編集"
        open={editSection === "workersComp"}
        onClose={() => setEditSection(null)}
        onSave={saveEdit}
        saving={saving}
      >
        <FormField label="労災適用区分">
          <select className={selectCls} value={formData.workersCompCategory ?? ""} onChange={e => setField("workersCompCategory", e.target.value || null)}>
            <option value="">選択してください</option>
            {WORKERS_COMP_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </FormField>
      </EditDialog>

      {/* 勤務条件 編集 */}
      <EditDialog
        title="勤務条件を編集"
        open={editSection === "workConditions"}
        onClose={() => setEditSection(null)}
        onSave={saveEdit}
        saving={saving}
      >
        <FormField label="所定労働時間（時間/日）">
          <input
            type="number"
            step="0.5"
            min={0}
            max={24}
            className={inputCls}
            value={formData.scheduledWorkHours ?? ""}
            onChange={e => setField("scheduledWorkHours", e.target.value ? Number(e.target.value) : null)}
          />
        </FormField>
        <FormField label="労働契約書締結日">
          <input type="date" className={inputCls} value={formData.contractSignDate ?? ""} onChange={e => setField("contractSignDate", e.target.value || null)} />
        </FormField>
        <FormField label="有給残日数">
          <input
            type="number"
            step="0.5"
            min={0}
            className={inputCls}
            value={formData.paidLeaveRemaining ?? 0}
            onChange={e => setField("paidLeaveRemaining", Number(e.target.value))}
          />
        </FormField>
      </EditDialog>
    </div>
  )
}
