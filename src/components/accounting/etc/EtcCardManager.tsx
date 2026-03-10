"use client"

import { useState } from "react"
import { Plus, CreditCard, Edit2, Check, X, Loader2, Car, User } from "lucide-react"
import { toast } from "sonner"

interface Vehicle {
  id: string
  plateNumber: string
  nickname: string | null
}

interface Driver {
  id: string
  name: string
}

interface Card {
  id: string
  cardNumber: string
  note: string | null
  isActive: boolean
  vehicle: Vehicle | null
  driver: Driver | null
}

interface Props {
  initialCards: Card[]
  vehicles: Vehicle[]
  drivers: Driver[]
}

const emptyForm = { cardNumber: "", vehicleId: "", driverId: "", note: "" }

export function EtcCardManager({ initialCards, vehicles, drivers }: Props) {
  const [cards, setCards] = useState(initialCards)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    if (!form.cardNumber.trim()) return toast.error("カード番号は必須です")
    setLoading(true)
    try {
      const res = await fetch("/api/accounting/etc/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardNumber: form.cardNumber.trim(),
          vehicleId: form.vehicleId || null,
          driverId: form.driverId || null,
          note: form.note.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.fieldErrors?.cardNumber?.[0] ?? "登録に失敗しました"); return }
      const vehicle = vehicles.find((v) => v.id === form.vehicleId) ?? null
      const driver = drivers.find((d) => d.id === form.driverId) ?? null
      setCards((prev) => [...prev, { ...data, vehicle, driver }])
      setForm(emptyForm)
      setShowForm(false)
      toast.success("カードを登録しました")
    } finally {
      setLoading(false)
    }
  }

  function startEdit(c: Card) {
    setEditId(c.id)
    setEditForm({ cardNumber: c.cardNumber, vehicleId: c.vehicle?.id ?? "", driverId: c.driver?.id ?? "", note: c.note ?? "" })
  }

  async function handleEdit(id: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/accounting/etc/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: editForm.vehicleId || null,
          driverId: editForm.driverId || null,
          note: editForm.note.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error("更新に失敗しました"); return }
      const vehicle = vehicles.find((v) => v.id === editForm.vehicleId) ?? null
      const driver = drivers.find((d) => d.id === editForm.driverId) ?? null
      setCards((prev) => prev.map((c) => c.id === id ? { ...c, ...data, vehicle, driver } : c))
      setEditId(null)
      toast.success("更新しました")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">ETCカード一覧</h2>
        <button
          onClick={() => { setShowForm(true); setEditId(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> カード追加
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-emerald-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">新規カード登録</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="text-xs text-slate-500 mb-1 block">カード番号 *</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="8020000093050000000"
                value={form.cardNumber}
                onChange={(e) => setForm({ ...form, cardNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">紐づけ車両</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                value={form.vehicleId}
                onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
              >
                <option value="">未設定</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.nickname ?? v.plateNumber}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">紐づけドライバー</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                value={form.driverId}
                onChange={(e) => setForm({ ...form, driverId: e.target.value })}
              >
                <option value="">未設定</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">備考</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
          </div>
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

      <div className="space-y-2">
        {cards.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">カードが登録されていません</p>
          </div>
        )}
        {cards.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4">
            {editId === c.id ? (
              <div className="space-y-3">
                <p className="text-sm font-mono text-slate-600">{c.cardNumber}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">紐づけ車両</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      value={editForm.vehicleId}
                      onChange={(e) => setEditForm({ ...editForm, vehicleId: e.target.value })}
                    >
                      <option value="">未設定</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>{v.nickname ?? v.plateNumber}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">紐づけドライバー</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      value={editForm.driverId}
                      onChange={(e) => setEditForm({ ...editForm, driverId: e.target.value })}
                    >
                      <option value="">未設定</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">備考</label>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      value={editForm.note}
                      onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(c.id)} disabled={loading} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
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
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-mono text-sm text-slate-700 font-medium">
                      {c.cardNumber.replace(/(.{4})/g, "$1 ").trim()}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {c.vehicle && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                          <Car className="w-2.5 h-2.5" />
                          {c.vehicle.nickname ?? c.vehicle.plateNumber}
                        </span>
                      )}
                      {c.driver && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-100">
                          <User className="w-2.5 h-2.5" />
                          {c.driver.name}
                        </span>
                      )}
                      {!c.vehicle && !c.driver && (
                        <span className="text-xs text-slate-400">未設定</span>
                      )}
                    </div>
                    {c.note && <p className="text-xs text-slate-400 mt-1">{c.note}</p>}
                  </div>
                </div>
                <button onClick={() => startEdit(c)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
