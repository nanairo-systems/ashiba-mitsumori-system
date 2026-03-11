/**
 * [現操-03] 現場情報セクション（編集可能）
 *
 * 現場名・作業種別・元請会社・契約情報・住所（Google Maps連携）を表示。
 * 工程名・メモ・住所・予定日をインライン編集可能。
 * 工程の削除もここから行える。
 */
"use client"

import { useState } from "react"
import { MapPin, ExternalLink, FileText, Pencil, Check, X, Loader2, User, Phone, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { ScheduleData } from "@/components/worker-assignments/types"

const WORK_TYPE_LABELS: Record<string, { label: string; className: string }> = {
  ASSEMBLY: { label: "組立", className: "bg-blue-100 text-blue-700" },
  DISASSEMBLY: { label: "解体", className: "bg-orange-100 text-orange-700" },
  REWORK: { label: "その他", className: "bg-slate-100 text-slate-600" },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "―"
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

function toInputDate(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (isNaN(num)) return "―"
  return `¥${num.toLocaleString()}`
}

interface Props {
  schedule: ScheduleData
  onUpdated?: () => void
  onDeleted?: () => void
}

export function SiteOpsInfoSection({ schedule, onUpdated, onDeleted }: Props) {
  const { contract } = schedule
  const project = contract.project
  const company = project.branch.company
  const workTypeInfo = WORK_TYPE_LABELS[schedule.workType] ?? WORK_TYPE_LABELS.REWORK

  const address = project.address
  const mapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null

  const siteName = schedule.name ?? project.name

  // 工程名の編集
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(schedule.name ?? "")
  const [savingName, setSavingName] = useState(false)

  // メモの編集
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState(schedule.notes ?? "")
  const [savingNotes, setSavingNotes] = useState(false)

  // 住所の編集
  const [editingAddress, setEditingAddress] = useState(false)
  const [addressValue, setAddressValue] = useState(project.address ?? "")
  const [savingAddress, setSavingAddress] = useState(false)

  // 予定日の編集
  const [editingDates, setEditingDates] = useState(false)
  const [startDateValue, setStartDateValue] = useState(toInputDate(schedule.plannedStartDate))
  const [endDateValue, setEndDateValue] = useState(toInputDate(schedule.plannedEndDate))
  const [savingDates, setSavingDates] = useState(false)

  // 削除
  const [deleting, setDeleting] = useState(false)

  async function handleSaveName() {
    setSavingName(true)
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameValue.trim() || null }),
      })
      if (!res.ok) throw new Error()
      toast.success("工程名を更新しました")
      setEditingName(false)
      onUpdated?.()
    } catch {
      toast.error("工程名の更新に失敗しました")
    } finally {
      setSavingName(false)
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true)
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesValue.trim() || null }),
      })
      if (!res.ok) throw new Error()
      toast.success("メモを更新しました")
      setEditingNotes(false)
      onUpdated?.()
    } catch {
      toast.error("メモの更新に失敗しました")
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleSaveAddress() {
    setSavingAddress(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addressValue.trim() || null }),
      })
      if (!res.ok) throw new Error()
      toast.success("住所を更新しました")
      setEditingAddress(false)
      onUpdated?.()
    } catch {
      toast.error("住所の更新に失敗しました")
    } finally {
      setSavingAddress(false)
    }
  }

  async function handleSaveDates() {
    setSavingDates(true)
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plannedStartDate: startDateValue || null,
          plannedEndDate: endDateValue || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("予定日を更新しました")
      setEditingDates(false)
      onUpdated?.()
    } catch {
      toast.error("予定日の更新に失敗しました")
    } finally {
      setSavingDates(false)
    }
  }

  async function handleDelete() {
    const label = schedule.name ?? project.name
    const ok = window.confirm(`「${label}」の工程を削除しますか？\nこの操作は取り消せません。`)
    if (!ok) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success(`「${label}」を削除しました`)
      onDeleted?.()
    } catch {
      toast.error("削除に失敗しました")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* 現場名 + 作業種別 + 削除ボタン */}
      <div className="flex items-start gap-2">
        {editingName ? (
          <div className="flex-1 flex items-center gap-1.5">
            <Input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              placeholder={project.name}
              className="h-8 text-sm font-bold"
              maxLength={100}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName()
                if (e.key === "Escape") { setEditingName(false); setNameValue(schedule.name ?? "") }
              }}
            />
            <button
              onClick={handleSaveName}
              disabled={savingName}
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-green-100 text-green-600 transition-colors flex-shrink-0"
            >
              {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => { setEditingName(false); setNameValue(schedule.name ?? "") }}
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-1.5 group min-w-0">
            <h3 className="text-base font-bold text-slate-900 leading-tight truncate">
              {siteName}
            </h3>
            <button
              onClick={() => { setNameValue(schedule.name ?? ""); setEditingName(true) }}
              className="w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all flex-shrink-0"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
        <Badge className={`text-xs px-2 py-0.5 ${workTypeInfo.className} border-0 flex-shrink-0`}>
          {workTypeInfo.label}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        </Button>
      </div>

      {/* 2カラム グリッドレイアウト */}
      <div className="grid grid-cols-2 gap-3">
        {/* 左カラム: 会社・契約情報 + 日程 */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div>
              <span className="text-slate-500 text-xs">元請会社</span>
              <p className="text-slate-800 font-semibold text-xs mt-0.5 truncate">{company.name}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">契約番号</span>
              <p className="text-slate-800 font-semibold text-xs mt-0.5">{contract.contractNumber ?? "―"}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">契約金額</span>
              <p className="text-slate-800 font-semibold text-xs mt-0.5">{formatCurrency(contract.contractAmount)}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">合計金額</span>
              <p className="text-slate-800 font-semibold text-xs mt-0.5">{formatCurrency(contract.totalAmount)}</p>
            </div>
          </div>

          {/* 予定日 vs 実績日 */}
          <div className="border-t border-slate-200 pt-2">
            {editingDates ? (
              <div className="space-y-2">
                <div className="flex items-end gap-1.5">
                  <div className="flex-1">
                    <span className="text-slate-500 text-xs block mb-0.5">予定開始</span>
                    <Input type="date" className="h-7 text-xs" value={startDateValue} onChange={(e) => setStartDateValue(e.target.value)} autoFocus />
                  </div>
                  <span className="text-xs text-slate-300 pb-1.5">〜</span>
                  <div className="flex-1">
                    <span className="text-slate-500 text-xs block mb-0.5">予定終了</span>
                    <Input type="date" className="h-7 text-xs" value={endDateValue} onChange={(e) => setEndDateValue(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <button onClick={() => { setEditingDates(false); setStartDateValue(toInputDate(schedule.plannedStartDate)); setEndDateValue(toInputDate(schedule.plannedEndDate)) }} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded hover:bg-slate-100 transition-colors">キャンセル</button>
                  <button onClick={handleSaveDates} disabled={savingDates} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-0.5 rounded hover:bg-blue-50 transition-colors font-semibold">{savingDates ? "保存中..." : "保存"}</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-3 text-xs group">
                <div>
                  <span className="text-slate-500">予定</span>
                  <div className="flex items-center gap-1">
                    <p className="text-slate-800 font-medium mt-0.5">{formatDate(schedule.plannedStartDate)} 〜 {formatDate(schedule.plannedEndDate)}</p>
                    <button onClick={() => { setStartDateValue(toInputDate(schedule.plannedStartDate)); setEndDateValue(toInputDate(schedule.plannedEndDate)); setEditingDates(true) }} className="w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all flex-shrink-0">
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">実績</span>
                  <p className="text-slate-800 font-medium mt-0.5">{formatDate(schedule.actualStartDate)} 〜 {formatDate(schedule.actualEndDate)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右カラム: 住所・担当者・メモ */}
        <div className="space-y-2">
          {/* 住所 + Google Maps */}
          {editingAddress ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-600">住所</span>
              </div>
              <Input value={addressValue} onChange={(e) => setAddressValue(e.target.value)} placeholder="住所を入力..." className="h-7 text-xs" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleSaveAddress(); if (e.key === "Escape") { setEditingAddress(false); setAddressValue(project.address ?? "") } }} />
              <div className="flex items-center justify-end gap-1.5">
                <button onClick={() => { setEditingAddress(false); setAddressValue(project.address ?? "") }} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded hover:bg-slate-100 transition-colors">キャンセル</button>
                <button onClick={handleSaveAddress} disabled={savingAddress} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-0.5 rounded hover:bg-blue-50 transition-colors font-semibold">{savingAddress ? "保存中..." : "保存"}</button>
              </div>
            </div>
          ) : address ? (
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 group">
              <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-800 leading-relaxed">{address}</p>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1 font-semibold">
                    <ExternalLink className="w-3 h-3" />
                    Google Maps
                  </a>
                )}
              </div>
              <button onClick={() => { setAddressValue(project.address ?? ""); setEditingAddress(true) }} className="w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all flex-shrink-0">
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/30 p-2.5 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => { setAddressValue(""); setEditingAddress(true) }}>
              <MapPin className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              <span className="text-xs text-slate-400">+ 住所を追加</span>
            </div>
          )}

          {/* 担当者 */}
          {project.contact ? (
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
              <User className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800">{project.contact.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  {project.contact.phone && (
                    <a href={`tel:${project.contact.phone}`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold">
                      <Phone className="w-3 h-3" />
                      {project.contact.phone}
                    </a>
                  )}
                  {project.contact.email && (
                    <a href={`mailto:${project.contact.email}`} className="text-xs text-slate-500 hover:text-blue-600 transition-colors truncate">{project.contact.email}</a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/30 p-2.5">
              <User className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              <span className="text-xs text-slate-400">担当者未登録</span>
            </div>
          )}

          {/* メモ */}
          {editingNotes ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 space-y-1.5">
              <Textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)} placeholder="メモを入力..." className="text-xs resize-none" rows={2} maxLength={500} autoFocus />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{notesValue.length}/500</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => { setEditingNotes(false); setNotesValue(schedule.notes ?? "") }} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded hover:bg-slate-100 transition-colors">キャンセル</button>
                  <button onClick={handleSaveNotes} disabled={savingNotes} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-0.5 rounded hover:bg-blue-50 transition-colors font-semibold">{savingNotes ? "保存中..." : "保存"}</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 group">
              <FileText className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
              {schedule.notes ? (
                <div className="flex items-start gap-1 flex-1 min-w-0">
                  <p className="text-xs text-slate-700 leading-relaxed flex-1">{schedule.notes}</p>
                  <button onClick={() => { setNotesValue(schedule.notes ?? ""); setEditingNotes(true) }} className="w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all flex-shrink-0">
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button onClick={() => { setNotesValue(""); setEditingNotes(true) }} className="text-xs text-slate-400 hover:text-blue-600 transition-colors">+ メモを追加</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
