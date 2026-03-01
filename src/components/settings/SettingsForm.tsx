/**
 * [COMPONENT] 設定ページ - SettingsForm
 *
 * ADMIN: プロフィール + ユーザー管理（新規追加・権限変更）
 * STAFF: 設定ページ自体に入れない（page.tsx でリダイレクト）
 */
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  User,
  Mail,
  Calendar,
  Shield,
  UserPlus,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Crown,
  Users,
} from "lucide-react"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"

interface UserRow {
  id: string
  name: string
  email: string
  role: "ADMIN" | "STAFF"
  isActive: boolean
  createdAt: Date
}

interface Props {
  currentUser: {
    id: string
    name: string
    email: string
    role: "ADMIN" | "STAFF"
    isActive: boolean
    createdAt: Date
  }
  allUsers: UserRow[]
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "管理者",
  STAFF: "スタッフ",
}

const ROLE_COLOR: Record<string, string> = {
  ADMIN: "bg-amber-100 text-amber-800 border-amber-200",
  STAFF: "bg-sky-100 text-sky-700 border-sky-200",
}

export function SettingsForm({ currentUser, allUsers: initial }: Props) {
  const [users, setUsers] = useState<UserRow[]>(initial)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newRole, setNewRole] = useState<"ADMIN" | "STAFF">("STAFF")

  const handleCreate = async () => {
    if (!newName || !newEmail || !newPassword) {
      toast.error("全ての項目を入力してください")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "作成に失敗しました")
        return
      }
      setUsers((prev) => [...prev, { ...data, createdAt: new Date(data.createdAt) }])
      toast.success(`${newName} のアカウントを作成しました`)
      setDialogOpen(false)
      setNewName("")
      setNewEmail("")
      setNewPassword("")
      setNewRole("STAFF")
    } catch {
      toast.error("エラーが発生しました")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (user: UserRow) => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u))
      )
      toast.success(user.isActive ? "アカウントを無効にしました" : "アカウントを有効にしました")
    } else {
      toast.error("更新に失敗しました")
    }
  }

  const handleChangeRole = async (user: UserRow, role: "ADMIN" | "STAFF") => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    const data = await res.json()
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role } : u))
      )
      toast.success(`${user.name} の権限を ${ROLE_LABEL[role]} に変更しました`)
    } else {
      toast.error(data.error ?? "更新に失敗しました")
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">設定</h1>
        <p className="text-sm text-slate-500 mt-1">
          システム設定とアカウント管理（管理者専用）
        </p>
      </div>

      {/* 自分のプロフィール */}
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            マイプロフィール
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-lg">{currentUser.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLOR[currentUser.role]}`}
                >
                  {currentUser.role === "ADMIN" && <Crown className="w-3 h-3" />}
                  {ROLE_LABEL[currentUser.role]}
                </span>
                <Badge
                  variant={currentUser.isActive ? "default" : "secondary"}
                  className="text-xs"
                >
                  {currentUser.isActive ? "アクティブ" : "無効"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-slate-500 w-24 shrink-0">メール</span>
              <span>{currentUser.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-slate-500 w-24 shrink-0">登録日</span>
              <span>{formatDate(currentUser.createdAt, "yyyy年MM月dd日")}</span>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <Shield className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span className="text-slate-500 w-24 shrink-0">ユーザーID</span>
              <span className="font-mono text-xs text-slate-400 break-all">
                {currentUser.id}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ユーザー管理 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-800">ユーザー管理</h2>
            <span className="text-sm text-slate-500">({users.length}名)</span>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1.5">
            <UserPlus className="w-4 h-4" />
            アカウント発行
          </Button>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          {/* ヘッダー */}
          <div className="grid grid-cols-[2fr_2fr_6rem_6rem_2.5rem] gap-3 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide">
            <span>名前</span>
            <span>メールアドレス</span>
            <span>権限</span>
            <span>ステータス</span>
            <span></span>
          </div>

          {users.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              ユーザーがいません
            </div>
          )}

          {users.map((u, i) => (
            <div
              key={u.id}
              className={`grid grid-cols-[2fr_2fr_6rem_6rem_2.5rem] gap-3 px-4 py-3 items-center text-sm ${
                i < users.length - 1 ? "border-b border-slate-100" : ""
              } ${!u.isActive ? "opacity-50" : ""}`}
            >
              {/* 名前 */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                  {u.name.charAt(0)}
                </div>
                <span className="font-medium truncate">{u.name}</span>
                {u.id === currentUser.id && (
                  <span className="text-xs text-slate-400 shrink-0">(自分)</span>
                )}
              </div>

              {/* メール */}
              <span className="text-slate-500 truncate">{u.email}</span>

              {/* 権限バッジ */}
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium w-fit ${ROLE_COLOR[u.role]}`}
              >
                {u.role === "ADMIN" && <Crown className="w-3 h-3" />}
                {ROLE_LABEL[u.role]}
              </span>

              {/* ステータス */}
              <div className="flex items-center gap-1 text-xs">
                {u.isActive ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-300" />
                )}
                <span className={u.isActive ? "text-emerald-700" : "text-slate-400"}>
                  {u.isActive ? "有効" : "無効"}
                </span>
              </div>

              {/* メニュー */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {u.role !== "ADMIN" && (
                    <DropdownMenuItem onClick={() => handleChangeRole(u, "ADMIN")}>
                      <Crown className="w-4 h-4 mr-2 text-amber-500" />
                      管理者に変更
                    </DropdownMenuItem>
                  )}
                  {u.role !== "STAFF" && u.id !== currentUser.id && (
                    <DropdownMenuItem onClick={() => handleChangeRole(u, "STAFF")}>
                      <User className="w-4 h-4 mr-2 text-sky-500" />
                      スタッフに変更
                    </DropdownMenuItem>
                  )}
                  {u.id !== currentUser.id && (
                    <DropdownMenuItem
                      onClick={() => handleToggleActive(u)}
                      className={u.isActive ? "text-red-600" : "text-emerald-600"}
                    >
                      {u.isActive ? (
                        <>
                          <XCircle className="w-4 h-4 mr-2" />
                          無効にする
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          有効にする
                        </>
                      )}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </div>

      {/* アカウント発行ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-500" />
              新規アカウント発行
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-name">名前 *</Label>
              <Input
                id="new-name"
                placeholder="例：山田 太郎"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-email">メールアドレス *</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="例：yamada@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">初期パスワード *</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="8文字以上"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="text-xs text-slate-400">
                本人に初期パスワードを伝えてください。後でご本人が変更できます。
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>権限</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as "ADMIN" | "STAFF")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">
                    スタッフ（見積・現場・マスター操作可）
                  </SelectItem>
                  <SelectItem value="ADMIN">
                    管理者（全機能 + ユーザー管理）
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "作成中..." : "アカウント発行"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
