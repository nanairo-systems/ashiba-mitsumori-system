/**
 * [COMPONENT] 開発メニュー - ダッシュボード
 *
 * - 変更履歴タブ: gitコミットから自動取得、日付順表示、影響ページ表示
 * - タスク管理タブ: localStorage保存、追加・完了・削除
 */
"use client"

import { useState, useEffect, useCallback } from "react"
import {
  GitCommitHorizontal,
  ListTodo,
  Plus,
  Check,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FileCode,
  Loader2,
  Undo2,
  CircleDot,
  ArrowUpCircle,
  Wrench,
  Paintbrush,
  Sparkles,
  MoreHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── 型定義 ──
interface Commit {
  hash: string
  date: string
  author: string
  authorEmail: string
  message: string
  category: string
  files: string[]
  pages: string[]
}

interface DevTask {
  id: string
  text: string
  done: boolean
  createdAt: string
  completedAt?: string
}

const TASKS_KEY = "dev_tasks"

// カテゴリのラベルと色
const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  feature: { label: "機能追加", color: "bg-emerald-100 text-emerald-700", icon: Sparkles },
  fix: { label: "バグ修正", color: "bg-red-100 text-red-700", icon: CircleDot },
  improvement: { label: "改善", color: "bg-blue-100 text-blue-700", icon: ArrowUpCircle },
  refactor: { label: "リファクタ", color: "bg-violet-100 text-violet-700", icon: Wrench },
  style: { label: "スタイル", color: "bg-amber-100 text-amber-700", icon: Paintbrush },
  docs: { label: "ドキュメント", color: "bg-slate-100 text-slate-600", icon: FileCode },
  chore: { label: "雑務", color: "bg-slate-100 text-slate-600", icon: MoreHorizontal },
  other: { label: "その他", color: "bg-slate-100 text-slate-500", icon: MoreHorizontal },
}

