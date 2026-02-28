/**
 * [COMPONENT] マスター管理 - MasterManager
 *
 * 会社・支店・担当者・単位・タグをタブで切り替えて管理する。
 * 会社カード内から：編集ボタン・担当者追加ボタン
 * ふりがな登録 → ひらがなで検索可能
 */
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Building2,
  Users,
  Ruler,
  Tag,
  Plus,
  Loader2,
  Pencil,
  Search,
  Phone,
  Mail,
  UserPlus,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"

// ─── 型定義 ────────────────────────────────────────────

interface Contact {
  id: string
  name: string
  phone: string
  email: string
}

interface Company {
  id: string
  name: string
  furigana: string | null
  alias: string | null
  phone: string | null
  taxRate: number
  branches: { id: string; name: string }[]
  contacts: Contact[]
}

interface Unit {
  id: string
  name: string
  sortOrder: number
}

interface TagItem {
  id: string
  name: string
}

interface Props {
  companies: Company[]
  units: Unit[]
  tags: TagItem[]
}

// ─── メインコンポーネント ───────────────────────────────

export function MasterManager({ companies, units, tags }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // 検索
  const [companySearch, setCompanySearch] = useState("")

  // 展開状態（会社カードの担当者エリア）
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set())

  // ダイアログ種別
  type DialogType =
    | "createCompany"
    | "editCompany"
    | "createBranch"
    | "createContact"
    | "createUnit"
    | null
  const [dialogType, setDialogType] = useState<DialogType>(null)

  // 会社新規・編集フォーム
  const [editTarget, setEditTarget] = useState<Company | null>(null)
  const [companyName, setCompanyName] = useState("")
  const [companyFurigana, setCompanyFurigana] = useState("")
  const [companyPhone, setCompanyPhone] = useState("")
  // ふりがなを手動で変更したかどうか（手動変更後はIME自動入力を止める）
  const [furiganaManuallyEdited, setFuriganaManuallyEdited] = useState(false)

  function openCreateCompany() {
    setEditTarget(null)
    setCompanyName("")
    setCompanyFurigana("")
    setCompanyPhone("")
    setFuriganaManuallyEdited(false)
    setDialogType("createCompany")
  }

  function openEditCompany(company: Company) {
    setEditTarget(company)
    setCompanyName(company.name)
    setCompanyFurigana(company.furigana ?? "")
    setCompanyPhone(company.phone ?? "")
    // 既存のふりがながある場合は手動編集済みとして扱う
    setFuriganaManuallyEdited(!!(company.furigana))
    setDialogType("editCompany")
  }

  // IME変換中のひらがなをふりがな欄に自動反映
  function handleNameCompositionUpdate(e: React.CompositionEvent<HTMLInputElement>) {
    if (!furiganaManuallyEdited) {
      setCompanyFurigana(e.data)
    }
  }

  // IME確定後（変換後の文字列確定）は既存のふりがなを保持
  function handleNameCompositionEnd(e: React.CompositionEvent<HTMLInputElement>) {
    if (!furiganaManuallyEdited) {
      // 確定された文字列をそのまま保持（変換前ひらがながすでに入っている）
      setCompanyFurigana((prev) => prev)
    }
  }

  async function handleSaveCompany() {
    if (!companyName.trim()) {
      toast.error("会社名を入力してください")
      return
    }
    setLoading(true)
    try {
      if (dialogType === "createCompany") {
        const res = await fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: companyName.trim(),
            furigana: companyFurigana.trim() || null,
            phone: companyPhone.trim() || null,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error ?? "登録に失敗しました")
        }
        toast.success("会社を登録しました")
      } else if (dialogType === "editCompany" && editTarget) {
        const res = await fetch(`/api/companies/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: companyName.trim(),
            furigana: companyFurigana.trim() || null,
            phone: companyPhone.trim() || null,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error ?? "更新に失敗しました")
        }
        toast.success("会社情報を更新しました")
      }
      setDialogType(null)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  // 支店フォーム
  const [branchName, setBranchName] = useState("")
  const [branchCompanyId, setBranchCompanyId] = useState("")

  function openCreateBranch(companyId?: string) {
    setBranchName("")
    setBranchCompanyId(companyId ?? "")
    setDialogType("createBranch")
  }

  async function handleCreateBranch() {
    if (!branchName.trim() || !branchCompanyId) return
    setLoading(true)
    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: branchName, companyId: branchCompanyId }),
      })
      if (!res.ok) throw new Error()
      toast.success("支店を登録しました")
      setDialogType(null)
      router.refresh()
    } catch {
      toast.error("登録に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  // 担当者フォーム
  const [contactCompanyId, setContactCompanyId] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactEmail, setContactEmail] = useState("")

  function openCreateContact(companyId: string) {
    setContactCompanyId(companyId)
    setContactName("")
    setContactPhone("")
    setContactEmail("")
    setDialogType("createContact")
  }

  async function handleCreateContact() {
    if (!contactName.trim()) {
      toast.error("担当者名を入力してください")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: contactCompanyId,
          name: contactName.trim(),
          phone: contactPhone.trim() || "",
          email: contactEmail.trim() || "",
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("担当者を登録しました")
      setDialogType(null)
      router.refresh()
    } catch {
      toast.error("登録に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  // 単位フォーム
  const [unitName, setUnitName] = useState("")

  async function handleCreateUnit() {
    if (!unitName.trim()) return
    setLoading(true)
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: unitName }),
      })
      if (!res.ok) throw new Error()
      toast.success("単位を登録しました")
      setUnitName("")
      setDialogType(null)
      router.refresh()
    } catch {
      toast.error("登録に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  // 担当者エリアの展開トグル
  function toggleContacts(companyId: string) {
    setExpandedContacts((prev) => {
      const next = new Set(prev)
      if (next.has(companyId)) next.delete(companyId)
      else next.add(companyId)
      return next
    })
  }

  // 会社一覧（ふりがな・会社名で絞り込み）
  const filteredCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase()
    if (!q) return companies
    return companies.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        (c.furigana ?? "").toLowerCase().includes(q) ||
        (c.alias ?? "").toLowerCase().includes(q)
      )
    })
  }, [companies, companySearch])

  // 編集ダイアログのタイトル
  const dialogTitle =
    dialogType === "createCompany"
      ? "会社を新規登録"
      : dialogType === "editCompany"
      ? "会社情報を編集"
      : dialogType === "createBranch"
      ? "支店を追加"
      : dialogType === "createContact"
      ? "担当者を追加"
      : "単位を追加"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">マスター管理</h1>
        <p className="text-sm text-slate-500 mt-1">
          会社・支店・担当者・単位を管理します
        </p>
      </div>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies" className="gap-1.5">
            <Building2 className="w-4 h-4" />
            会社・支店・担当者
          </TabsTrigger>
          <TabsTrigger value="units" className="gap-1.5">
            <Ruler className="w-4 h-4" />
            単位
          </TabsTrigger>
          <TabsTrigger value="tags" className="gap-1.5">
            <Tag className="w-4 h-4" />
            タグ
          </TabsTrigger>
        </TabsList>

        {/* ━━ 会社・支店・担当者タブ ━━━━━━━━━━━━━━━ */}
        <TabsContent value="companies" className="space-y-4 mt-4">
          {/* 操作バー */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="会社名・ふりがなで検索"
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <Button size="sm" onClick={openCreateCompany}>
              <Plus className="w-4 h-4 mr-1" />
              会社を追加
            </Button>
            <Button size="sm" variant="outline" onClick={() => openCreateBranch()}>
              <Plus className="w-4 h-4 mr-1" />
              支店を追加
            </Button>
          </div>

          {filteredCompanies.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-400">
                {companySearch
                  ? `「${companySearch}」に一致する会社がありません`
                  : "会社が登録されていません"}
              </CardContent>
            </Card>
          ) : (
            filteredCompanies.map((company) => {
              const isContactsOpen = expandedContacts.has(company.id)
              return (
                <Card key={company.id} className="overflow-hidden">
                  {/* 会社ヘッダー */}
                  <CardHeader className="pb-0 pt-4 px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="font-bold text-slate-900 text-base">
                            {company.name}
                          </span>
                          {company.furigana && (
                            <span className="text-xs text-slate-400">
                              （{company.furigana}）
                            </span>
                          )}
                        </div>
                        {company.phone && (
                          <div className="flex items-center gap-1 mt-1 ml-6">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span className="text-xs text-slate-500">
                              {company.phone}
                            </span>
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditCompany(company)}
                        className="flex-shrink-0 h-8 gap-1 text-xs"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        編集
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="px-5 pb-4 pt-3 space-y-3">
                    {/* 支店 */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          支店
                        </p>
                        <button
                          onClick={() => openCreateBranch(company.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          追加
                        </button>
                      </div>
                      {company.branches.length === 0 ? (
                        <p className="text-sm text-slate-400">支店なし</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {company.branches.map((b) => (
                            <span
                              key={b.id}
                              className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs"
                            >
                              {b.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 担当者（折りたたみ） */}
                    <div>
                      <button
                        onClick={() => toggleContacts(company.id)}
                        className="flex items-center justify-between w-full mb-1.5"
                      >
                        <div className="flex items-center gap-1.5">
                          {isContactsOpen ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            担当者
                          </p>
                          <span className="text-xs text-slate-400">
                            {company.contacts.length} 名
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openCreateContact(company.id)
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <UserPlus className="w-3 h-3" />
                          担当者を追加
                        </button>
                      </button>

                      {isContactsOpen && (
                        <div className="space-y-1.5 pl-1">
                          {company.contacts.length === 0 ? (
                            <p className="text-sm text-slate-400 py-1">
                              担当者が登録されていません
                            </p>
                          ) : (
                            company.contacts.map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-50 border border-slate-100"
                              >
                                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                  <Users className="w-3.5 h-3.5 text-blue-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-slate-800">
                                    {c.name}
                                  </p>
                                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                    {c.phone && (
                                      <span className="flex items-center gap-1 text-xs text-slate-500">
                                        <Phone className="w-3 h-3" />
                                        {c.phone}
                                      </span>
                                    )}
                                    {c.email && (
                                      <span className="flex items-center gap-1 text-xs text-slate-500">
                                        <Mail className="w-3 h-3" />
                                        {c.email}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* ━━ 単位タブ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <TabsContent value="units" className="space-y-4 mt-4">
          <Button size="sm" onClick={() => setDialogType("createUnit")}>
            <Plus className="w-4 h-4 mr-1" />
            単位を追加
          </Button>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>単位名</TableHead>
                    <TableHead className="w-24">並び順</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-8 text-slate-400">
                        単位が登録されていません
                      </TableCell>
                    </TableRow>
                  ) : (
                    units.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-slate-500">{u.sortOrder}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ━━ タグタブ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <TabsContent value="tags" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>タグ名</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.length === 0 ? (
                    <TableRow>
                      <TableCell className="text-center py-8 text-slate-400">
                        タグが登録されていません
                      </TableCell>
                    </TableRow>
                  ) : (
                    tags.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ━━ 会社 新規登録 / 編集ダイアログ ━━━━━━━━━━━━ */}
      <Dialog
        open={dialogType === "createCompany" || dialogType === "editCompany"}
        onOpenChange={(v) => { if (!v) setDialogType(null) }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                会社名 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onCompositionUpdate={handleNameCompositionUpdate}
                onCompositionEnd={handleNameCompositionEnd}
                placeholder="例：株式会社○○建設"
                onKeyDown={(e) => e.key === "Enter" && handleSaveCompany()}
              />
            </div>
            <div className="space-y-2">
              <Label>
                ふりがな
                <span className="text-xs text-slate-400 ml-2">
                  {furiganaManuallyEdited
                    ? "（手動入力）"
                    : "（会社名入力時に自動で入ります）"}
                </span>
              </Label>
              <Input
                value={companyFurigana}
                onChange={(e) => {
                  setCompanyFurigana(e.target.value)
                  setFuriganaManuallyEdited(true)
                }}
                onFocus={() => {
                  // ふりがな欄にフォーカスが来たら手動モードに切り替え
                  if (companyFurigana) setFuriganaManuallyEdited(true)
                }}
                placeholder="例：かぶしきかいしゃまるまるけんせつ"
              />
            </div>
            <div className="space-y-2">
              <Label>代表電話番号</Label>
              <Input
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                placeholder="03-0000-0000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              キャンセル
            </Button>
            <Button onClick={handleSaveCompany} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialogType === "editCompany" ? "更新する" : "登録する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ━━ 支店追加ダイアログ ━━━━━━━━━━━━━━━━━━━━ */}
      <Dialog
        open={dialogType === "createBranch"}
        onOpenChange={(v) => { if (!v) setDialogType(null) }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>支店を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                会社 <span className="text-red-500">*</span>
              </Label>
              <select
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={branchCompanyId}
                onChange={(e) => setBranchCompanyId(e.target.value)}
              >
                <option value="">会社を選択</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>
                支店名 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="例：東京支店"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              キャンセル
            </Button>
            <Button onClick={handleCreateBranch} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              追加する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ━━ 担当者追加ダイアログ ━━━━━━━━━━━━━━━━━━ */}
      <Dialog
        open={dialogType === "createContact"}
        onOpenChange={(v) => { if (!v) setDialogType(null) }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              担当者を追加
              {contactCompanyId && (
                <span className="text-sm font-normal text-slate-500 ml-2">
                  — {companies.find((c) => c.id === contactCompanyId)?.name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                担当者名 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="例：山田 太郎"
                onKeyDown={(e) => e.key === "Enter" && handleCreateContact()}
              />
            </div>
            <div className="space-y-2">
              <Label>電話番号（任意）</Label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="090-0000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label>メールアドレス（任意）</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="example@company.co.jp"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              キャンセル
            </Button>
            <Button onClick={handleCreateContact} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              追加する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ━━ 単位追加ダイアログ ━━━━━━━━━━━━━━━━━━━━ */}
      <Dialog
        open={dialogType === "createUnit"}
        onOpenChange={(v) => { if (!v) setDialogType(null) }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>単位を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                単位名 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="例：m², 式, 本"
                onKeyDown={(e) => e.key === "Enter" && handleCreateUnit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              キャンセル
            </Button>
            <Button onClick={handleCreateUnit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              追加する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
