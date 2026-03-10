"use client"

import { useState } from "react"
import { Plus, Car, Edit2, Check, X, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Vehicle {
  id: string
  plateNumber: string
  nickname: string | null
  vehicleType: string | null
  note: string | null
  isActive: boolean
  cards: { id: string; cardNumber: string; driver: { id: string; name: string } | null }[]
}

interface Props {
  initialVehicles: Vehicle[]
}

const emptyForm = { plateNumber: "", nickname: "", vehicleType: "", note: "" }

export function EtcVehicleManager({ initialVehicles }: Props) {
  const [vehicles, setVehicles] = useState(initialVehicles)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    if (!form.plateNumber.trim()) return toast.error("登録番号は必須です")
    setLoading(true)
    try {
      const res = await fetch("/api/accounting/etc/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plateNumber: form.plateNumber.trim(),
          nickname: form.nickname.trim() || undefined,
          vehicleType: form.vehicleType.trim() || undefined,
          note: form.note.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error("登録に失敗しました"); return }
      setVehicles((prev) => [...prev, { ...data, cards: [] }])
      setForm(emptyForm)
      setShowForm(false)
      toast.success("車両を登録しました")
    } finally {
      setLoading(false)
    }
  }

  function startEdit(v: Vehicle) {
    setEditId(v.id)
    setEditForm({ plateNumber: v.plateNumber, nickname: v.nickname ?? "", vehicleType: v.vehicleType ?? "", note: v.note ?? "" })
  }

  async function handleEdit(id: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/accounting/etc/vehicles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plateNumber: editForm.plateNumber.trim(),
          nickname: editForm.nickname.trim() || undefined,
          vehicleType: editForm.vehicleType.trim() || undefined,
          note: editForm.note.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error("更新に失敗しました"); return }
      setVehicles((prev) => prev.map((v) => v.id === id ? { ...v, ...data } : v))
      setEditId(null)
      toast.success("更新しました")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">車両一覧</h2>
        <button
          onClick={() => { setShowForm(true); setEditId(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> 車両追加
        </button>
      </div>

      {/* 追加フォーム */}
      {showForm && (
        <div className="bg-white rounded-xl border border-emerald-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">新規車両登録</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">登録番号 *</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="例: 名古屋401て575"
                value={form.plateNumber}
                onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">愛称・車名</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="例: ハイエース1号"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">車種</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="例: トヨタ ハイエース"
                value={form.vehicleType}
                onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
              />
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
            <button
              onClick={handleAdd}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              登録
            </button>
            <button onClick={() => { setShowForm(false); setForm(emptyForm) }} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 車両リスト */}
      <div className="space-y-2">
        {vehicles.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            <Car className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">車両が登録されていません</p>
          </div>
        )}
        {vehicles.map((v) => (
          <div key={v.id} className="bg-white rounded-xl border border-slate-200 p-4">
            {editId === v.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">登録番号</label>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      value={editForm.plateNumber}
                      onChange={(e) => setEditForm({ ...editForm, plateNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">愛称</label>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      value={editForm.nickname}
                      onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">車種</label>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      value={editForm.vehicleType}
                      onChange={(e) => setEditForm({ ...editForm, vehicleType: e.target.value })}
                    />
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
                  <button onClick={() => handleEdit(v.id)} disabled={loading} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
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
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Car className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-800">{v.plateNumber}</span>
                      {v.nickname && <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{v.nickname}</span>}
                    </div>
                    {v.vehicleType && <p className="text-xs text-slate-500 mt-0.5">{v.vehicleType}</p>}
                    {v.cards.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {v.cards.map((c) => (
                          <span key={c.id} className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                            {c.cardNumber.slice(-4).padStart(c.cardNumber.length, "*").slice(-8)}
                            {c.driver && ` (${c.driver.name})`}
                          </span>
                        ))}
                      </div>
                    )}
                    {v.note && <p className="text-xs text-slate-400 mt-1">{v.note}</p>}
                  </div>
                </div>
                <button onClick={() => startEdit(v)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
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
