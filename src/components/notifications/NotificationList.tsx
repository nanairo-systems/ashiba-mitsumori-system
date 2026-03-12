/**
 * [COMPONENT] 通知一覧 - NotificationList
 *
 * フォローアップ通知の表示。既読/未読の切り替え。
 */
"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bell, BellOff, CheckCheck, ExternalLink } from "lucide-react"
import { toast } from "sonner"

interface Notification {
  id: string
  message: string
  isRead: boolean
  scheduledAt: Date
  estimate: {
    id: string
    estimateNumber: string | null
    project: {
      name: string
      branch: {
        company: { name: string }
      }
    }
  }
}

interface Props {
  notifications: Notification[]
}

export function NotificationList({ notifications }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const unread = notifications.filter((n) => !n.isRead)
  const read = notifications.filter((n) => n.isRead)

  async function handleMarkAllRead() {
    const ids = unread.map((n) => n.id)
    if (ids.length === 0) return
    setLoading(true)
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) throw new Error()
      toast.success("すべて既読にしました")
      router.refresh()
    } catch {
      toast.error("更新に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      })
      router.refresh()
    } catch {
      /* ignore */
    }
  }

  function NotificationCard({ n }: { n: Notification }) {
    return (
      <Card
        className={
          n.isRead ? "opacity-60" : "border-blue-200 bg-blue-50/30"
        }
      >
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {n.isRead ? (
                <BellOff className="w-4 h-4 text-slate-400" />
              ) : (
                <Bell className="w-4 h-4 text-blue-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">
                  {n.estimate.project.branch.company.name}
                </span>
                <span className="text-xs text-slate-400">/</span>
                <span className="text-sm text-slate-600">
                  {n.estimate.project.name}
                </span>
                {!n.isRead && (
                  <Badge className="bg-blue-500 text-white text-xs px-1.5">
                    未読
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-600">{n.message}</p>
              <p className="text-xs text-slate-400 mt-1">
                {formatDate(n.scheduledAt, "yyyy/MM/dd HH:mm")}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {!n.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMarkRead(n.id)}
                  title="既読にする"
                >
                  <CheckCheck className="w-4 h-4" />
                </Button>
              )}
              <Link href={`/estimates/${n.estimate.id}`}>
                <Button variant="ghost" size="sm" title="見積を開く">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="relative flex items-center justify-between">
        <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">NF-1</span>
        <div className="ml-7">
          <h1 className="text-2xl font-bold text-slate-900">通知</h1>
          <p className="text-sm text-slate-500 mt-1">
            フォローアップの通知一覧
          </p>
        </div>
        {unread.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={loading}
          >
            <CheckCheck className="w-4 h-4 mr-1" />
            すべて既読にする
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">通知はありません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {unread.length > 0 && (
            <div className="relative space-y-2">
              <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">NF-2</span>
              <h2 className="text-sm font-medium text-slate-500 ml-7">
                未読（{unread.length}件）
              </h2>
              {unread.map((n) => (
                <NotificationCard key={n.id} n={n} />
              ))}
            </div>
          )}
          {read.length > 0 && (
            <div className="relative space-y-2">
              <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">NF-3</span>
              <h2 className="text-sm font-medium text-slate-400 mt-4 ml-7">
                既読（{read.length}件）
              </h2>
              {read.map((n) => (
                <NotificationCard key={n.id} n={n} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
