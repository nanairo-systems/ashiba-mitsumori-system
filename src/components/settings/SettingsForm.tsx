/**
 * [COMPONENT] 設定ページ - SettingsForm
 *
 * ユーザーのプロフィール表示。将来的にパスワード変更・システム設定を追加予定。
 */
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, Mail, Calendar, Shield } from "lucide-react"
import { formatDate } from "@/lib/utils"

interface Props {
  user: {
    id: string
    name: string
    email: string
    isActive: boolean
    createdAt: Date
  }
}

export function SettingsForm({ user }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">設定</h1>
        <p className="text-sm text-slate-500 mt-1">
          アカウント情報の確認
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            プロフィール
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
              {user.name.charAt(0)}
            </div>
            <div>
              <p className="font-medium text-lg">{user.name}</p>
              <Badge
                variant={user.isActive ? "default" : "secondary"}
                className="text-xs"
              >
                {user.isActive ? "アクティブ" : "無効"}
              </Badge>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500 w-24">メール</span>
              <span>{user.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500 w-24">登録日</span>
              <span>{formatDate(user.createdAt, "yyyy年MM月dd日")}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500 w-24">ユーザーID</span>
              <span className="font-mono text-xs text-slate-400">
                {user.id}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base text-slate-500">
            今後追加予定
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-slate-500">
            <li>・ パスワード変更</li>
            <li>・ 表示名の変更</li>
            <li>・ 通知設定</li>
            <li>・ PDF出力設定（ロゴ・ヘッダー）</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
