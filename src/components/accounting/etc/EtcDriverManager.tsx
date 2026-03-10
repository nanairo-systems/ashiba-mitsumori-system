"use client"

import { useState } from "react"
import { Plus, User, Edit2, Check, X, Loader2, Car } from "lucide-react"
import { toast } from "sonner"

interface Driver {
  id: string
  name: string
  note: string | null
  isActive: boolean
  cards: { id: string; cardNumber: string; vehicle: { id: string; plateNumber: string; nickname: string | null } | null }[]
}

interface Props {
  initialDrivers: Driver[]
}

const emptyForm = { name: "", note: "" }

export function EtcDriverManager({ initialDrivers }: Props) {
  const [drivers, setDrivers] = useState(initialDrivers)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    if (!form.name.trim()) return toast.error("名前は必須です")
    setLoading(true)
    try {
      const res = await fetch("/api/accounting/etc/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), note: form.note.trim() || undefined }),
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
    setEditForm({ name: d.name, note: d.note ?? "" })
  }

  async function handleEdit(id: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/accounting/etc/drivers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editForm.name.trim(), note: editForm.note.trim() || undefined }),
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">ドライバー一覧</h2>
        <button
          onClick={() => { setShowForm(true); setEditId(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> ドライバー追加
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-emerald-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">新規ドライバー登録</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">名前 *</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="例: 山田 太郎"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">名前</label>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
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
  )
}