// ── 変更履歴タブ ──
function ChangelogTab() {
  const [commits, setCommits] = useState<Commit[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>("all")

  const fetchChangelog = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/dev/changelog?limit=150")
      const data = await res.json()
      setCommits(data.commits || [])
      // 最新日の日付を自動展開
      if (data.commits?.length > 0) {
        setExpandedDates(new Set([data.commits[0].date]))
      }
    } catch {
      setCommits([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChangelog()
  }, [fetchChangelog])

  // 日付ごとにグループ化
  const groupedByDate = commits.reduce<Record<string, Commit[]>>((acc, commit) => {
    if (!acc[commit.date]) acc[commit.date] = []
    acc[commit.date].push(commit)
    return acc
  }, {})

  const filteredGrouped = Object.entries(groupedByDate).map(([date, dateCommits]) => ({
    date,
    commits: filterCategory === "all"
      ? dateCommits
      : dateCommits.filter((c) => c.category === filterCategory),
  })).filter((g) => g.commits.length > 0)

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  // カテゴリの集計
  const categoryCounts = commits.reduce<Record<string, number>>((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        コミット履歴を取得中...
      </div>
    )
  }

  return (
    <div>
      {/* フィルター & リフレッシュ */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilterCategory("all")}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
            filterCategory === "all"
              ? "bg-slate-800 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          )}
        >
          すべて ({commits.length})
        </button>
        {Object.entries(categoryCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([cat, count]) => {
            const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  filterCategory === cat
                    ? "bg-slate-800 text-white"
                    : `${config.color} hover:opacity-80`
                )}
              >
                {config.label} ({count})
              </button>
            )
          })}
        <button
          onClick={fetchChangelog}
          className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="再取得"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 日付グループ */}
      <div className="space-y-2">
        {filteredGrouped.map(({ date, commits: dateCommits }) => (
          <div key={date} className="border border-slate-200 rounded-xl overflow-hidden">
            {/* 日付ヘッダー */}
            <button
              onClick={() => toggleDate(date)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              {expandedDates.has(date) ? (
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              )}
              <span className="text-sm font-bold text-slate-700">{date}</span>
              <span className="text-xs text-slate-400">{dateCommits.length}件の変更</span>
              {/* その日のカテゴリバッジ */}
              <div className="flex gap-1 ml-auto">
                {Array.from(new Set(dateCommits.map((c) => c.category))).map((cat) => {
                  const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other
                  const Icon = config.icon
                  return (
                    <span key={cat} className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-0.5", config.color)}>
                      <Icon className="w-2.5 h-2.5" />
                      {config.label}
                    </span>
                  )
                })}
              </div>
            </button>

            {/* コミット一覧 */}
            {expandedDates.has(date) && (
              <div className="divide-y divide-slate-100">
                {dateCommits.map((commit) => {
                  const config = CATEGORY_CONFIG[commit.category] || CATEGORY_CONFIG.other
                  const Icon = config.icon
                  const isExpanded = expandedCommit === commit.hash
                  return (
                    <div key={commit.hash} className="px-4 py-3 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={cn("mt-0.5 p-1 rounded", config.color)}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <code className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                              {commit.hash}
                            </code>
                            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", config.color)}>
                              {config.label}
                            </span>
                            {commit.author && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-500" title={commit.authorEmail}>
                                <span className="w-3.5 h-3.5 rounded-full bg-slate-300 text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                                  {commit.author.charAt(0).toUpperCase()}
                                </span>
                                {commit.author}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-800 leading-relaxed">
                            {commit.message.replace(/^(feat|fix|refactor|style|docs|chore|perf|test)(\(.+?\))?:\s*/, "")}
                          </p>
                          {/* 影響ページ */}
                          {commit.pages.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {commit.pages.map((page) => (
                                <span
                                  key={page}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-xs font-medium"
                                >
                                  {page}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* 変更ファイル展開 */}
                          {commit.files.length > 0 && (
                            <button
                              onClick={() => setExpandedCommit(isExpanded ? null : commit.hash)}
                              className="mt-2 flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              <FileCode className="w-3 h-3" />
                              {commit.files.length}ファイル変更
                              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </button>
                          )}
                          {isExpanded && (
                            <div className="mt-2 pl-2 border-l-2 border-slate-200 space-y-0.5">
                              {commit.files.map((file, i) => (
                                <p key={i} className="text-[11px] text-slate-400 font-mono truncate">
                                  {file}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredGrouped.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          該当するコミットがありません
        </div>
      )}
    </div>
  )
}

// ── タスク管理タブ ──
function TasksTab() {
  const [tasks, setTasks] = useState<DevTask[]>([])
  const [newTask, setNewTask] = useState("")
  const [showDone, setShowDone] = useState(false)

  // localStorageから読み込み
  useEffect(() => {
    try {
      const stored = localStorage.getItem(TASKS_KEY)
      if (stored) setTasks(JSON.parse(stored))
    } catch {
      // ignore
    }
  }, [])

  // localStorageに保存
  const saveTasks = (updated: DevTask[]) => {
    setTasks(updated)
    localStorage.setItem(TASKS_KEY, JSON.stringify(updated))
  }

  const addTask = () => {
    const text = newTask.trim()
    if (!text) return
    const task: DevTask = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text,
      done: false,
      createdAt: new Date().toISOString(),
    }
    saveTasks([task, ...tasks])
    setNewTask("")
  }

  const toggleTask = (id: string) => {
    saveTasks(
      tasks.map((t) =>
        t.id === id
          ? { ...t, done: !t.done, completedAt: !t.done ? new Date().toISOString() : undefined }
          : t
      )
    )
  }

  const deleteTask = (id: string) => {
    saveTasks(tasks.filter((t) => t.id !== id))
  }

  const pendingTasks = tasks.filter((t) => !t.done)
  const doneTasks = tasks.filter((t) => t.done)

  return (
    <div>
      {/* 新規タスク入力 */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="新しいタスクを入力..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={addTask}
          disabled={!newTask.trim()}
          className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          追加
        </button>
      </div>

      {/* 未完了タスク */}
      {pendingTasks.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          <ListTodo className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          未完了のタスクはありません
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {pendingTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors group"
            >
              <button
                onClick={() => toggleTask(task.id)}
                className="w-5 h-5 rounded-md border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-colors flex-shrink-0 flex items-center justify-center"
                title="完了にする"
              >
                <Check className="w-3 h-3 text-transparent group-hover:text-blue-400" />
              </button>
              <span className="flex-1 text-sm text-slate-700">{task.text}</span>
              <span className="text-[10px] text-slate-400">
                {new Date(task.createdAt).toLocaleDateString("ja-JP")}
              </span>
              <button
                onClick={() => deleteTask(task.id)}
                className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                title="削除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 完了タスク */}
      {doneTasks.length > 0 && (
        <div>
          <button
            onClick={() => setShowDone(!showDone)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-2"
          >
            {showDone ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            完了済み ({doneTasks.length})
          </button>
          {showDone && (
            <div className="space-y-1.5">
              {doneTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-50 group"
                >
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="w-5 h-5 rounded-md bg-emerald-100 flex items-center justify-center flex-shrink-0 hover:bg-amber-100 transition-colors"
                    title="未完了に戻す"
                  >
                    <Check className="w-3 h-3 text-emerald-600" />
                  </button>
                  <span className="flex-1 text-sm text-slate-400 line-through">{task.text}</span>
                  <span className="text-[10px] text-slate-300">
                    {task.completedAt && new Date(task.completedAt).toLocaleDateString("ja-JP")}
                  </span>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    title="削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 統計 */}
      <div className="mt-8 pt-4 border-t border-slate-100 flex gap-6 text-xs text-slate-400">
        <span>合計: {tasks.length}件</span>
        <span>未完了: {pendingTasks.length}件</span>
        <span>完了: {doneTasks.length}件</span>
      </div>
    </div>
  )
}

// ── メインコンポーネント ──
type TabType = "changelog" | "tasks"

export function DevDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("changelog")

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: "changelog", label: "変更履歴", icon: GitCommitHorizontal },
    { id: "tasks", label: "タスク管理", icon: ListTodo },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">開発メニュー</h1>
        <p className="text-xs text-slate-400 mt-1">開発者専用 - 変更履歴の確認とタスク管理</p>
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === id
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      {activeTab === "changelog" && <ChangelogTab />}
      {activeTab === "tasks" && <TasksTab />}
    </div>
  )
}
