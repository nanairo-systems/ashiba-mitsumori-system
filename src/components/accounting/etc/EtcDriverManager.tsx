"use client"

import { useState, useEffect, useMemo } from "react"
import { Plus, User, Edit2, Check, X, Loader2, Car, Building2, Store, ArrowRight, Calendar, UserPlus } from "lucide-react"
import { toast } from "sonner"

interface Employee {
  id: string
  name: string
  departmentId: string | null
  storeId: string | null
  phone: string | null
  position: string | null
  isActive: boolean
  department: Department | null
  store: StoreItem | null
}

interface Department {
  id: string
  name: string
  company: { id: string; name: string; colorCode: string | null }
}

interface StoreItem {
  id: string
  name: string
  departmentId: string
}

interface Driver {
  id: string
  name: string
  departmentId: string | null
  storeId: string | null
  note: string | null
  isActive: boolean
  department: Department | null
  store: StoreItem | null
  cards: { id: string; cardNumber: string; vehicle: { id: string; plateNumber: string; nickname: string | null } | null }[]
}

interface Card {
  id: string
  cardNumber: string
  isActive: boolean
  vehicle: { id: string; plateNumber: string; nickname: string | null } | null
  driver: { id: string; name: string } | null
}

interface Assignment {
  id: string
  driverId: string
  cardId: string
  startDate: string
  endDate: string | null
  note: string | null
  driver: {
    id: string
    name: string
    department: Department | null
    store: StoreItem | null
  }
  card: {
    id: string
    cardNumber: string
    vehicle: { id: string; plateNumber: string; nickname: string | null } | null
  }
}

interface Props {
  initialDrivers: Driver[]
}

const emptyForm = { name: "", departmentId: "", storeId: "", note: "" }

