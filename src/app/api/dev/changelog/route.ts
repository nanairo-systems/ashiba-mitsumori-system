/**
 * [API] 開発用 - Gitコミット履歴取得
 *
 * git logからコミット履歴を取得し、変更ファイルから影響ページを自動判別する。
 * 開発環境専用API。
 */
import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

// ファイルパス → ページ名のマッピング
const FILE_TO_PAGE_MAP: Record<string, string> = {
  "src/app/(app)/page.tsx": "商談一覧",
  "src/components/projects/ProjectList": "商談一覧",
  "src/components/projects/ProjectDetail": "商談詳細",
  "src/app/(app)/projects/": "商談",
  "src/app/(app)/contracts/page.tsx": "契約一覧",
  "src/app/(app)/contracts/summary": "契約集計",
  "src/components/contracts/ContractList": "契約一覧",
  "src/components/contracts/ContractDetail": "契約詳細",
  "src/components/contracts/ContractSummary": "契約集計",
  "src/components/contracts/ContractPrint": "契約印刷",
  "src/components/contracts/ContractProcessing": "契約処理",
  "src/app/(app)/estimates/": "見積",
  "src/components/estimates/EstimateDetail": "見積詳細",
  "src/components/estimates/EstimateEditor": "見積編集",
  "src/components/estimates/NewEstimateForm": "新規見積作成",
  "src/components/estimates/EstimateBundlePrint": "見積束印刷",
  "src/components/estimates/EstimatePurchaseOrder": "発注書",
  "src/components/estimates/ItemPickerDialog": "項目選択",
  "src/app/(app)/schedules/": "工期管理",
  "src/components/schedules/": "工期管理",
  "src/components/schedules/ScheduleGantt": "ガントチャート",
  "src/components/schedules/GanttBar": "ガントチャート",
  "src/components/schedules/GanttDateHeader": "ガントチャート",
  "src/components/schedules/GanttToolbar": "ガントチャート",
  "src/components/schedules/GroupDetailModal": "工程グループ詳細",
  "src/components/schedules/ScheduleCalendar": "カレンダー",
  "src/app/(app)/worker-assignments/": "人員配置",
  "src/components/worker-assignments/": "人員配置",
  "src/components/worker-assignments/WorkerAssignmentTable": "配置表",
  "src/components/worker-assignments/WorkerAssignmentView": "配置ビュー",
  "src/components/worker-assignments/SiteViewTable": "現場ビュー",
  "src/components/worker-assignments/AssignmentDetailPanel": "配置詳細",
  "src/app/(app)/invoices/": "請求管理",
  "src/components/invoices/": "請求管理",
  "src/app/(app)/payments/": "入金管理",
  "src/components/payments/": "入金管理",
  "src/app/(app)/subcontractor-payments/": "支払管理",
  "src/components/subcontractor-payments/": "支払管理",
  "src/app/(app)/notifications/": "通知",
  "src/app/(app)/templates/": "テンプレ管理",
  "src/app/(app)/masters/": "マスター管理",
  "src/components/masters/": "マスター管理",
  "src/app/(app)/settings/": "設定",
  "src/components/settings/": "設定",
  "src/components/layout/Sidebar": "サイドバー",
  "src/components/site-operations/SiteOpsDialog": "現場詳細ダイアログ",
  "src/components/site-operations/": "現場詳細",
  "src/components/workers/": "作業員",
  "src/app/(accounting)/": "経理システム",
  "src/components/accounting/etc/": "ETC管理",
  "src/components/accounting/fuel/": "ガソリン管理",
  "src/components/accounting/masters/": "経理マスター",
  "src/components/accounting/layout/": "経理レイアウト",
  "prisma/schema.prisma": "データベース定義",
  "src/app/(print)/": "印刷",
}

function detectPages(files: string[]): string[] {
  const pages = new Set<string>()
  for (const file of files) {
    // 長いパスから先にマッチさせる（より具体的なマッチを優先）
    const sortedKeys = Object.keys(FILE_TO_PAGE_MAP).sort((a, b) => b.length - a.length)
    for (const pattern of sortedKeys) {
      if (file.includes(pattern) || file.startsWith(pattern)) {
        pages.add(FILE_TO_PAGE_MAP[pattern])
        break
      }
    }
  }
  return Array.from(pages)
}

// コミットメッセージからカテゴリを判別
function detectCategory(message: string): string {
  if (message.startsWith("feat:") || message.startsWith("feat(")) return "feature"
  if (message.startsWith("fix:") || message.startsWith("fix(")) return "fix"
  if (message.startsWith("refactor:") || message.startsWith("refactor(")) return "refactor"
  if (message.startsWith("style:") || message.startsWith("style(")) return "style"
  if (message.startsWith("docs:") || message.startsWith("docs(")) return "docs"
  if (message.startsWith("chore:") || message.startsWith("chore(")) return "chore"
  if (message.startsWith("perf:") || message.startsWith("perf(")) return "perf"
  if (message.startsWith("test:") || message.startsWith("test(")) return "test"
  // 日本語のキーワードで判別
  if (message.includes("追加") || message.includes("新規") || message.includes("実装")) return "feature"
  if (message.includes("修正") || message.includes("fix") || message.includes("バグ")) return "fix"
  if (message.includes("改善") || message.includes("向上") || message.includes("変更")) return "improvement"
  if (message.includes("リファクタ") || message.includes("統一") || message.includes("整理")) return "refactor"
  return "other"
}

export async function GET(request: NextRequest) {
  // 開発環境のみ許可
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 300)

  try {
    // git log で履歴を取得（ハッシュ、日付、著者名、メッセージ、変更ファイル）
    const { stdout } = await execAsync(
      `git log --pretty=format:'__COMMIT__%H|%ai|%an|%ae|%s' --name-only -n ${limit}`,
      { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 5 }
    )

    const commits: Array<{
      hash: string
      date: string
      time: string
      author: string
      authorEmail: string
      message: string
      category: string
      files: string[]
      pages: string[]
    }> = []

    const rawCommits = stdout.split("__COMMIT__").filter(Boolean)
    for (const raw of rawCommits) {
      const lines = raw.trim().split("\n")
      const headerLine = lines[0]
      const [hash, dateStr, authorName, authorEmail, ...messageParts] = headerLine.split("|")
      const message = messageParts.join("|")
      const files = lines.slice(1).filter((f) => f.trim() !== "")
      const pages = detectPages(files)
      const category = detectCategory(message)

      // 日本時間（JST）に変換
      const commitDate = new Date(dateStr)
      const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
        hour12: false,
      })
      const jstParts = jstFormatter.formatToParts(commitDate)
      const p = (type: string) => jstParts.find((x) => x.type === type)?.value ?? "00"
      const jstDateStr = `${p("year")}-${p("month")}-${p("day")}`
      const jstTimeStr = `${p("hour")}:${p("minute")}`

      commits.push({
        hash: hash.substring(0, 8),
        date: jstDateStr,
        time: jstTimeStr,
        author: authorName || "",
        authorEmail: authorEmail || "",
        message,
        category,
        files,
        pages,
      })
    }

    return NextResponse.json({ commits })
  } catch {
    return NextResponse.json({ error: "Failed to fetch git log" }, { status: 500 })
  }
}
