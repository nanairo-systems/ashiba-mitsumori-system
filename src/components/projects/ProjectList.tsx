"use client"

import { useState } from "react"
import Link from "next/link"
import { formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, Search, MoreHorizontal, Archive, Eye } from "lucide-react"
import type { EstimateStatus } from "@prisma/client"

interface Project {
  id: string
  shortId: string
  name: string
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
  branch: {
    name: string
    company: {
      name: string
    }
  }
  contact: { name: string } | null
  estimates: {
    id: string
    status: EstimateStatus
    estimateNumber: string | null
    revision: number
  }[]
}

interface ProjectListProps {
  projects: Project[]
  currentUser: { id: string; name: string }
}

const statusLabel: Record<EstimateStatus, string> = {
  DRAFT: "下書き",
  CONFIRMED: "確定",
  SENT: "送付済",
  OLD: "旧版",
}

const statusColor: Record<EstimateStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  SENT: "bg-green-100 text-green-700",
  OLD: "bg-orange-100 text-orange-700",
}

export function ProjectList({ projects, currentUser }: ProjectListProps) {
  const [search, setSearch] = useState("")
  const [showArchived, setShowArchived] = useState(false)

  const filtered = projects.filter((p) => {
    const matchSearch =
      search === "" ||
      p.branch.company.name.includes(search) ||
      p.name.includes(search)
    const matchArchive = showArchived ? p.isArchived : !p.isArchived
    return matchSearch && matchArchive
  })

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">現場・見積一覧</h1>
          <p className="text-sm text-slate-500 mt-1">
            こんにちは、{currentUser.name}さん
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            新規現場作成
          </Button>
        </Link>
      </div>

      {/* 検索・フィルター */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="会社名・現場名で検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={showArchived ? "default" : "outline"}
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
        >
          <Archive className="w-4 h-4 mr-2" />
          失注案件 {showArchived ? "を隠す" : "を表示"}
        </Button>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-28">ID</TableHead>
              <TableHead>会社名</TableHead>
              <TableHead>現場名</TableHead>
              <TableHead>担当者</TableHead>
              <TableHead>見積番号</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>更新日</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-12 text-slate-400"
                >
                  現場が見つかりません
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((project) => {
                const latestEstimate = project.estimates[0]
                return (
                  <TableRow key={project.id} className="hover:bg-slate-50">
                    <TableCell className="text-xs text-slate-400 font-mono">
                      {project.shortId}
                    </TableCell>
                    <TableCell className="font-medium">
                      {project.branch.company.name}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {project.contact?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {latestEstimate?.estimateNumber
                        ? `${latestEstimate.estimateNumber}${latestEstimate.revision > 1 ? `-${latestEstimate.revision}` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {latestEstimate ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor[latestEstimate.status]}`}
                        >
                          {statusLabel[latestEstimate.status]}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">未作成</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {formatDate(project.updatedAt, "MM/dd")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${project.id}`}>
                              <Eye className="w-4 h-4 mr-2" />
                              詳細を開く
                            </Link>
                          </DropdownMenuItem>
                          {latestEstimate && (
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/estimates/${latestEstimate.id}`}
                              >
                                見積を開く
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-orange-600">
                            <Archive className="w-4 h-4 mr-2" />
                            失注としてアーカイブ
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-slate-400 text-right">
        {filtered.length} 件表示
      </p>
    </div>
  )
}