export function EtcDriverManager({ initialDrivers }: Props) {
  const [drivers, setDrivers] = useState(initialDrivers)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  // 部門・店舗・カードデータ
  const [departments, setDepartments] = useState<Department[]>([])
  const [stores, setStores] = useState<StoreItem[]>([])
  const [cards, setCards] = useState<Card[]>([])

  // 社員マスター
  const [employees, setEmployees] = useState<Employee[]>([])
  const [showEmployeeSelect, setShowEmployeeSelect] = useState(false)
  const [employeeLoading, setEmployeeLoading] = useState(false)

  // 配車管理
  const [showAssignment, setShowAssignment] = useState(false)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [assignForm, setAssignForm] = useState({ driverId: "", cardId: "", startDate: "", note: "" })
  const [assignLoading, setAssignLoading] = useState(false)

  useEffect(() => {
    // 部門取得
    fetch("/api/accounting/departments").then((r) => r.json()).then((data) => {
      setDepartments(data.map((d: { id: string; name: string; company: { id: string; name: string; colorCode: string | null } }) => ({
        id: d.id, name: d.name, company: d.company,
      })))
    })
    // 店舗取得
    fetch("/api/accounting/stores").then((r) => r.json()).then((data) => {
      setStores(data.map((s: { id: string; name: string; departmentId: string }) => ({
        id: s.id, name: s.name, departmentId: s.departmentId,
      })))
    })
    // カード取得
    fetch("/api/accounting/etc/cards").then((r) => r.json()).then(setCards)
    // 配車履歴取得
    fetch("/api/accounting/etc/assignments").then((r) => r.json()).then(setAssignments)
    // 社員マスター取得
    fetch("/api/accounting/employees").then((r) => r.json()).then(setEmployees)
  }, [])

  // 既にEtcDriverとして登録済みでない社員リスト
  const availableEmployees = useMemo(() => {
    const driverNames = new Set(drivers.map((d) => d.name))
    return employees.filter((e) => e.isActive && !driverNames.has(e.name))
  }, [employees, drivers])

  async function handleAddFromEmployee(emp: Employee) {
    setEmployeeLoading(true)
    try {
      const res = await fetch("/api/accounting/etc/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: emp.name,
          employeeId: emp.id,
          departmentId: emp.departmentId || null,
          storeId: emp.storeId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error("登録に失敗しました"); return }
      setDrivers((prev) => [...prev, { ...data, cards: [] }])
      toast.success(`「${emp.name}」をドライバーに登録しました`)
    } finally {
      setEmployeeLoading(false)
    }
  }

  // 選択中の部門に合う店舗
  const filteredStores = useMemo(() => {
    const deptId = showForm ? form.departmentId : editForm.departmentId
    if (!deptId) return stores
    return stores.filter((s) => s.departmentId === deptId)
  }, [form.departmentId, editForm.departmentId, stores, showForm])

  async function handleAdd() {
    if (!form.name.trim()) return toast.error("名前は必須です")
    setLoading(true)
    try {
      const res = await fetch("/api/accounting/etc/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          departmentId: form.departmentId || null,
          storeId: form.storeId || null,
          note: form.note.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error("登録に失敗しました"); return }
      setDrivers((prev) => [...prev, { ...data, cards: [] }])
      setForm(emptyForm)
      setShowForm(false)
      toast.success("ドライバーを登録しました")
    } finally {
      setLoading(false)
    }
  }

  function startEdit(d: Driver) {
    setEditId(d.id)
    setEditForm({
      name: d.name,
      departmentId: d.departmentId ?? "",
      storeId: d.storeId ?? "",
      note: d.note ?? "",
    })
  }

  async function handleEdit(id: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/accounting/etc/drivers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          departmentId: editForm.departmentId || null,
          storeId: editForm.storeId || null,
          note: editForm.note.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error("更新に失敗しました"); return }
      setDrivers((prev) => prev.map((d) => d.id === id ? { ...d, ...data } : d))
      setEditId(null)
      toast.success("更新しました")
    } finally {
      setLoading(false)
    }
  }

  async function handleAssign() {
    if (!assignForm.driverId || !assignForm.cardId || !assignForm.startDate) {
      return toast.error("ドライバー・車両・開始日は必須です")
    }
    setAssignLoading(true)
    try {
      const res = await fetch("/api/accounting/etc/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assignForm),
      })
      const data = await res.json()
      if (!res.ok) { toast.error("登録に失敗しました"); return }
      setAssignments((prev) => [data, ...prev])
      setAssignForm({ driverId: "", cardId: "", startDate: "", note: "" })
      toast.success("配車を登録しました")
      // ドライバー一覧を再取得
      const driversRes = await fetch("/api/accounting/etc/drivers")
      setDrivers(await driversRes.json())
    } finally {
      setAssignLoading(false)
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
  }

  function DriverFormFields({
    values,
    onChange,
  }: {
    values: typeof emptyForm
    onChange: (v: typeof emptyForm) => void
  }) {
    const deptStores = values.departmentId ? stores.filter((s) => s.departmentId === values.departmentId) : stores
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">名前 *</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="例: 山田 太郎"
            value={values.name}
            onChange={(e) => onChange({ ...values, name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">部門</label>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={values.departmentId}
            onChange={(e) => onChange({ ...values, departmentId: e.target.value, storeId: "" })}
          >
            <option value="">未設定</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.company.name} / {d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">店舗</label>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={values.storeId}
            onChange={(e) => onChange({ ...values, storeId: e.target.value })}
          >
            <option value="">未設定</option>
            {deptStores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">備考</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={values.note}
            onChange={(e) => onChange({ ...values, note: e.target.value })}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ドライバー管理 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">ドライバー一覧</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAssignment(!showAssignment)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                showAssignment
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
              }`}
            >
              <ArrowRight className="w-4 h-4" /> 配車管理
            </button>
            <button
              onClick={() => { setShowEmployeeSelect(!showEmployeeSelect); setShowForm(false) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                showEmployeeSelect
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
              }`}
            >
              <UserPlus className="w-4 h-4" /> 社員から選択
            </button>
            <button
              onClick={() => { setShowForm(true); setEditId(null); setShowEmployeeSelect(false) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> 手動追加
            </button>
          </div>
        </div>

        {/* 社員マスターから選択 */}
        {showEmployeeSelect && (
          <div className="bg-white rounded-xl border border-purple-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              社員マスターから選択してドライバー登録
            </h3>
            {availableEmployees.length === 0 ? (
              <div className="text-center py-4 text-sm text-slate-400">
                {employees.length === 0
                  ? "社員マスターにデータがありません。マスター管理 > 社員タブで登録してください。"
                  : "全ての社員が既にドライバーとして登録されています。"}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {availableEmployees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => handleAddFromEmployee(emp)}
                    disabled={employeeLoading}
                    className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100 hover:bg-purple-100 hover:border-purple-300 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-purple-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-purple-700" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-slate-800">{emp.name}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {emp.department ? `${emp.department.company.name} / ${emp.department.name}` : "部門未設定"}
                        {emp.store ? ` / ${emp.store.name}` : ""}
                      </div>
                      {emp.position && <div className="text-xs text-slate-400">{emp.position}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 新規登録フォーム（手動） */}
        {showForm && (
          <div className="bg-white rounded-xl border border-emerald-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">新規ドライバー登録</h3>
            <DriverFormFields values={form} onChange={setForm} />
            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={loading} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} 登録
              </button>
              <button onClick={() => { setShowForm(false); setForm(emptyForm) }} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* ドライバー一覧 */}
        <div className="space-y-2">
          {drivers.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
              <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">ドライバーが登録されていません</p>
            </div>
          )}
          {drivers.map((d) => (
            <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-4">
              {editId === d.id ? (
                <div className="space-y-3">
                  <DriverFormFields values={editForm} onChange={setEditForm} />
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(d.id)} disabled={loading} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
                      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} 保存
                    </button>
                    <button onClick={() => setEditId(null)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200">
                      <X className="w-3 h-3" /> キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-purple-500" />
                    </div>
                    <div>
                      <span className="font-semibold text-sm text-slate-800">{d.name}</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {d.department && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-slate-50 text-slate-600 rounded-full border border-slate-200">
                            <Building2 className="w-2.5 h-2.5" />
                            {d.department.company.name} / {d.department.name}
                          </span>
                        )}
                        {d.store && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                            <Store className="w-2.5 h-2.5" />
                            {d.store.name}
                          </span>
                        )}
                      </div>
                      {d.cards.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {d.cards.map((c) => (
                            <span key={c.id} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                              <Car className="w-2.5 h-2.5" />
                              {c.vehicle ? (c.vehicle.nickname ?? c.vehicle.plateNumber) : `...${c.cardNumber.slice(-4)}`}
                            </span>
                          ))}
                        </div>
                      )}
                      {d.note && <p className="text-xs text-slate-400 mt-1">{d.note}</p>}
                    </div>
                  </div>
                  <button onClick={() => startEdit(d)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 配車管理セクション */}
      {showAssignment && (
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 space-y-4">
            <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> 配車登録（ドライバー移動）
            </h3>
            <p className="text-xs text-blue-600">
              ドライバーを別の車両（ETCカード）に移動させます。開始日を指定すると、前の配車は自動的にその日付で終了します。
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-slate-600 mb-1 block">ドライバー *</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  value={assignForm.driverId}
                  onChange={(e) => setAssignForm({ ...assignForm, driverId: e.target.value })}
                >
                  <option value="">選択してください</option>
                  {drivers.filter((d) => d.isActive).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}{d.department ? ` (${d.department.name})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">車両（カード） *</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  value={assignForm.cardId}
                  onChange={(e) => setAssignForm({ ...assignForm, cardId: e.target.value })}
                >
                  <option value="">選択してください</option>
                  {cards.filter((c) => c.isActive).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.vehicle ? (c.vehicle.nickname ?? c.vehicle.plateNumber) : c.cardNumber}
                      {c.driver ? ` [現: ${c.driver.name}]` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">開始日 *</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={assignForm.startDate}
                  onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">備考</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={assignForm.note}
                  onChange={(e) => setAssignForm({ ...assignForm, note: e.target.value })}
                  placeholder="部署異動など"
                />
              </div>
            </div>
            <button
              onClick={handleAssign}
              disabled={assignLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {assignLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              配車登録
            </button>
          </div>

          {/* 配車履歴一覧 */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700">配車履歴</h4>
            </div>
            {assignments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                配車履歴がありません
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">ドライバー</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">部門/店舗</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">車両</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">期間</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">備考</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-700">
                        {a.driver.name}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {a.driver.department ? `${a.driver.department.company.name} / ${a.driver.department.name}` : "—"}
                        {a.driver.store ? ` / ${a.driver.store.name}` : ""}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1 text-xs text-blue-600">
                          <Car className="w-3 h-3" />
                          {a.card.vehicle ? (a.card.vehicle.nickname ?? a.card.vehicle.plateNumber) : a.card.cardNumber}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">
                        {formatDate(a.startDate)}
                        <span className="mx-1 text-slate-400">〜</span>
                        {a.endDate ? formatDate(a.endDate) : (
                          <span className="text-emerald-600 font-medium">現在</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">{a.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
