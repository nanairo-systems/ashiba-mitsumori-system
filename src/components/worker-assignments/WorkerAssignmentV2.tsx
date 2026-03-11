/**
 * [COMPONENT] 人員配置管理 V2
 *
 * 新デザインシステム（rounded-sm / border-2 / font-extrabold / active:scale-95）対応。
 * 開発用モックデータで動作する独立版。DB接続不要。
 */
"use client"

import { useState, useMemo, useCallback } from "react"
import {
  Users, Building2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  CalendarDays, Plus, Truck, HardHat, MapPin, Phone, UserCheck, UserX,
  ChevronDown, ChevronUp, Wrench, Search, X, Eye, EyeOff,
  AlertTriangle, Shield, Clock,
} from "lucide-react"
import { format, addDays, isSameDay, isWeekend, isToday } from "date-fns"
import { ja } from "date-fns/locale"

// ─── モックデータ型定義 ────────────────────────────────

type WorkerType = "EMPLOYEE" | "INDEPENDENT" | "SUBCONTRACTOR"
type AssignedRole = "FOREMAN" | "WORKER"
type WorkType = "ASSEMBLY" | "DISASSEMBLY" | "REWORK"

interface MockTeam {
  id: string
  name: string
  colorCode: string
}

interface MockWorker {
  id: string
  name: string
  workerType: WorkerType
  driverLicenseType: string
  phone?: string
}

interface MockSite {
  id: string
  name: string
  address: string
  companyName: string
  workType: WorkType
}

interface MockAssignment {
  id: string
  teamId: string
  siteId: string
  workerId: string
  assignedRole: AssignedRole
  dateKey: string // yyyy-MM-dd
}

// ─── モックデータ ──────────────────────────────────────

const MOCK_TEAMS: MockTeam[] = [
  { id: "t1", name: "1班", colorCode: "#3b82f6" },
  { id: "t2", name: "2班", colorCode: "#f59e0b" },
  { id: "t3", name: "3班", colorCode: "#10b981" },
  { id: "t4", name: "4班", colorCode: "#8b5cf6" },
  { id: "t5", name: "5班", colorCode: "#ef4444" },
]

const MOCK_WORKERS: MockWorker[] = [
  { id: "w1", name: "田中太郎", workerType: "EMPLOYEE", driverLicenseType: "LARGE", phone: "090-1234-5678" },
  { id: "w2", name: "鈴木一郎", workerType: "EMPLOYEE", driverLicenseType: "MEDIUM", phone: "090-2345-6789" },
  { id: "w3", name: "佐藤健", workerType: "EMPLOYEE", driverLicenseType: "SEMI_LARGE" },
  { id: "w4", name: "山田花子", workerType: "EMPLOYEE", driverLicenseType: "SMALL" },
  { id: "w5", name: "高橋修", workerType: "EMPLOYEE", driverLicenseType: "LARGE" },
  { id: "w6", name: "グエン・ヴァン", workerType: "EMPLOYEE", driverLicenseType: "NONE" },
  { id: "w7", name: "ファム・ティ", workerType: "EMPLOYEE", driverLicenseType: "NONE" },
  { id: "w8", name: "中村正義", workerType: "INDEPENDENT", driverLicenseType: "LARGE", phone: "080-3456-7890" },
  { id: "w9", name: "木村大輔", workerType: "INDEPENDENT", driverLicenseType: "MEDIUM" },
  { id: "w10", name: "松本勇気", workerType: "INDEPENDENT", driverLicenseType: "SEMI_LARGE" },
  { id: "w11", name: "渡辺組・伊藤", workerType: "SUBCONTRACTOR", driverLicenseType: "LARGE" },
  { id: "w12", name: "渡辺組・小林", workerType: "SUBCONTRACTOR", driverLicenseType: "MEDIUM" },
  { id: "w13", name: "斎藤建設・佐々木", workerType: "SUBCONTRACTOR", driverLicenseType: "NONE" },
  { id: "w14", name: "斎藤建設・加藤", workerType: "SUBCONTRACTOR", driverLicenseType: "SMALL" },
  { id: "w15", name: "伊藤直樹", workerType: "EMPLOYEE", driverLicenseType: "LARGE" },
]

const MOCK_SITES: MockSite[] = [
  { id: "s1", name: "ABC商業ビル新築工事", address: "名古屋市中区栄3-1-1", companyName: "ABC建設", workType: "ASSEMBLY" },
  { id: "s2", name: "名駅前マンション改修", address: "名古屋市中村区名駅4-2-3", companyName: "大和ハウス", workType: "ASSEMBLY" },
  { id: "s3", name: "栄地下街解体工事", address: "名古屋市中区栄1-5-10", companyName: "栄開発", workType: "DISASSEMBLY" },
  { id: "s4", name: "豊田工場増築", address: "豊田市トヨタ町1番地", companyName: "トヨタ自動車", workType: "ASSEMBLY" },
  { id: "s5", name: "岡崎市民病院外構", address: "岡崎市高隆寺町5-1", companyName: "岡崎市", workType: "REWORK" },
  { id: "s6", name: "刈谷駅前再開発A棟", address: "刈谷市桜町1-46", companyName: "刈谷市", workType: "ASSEMBLY" },
  { id: "s7", name: "安城倉庫解体", address: "安城市三河安城町1-2", companyName: "安城物流", workType: "DISASSEMBLY" },
  { id: "s8", name: "知立マンション新築", address: "知立市堀切3-10", companyName: "積水ハウス", workType: "ASSEMBLY" },
]

function generateMockAssignments(): MockAssignment[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const assignments: MockAssignment[] = []
  let id = 1

  // 各チーム・日ごとに現場と作業員を配置
  const teamSiteMap: Record<string, string[]> = {
    t1: ["s1", "s2"], t2: ["s3", "s4"], t3: ["s5", "s6"], t4: ["s7", "s8"], t5: ["s1", "s6"],
  }
  const teamWorkerMap: Record<string, string[]> = {
    t1: ["w1", "w2", "w3", "w6"], t2: ["w4", "w5", "w7"], t3: ["w8", "w9", "w13"],
    t4: ["w10", "w11", "w12"], t5: ["w14", "w15"],
  }

  for (let dayOffset = -2; dayOffset <= 12; dayOffset++) {
    const date = addDays(today, dayOffset)
    if (isWeekend(date)) continue
    const dateKey = format(date, "yyyy-MM-dd")

    for (const [teamId, siteIds] of Object.entries(teamSiteMap)) {
      const workers = teamWorkerMap[teamId] ?? []
      for (const siteId of siteIds) {
        // 職長は最初の作業員
        if (workers[0]) {
          assignments.push({ id: `a${id++}`, teamId, siteId, workerId: workers[0], assignedRole: "FOREMAN", dateKey })
        }
        // 残りは職人
        for (let i = 1; i < workers.length; i++) {
          // 2番目の現場には一部のみ配置
          if (siteIds.indexOf(siteId) === 1 && i > 1) continue
          assignments.push({ id: `a${id++}`, teamId, siteId, workerId: workers[i], assignedRole: "WORKER", dateKey })
        }
      }
    }
  }
  return assignments
}

const MOCK_ASSIGNMENTS = generateMockAssignments()

// ─── 定数 ──────────────────────────────────────────────

const WORK_TYPE_CONFIG: Record<WorkType, { label: string; color: string; bg: string; border: string }> = {
  ASSEMBLY:    { label: "組立", color: "text-blue-700",  bg: "bg-blue-50",  border: "border-blue-300" },
  DISASSEMBLY: { label: "解体", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-300" },
  REWORK:      { label: "その他", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-300" },
}

const WORKER_TYPE_CONFIG: Record<WorkerType, { label: string; bg: string; text: string; helmet: string }> = {
  EMPLOYEE:      { label: "社員", bg: "bg-green-500", text: "text-white", helmet: "#16a34a" },
  INDEPENDENT:   { label: "一人親方", bg: "bg-yellow-500", text: "text-slate-900", helmet: "#ca8a04" },
  SUBCONTRACTOR: { label: "協力会社", bg: "bg-slate-200", text: "text-slate-700", helmet: "#9ca3af" },
}

const LICENSE_LABEL: Record<string, string> = {
  LARGE: "大型", MEDIUM: "中型", SEMI_LARGE: "準中型", SMALL: "普通", NONE: "",
}

const DISPLAY_DAYS_OPTIONS = [4, 7, 14, 21] as const

// ─── メインコンポーネント ───────────────────────────────

export function WorkerAssignmentV2() {
  const [rangeStart, setRangeStart] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [displayDays, setDisplayDays] = useState(7)
  const [viewMode, setViewMode] = useState<"team" | "site">("team")
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set(MOCK_TEAMS.map(t => t.id)))
  const [search, setSearch] = useState("")
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [showUnassigned, setShowUnassigned] = useState(true)

  // 日付配列
  const dates = useMemo(() => {
    return Array.from({ length: displayDays }, (_, i) => addDays(rangeStart, i))
  }, [rangeStart, displayDays])

  // 集計
  const stats = useMemo(() => {
    const todayKey = format(new Date(), "yyyy-MM-dd")
    const todayAssignments = MOCK_ASSIGNMENTS.filter(a => a.dateKey === todayKey)
    const assignedWorkerIds = new Set(todayAssignments.map(a => a.workerId))
    const assignedSiteIds = new Set(todayAssignments.map(a => a.siteId))
    return {
      totalTeams: MOCK_TEAMS.length,
      totalWorkers: MOCK_WORKERS.length,
      assignedWorkers: assignedWorkerIds.size,
      unassignedWorkers: MOCK_WORKERS.length - assignedWorkerIds.size,
      activeSites: assignedSiteIds.size,
    }
  }, [])

  // フィルタ済みチーム
  const filteredTeams = useMemo(() => {
    if (!search) return MOCK_TEAMS
    const q = search.toLowerCase()
    return MOCK_TEAMS.filter(t => {
      if (t.name.toLowerCase().includes(q)) return true
      // チームに所属する現場名で検索
      const teamSites = MOCK_ASSIGNMENTS.filter(a => a.teamId === t.id).map(a => MOCK_SITES.find(s => s.id === a.siteId))
      return teamSites.some(s => s?.name.toLowerCase().includes(q) || s?.companyName.toLowerCase().includes(q))
    })
  }, [search])

  // 未配置作業員
  const unassignedWorkers = useMemo(() => {
    const todayKey = format(new Date(), "yyyy-MM-dd")
    const assignedIds = new Set(MOCK_ASSIGNMENTS.filter(a => a.dateKey === todayKey).map(a => a.workerId))
    return MOCK_WORKERS.filter(w => !assignedIds.has(w.id))
  }, [])

  const toggleTeam = useCallback((teamId: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }, [])

  const shiftByDays = useCallback((n: number) => {
    setRangeStart(prev => addDays(prev, n))
  }, [])

  const goToToday = useCallback(() => {
    const d = new Date(); d.setHours(0,0,0,0)
    setRangeStart(d)
  }, [])

  return (
    <div className="space-y-4">
      {/* ── ヘッダー ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              人員配置管理
              <span className="px-2.5 py-1 rounded-sm text-xs font-bold bg-blue-100 text-blue-700">V2</span>
            </h1>
            <p className="text-sm font-bold text-slate-500 mt-1">
              班ごとの作業員配置をカレンダー形式で管理
            </p>
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-sm bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200">
            <Plus className="w-4 h-4" />
            現場を追加
          </button>
        </div>

        {/* ── ツールバー ── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* ビュー切り替え */}
          <div className="flex items-center bg-slate-100 rounded-sm p-0.5">
            <button
              onClick={() => setViewMode("team")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold transition-all active:scale-95 ${
                viewMode === "team" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              班ビュー
            </button>
            <button
              onClick={() => setViewMode("site")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold transition-all active:scale-95 ${
                viewMode === "site" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              現場ビュー
            </button>
          </div>

          {/* 期間ナビゲーション */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-extrabold text-slate-800">
              {format(rangeStart, "yyyy年M月", { locale: ja })}
            </span>
            <button onClick={() => shiftByDays(-7)} className="w-8 h-8 flex items-center justify-center rounded-sm border-2 border-slate-300 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button onClick={() => shiftByDays(-1)} className="w-8 h-8 flex items-center justify-center rounded-sm border-2 border-slate-300 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-500 min-w-[80px] text-center">
              {format(rangeStart, "M/d", { locale: ja })}〜{format(addDays(rangeStart, displayDays - 1), "M/d", { locale: ja })}
            </span>
            <button onClick={() => shiftByDays(1)} className="w-8 h-8 flex items-center justify-center rounded-sm border-2 border-slate-300 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => shiftByDays(7)} className="w-8 h-8 flex items-center justify-center rounded-sm border-2 border-slate-300 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">
              <ChevronsRight className="w-4 h-4" />
            </button>
            <button onClick={goToToday} className="flex items-center gap-1 px-3 py-1.5 rounded-sm border-2 border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">
              <CalendarDays className="w-3.5 h-3.5" />
              今日
            </button>
          </div>

          {/* 表示日数 */}
          <div className="flex items-center bg-slate-100 rounded-sm p-0.5">
            {DISPLAY_DAYS_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => setDisplayDays(d)}
                className={`px-2.5 py-1 rounded-sm text-xs font-bold transition-all active:scale-95 ${
                  displayDays === d ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {d}日
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── サマリーカード ── */}
      <div className="grid grid-cols-5 gap-3">
        <SummaryCard label="稼働班" value={stats.totalTeams} icon={<Users className="w-5 h-5" />} color="blue" />
        <SummaryCard label="総作業員" value={stats.totalWorkers} icon={<HardHat className="w-5 h-5" />} color="slate" />
        <SummaryCard label="配置済み" value={stats.assignedWorkers} icon={<UserCheck className="w-5 h-5" />} color="green" />
        <SummaryCard label="未配置" value={stats.unassignedWorkers} icon={<UserX className="w-5 h-5" />} color="amber" />
        <SummaryCard label="稼働現場" value={stats.activeSites} icon={<Building2 className="w-5 h-5" />} color="purple" />
      </div>

      {/* ── 検索バー ── */}
      <div className="relative">
        <Search className="absolute left-4 w-5 h-5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="班名・現場名・会社名で検索..."
          className="w-full pl-12 pr-10 py-3 rounded-sm text-base border-2 border-slate-200 font-bold placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-blue-400 transition-all bg-white"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-sm hover:bg-slate-100 active:scale-95 transition-all"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      {/* ── メインコンテンツ ── */}
      {viewMode === "team" ? (
        <TeamView
          teams={filteredTeams}
          dates={dates}
          expandedTeams={expandedTeams}
          onToggleTeam={toggleTeam}
          selectedSiteId={selectedSiteId}
          onSelectSite={setSelectedSiteId}
        />
      ) : (
        <SiteView
          dates={dates}
          selectedSiteId={selectedSiteId}
          onSelectSite={setSelectedSiteId}
        />
      )}

      {/* ── 未配置作業員バー ── */}
      <div className="bg-white rounded-sm border-2 border-slate-300">
        <button
          onClick={() => setShowUnassigned(prev => !prev)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 active:opacity-90 transition-colors"
        >
          {showUnassigned ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
          <span className="text-sm font-extrabold text-slate-700">未配置の作業員</span>
          <span className="px-2.5 py-0.5 rounded-sm text-xs font-bold bg-amber-100 text-amber-700">{unassignedWorkers.length}名</span>
          <span className="ml-auto">
            {showUnassigned ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </span>
        </button>
        {showUnassigned && (
          <div className="px-4 pb-4 border-t-2 border-slate-200 pt-3">
            {unassignedWorkers.length === 0 ? (
              <p className="text-sm font-bold text-slate-400 text-center py-4">全員配置済み</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {unassignedWorkers.map(w => (
                  <WorkerBadgeV2 key={w.id} worker={w} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── サマリーカード ─────────────────────────────────────

const SUMMARY_COLORS = {
  blue:   { bg: "bg-blue-50", border: "border-blue-300", num: "text-blue-700", icon: "text-blue-500", label: "text-blue-600" },
  green:  { bg: "bg-green-50", border: "border-green-300", num: "text-green-700", icon: "text-green-500", label: "text-green-600" },
  amber:  { bg: "bg-amber-50", border: "border-amber-300", num: "text-amber-700", icon: "text-amber-500", label: "text-amber-600" },
  purple: { bg: "bg-purple-50", border: "border-purple-300", num: "text-purple-700", icon: "text-purple-500", label: "text-purple-600" },
  slate:  { bg: "bg-slate-50", border: "border-slate-300", num: "text-slate-700", icon: "text-slate-500", label: "text-slate-600" },
}

function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: keyof typeof SUMMARY_COLORS }) {
  const c = SUMMARY_COLORS[color]
  return (
    <div className={`rounded-sm p-4 border-2 ${c.border} ${c.bg}`}>
      <div className="flex items-center gap-2">
        <span className={c.icon}>{icon}</span>
        <span className={`text-3xl font-black tabular-nums ${c.num}`}>{value}</span>
      </div>
      <div className={`text-sm font-bold mt-1 ${c.label}`}>{label}</div>
    </div>
  )
}

// ─── 班ビュー ───────────────────────────────────────────

function TeamView({ teams, dates, expandedTeams, onToggleTeam, selectedSiteId, onSelectSite }: {
  teams: MockTeam[]
  dates: Date[]
  expandedTeams: Set<string>
  onToggleTeam: (id: string) => void
  selectedSiteId: string | null
  onSelectSite: (id: string | null) => void
}) {
  return (
    <div className="space-y-3">
      {/* 日付ヘッダー */}
      <div className="flex gap-0">
        <div className="w-[180px] shrink-0" />
        <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>
          {dates.map(date => {
            const isToday_ = isToday(date)
            const isWeekend_ = isWeekend(date)
            return (
              <div
                key={date.toISOString()}
                className={`text-center py-2 border-r border-slate-200 last:border-r-0 ${
                  isToday_ ? "bg-blue-50 border-b-2 border-b-blue-500" :
                  isWeekend_ ? "bg-red-50/50" : "bg-slate-50"
                }`}
              >
                <div className={`text-xs font-bold ${isToday_ ? "text-blue-700" : isWeekend_ ? "text-red-500" : "text-slate-500"}`}>
                  {format(date, "E", { locale: ja })}
                </div>
                <div className={`text-sm font-extrabold ${isToday_ ? "text-blue-700" : isWeekend_ ? "text-red-500" : "text-slate-800"}`}>
                  {format(date, "M/d")}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* チーム行 */}
      {teams.map(team => {
        const isExpanded = expandedTeams.has(team.id)
        return (
          <div key={team.id} className="bg-white rounded-sm border-2 border-slate-300 overflow-hidden">
            {/* チームヘッダー */}
            <button
              onClick={() => onToggleTeam(team.id)}
              className="w-full flex items-center gap-0 hover:bg-slate-50 active:opacity-90 transition-colors"
            >
              <div className="w-[180px] shrink-0 flex items-center gap-2 px-4 py-3 border-r-2 border-slate-200">
                <div className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: team.colorCode }} />
                <span className="text-base font-extrabold text-slate-900">{team.name}</span>
                <span className="ml-auto">
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </span>
              </div>
              {/* 要約行（閉じている時） */}
              {!isExpanded && (
                <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>
                  {dates.map(date => {
                    const dateKey = format(date, "yyyy-MM-dd")
                    const teamAssignments = MOCK_ASSIGNMENTS.filter(a => a.teamId === team.id && a.dateKey === dateKey)
                    const siteIds = [...new Set(teamAssignments.map(a => a.siteId))]
                    const workerCount = teamAssignments.length
                    const isWeekend_ = isWeekend(date)
                    return (
                      <div key={date.toISOString()} className={`flex flex-col items-center justify-center py-2 border-r border-slate-100 last:border-r-0 ${isWeekend_ ? "bg-red-50/30" : ""}`}>
                        {siteIds.length > 0 ? (
                          <>
                            <span className="text-xs font-bold text-slate-600">{siteIds.length}現場</span>
                            <span className="text-xs font-bold text-blue-600">{workerCount}名</span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </button>

            {/* 展開コンテンツ */}
            {isExpanded && (
              <div className="border-t-2 border-slate-200">
                <div className="flex gap-0">
                  <div className="w-[180px] shrink-0" />
                  <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>
                    {dates.map(date => {
                      const dateKey = format(date, "yyyy-MM-dd")
                      const teamAssignments = MOCK_ASSIGNMENTS.filter(a => a.teamId === team.id && a.dateKey === dateKey)
                      const siteGroups = groupBySite(teamAssignments)
                      const isWeekend_ = isWeekend(date)
                      const isToday_ = isToday(date)

                      return (
                        <div
                          key={date.toISOString()}
                          className={`min-h-[120px] p-1.5 border-r border-slate-100 last:border-r-0 ${
                            isToday_ ? "bg-blue-50/30" : isWeekend_ ? "bg-red-50/20" : ""
                          }`}
                        >
                          {siteGroups.length === 0 ? (
                            <div className="h-full flex items-center justify-center">
                              <button className="w-7 h-7 rounded-sm bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600 flex items-center justify-center active:scale-95 transition-all">
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {siteGroups.map(({ site, assignments }) => (
                                <SiteCardV2
                                  key={site.id}
                                  site={site}
                                  assignments={assignments}
                                  teamColor={team.colorCode}
                                  isSelected={selectedSiteId === site.id}
                                  onSelect={() => onSelectSite(selectedSiteId === site.id ? null : site.id)}
                                />
                              ))}
                              <button className="w-full py-1 rounded-sm border-2 border-dashed border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-500 flex items-center justify-center gap-1 text-xs font-bold active:scale-95 transition-all">
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── 現場ビュー ─────────────────────────────────────────

function SiteView({ dates, selectedSiteId, onSelectSite }: {
  dates: Date[]
  selectedSiteId: string | null
  onSelectSite: (id: string | null) => void
}) {
  // 現場ごとにグループ
  const siteRows = useMemo(() => {
    return MOCK_SITES.map(site => {
      const siteAssignments = MOCK_ASSIGNMENTS.filter(a => a.siteId === site.id)
      const teamIds = [...new Set(siteAssignments.map(a => a.teamId))]
      const teams = teamIds.map(tid => MOCK_TEAMS.find(t => t.id === tid)!).filter(Boolean)
      return { site, assignments: siteAssignments, teams }
    }).filter(row => row.assignments.length > 0)
  }, [])

  return (
    <div className="space-y-3">
      {/* 日付ヘッダー */}
      <div className="flex gap-0">
        <div className="w-[220px] shrink-0" />
        <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>
          {dates.map(date => {
            const isToday_ = isToday(date)
            const isWeekend_ = isWeekend(date)
            return (
              <div
                key={date.toISOString()}
                className={`text-center py-2 border-r border-slate-200 last:border-r-0 ${
                  isToday_ ? "bg-blue-50 border-b-2 border-b-blue-500" :
                  isWeekend_ ? "bg-red-50/50" : "bg-slate-50"
                }`}
              >
                <div className={`text-xs font-bold ${isToday_ ? "text-blue-700" : isWeekend_ ? "text-red-500" : "text-slate-500"}`}>
                  {format(date, "E", { locale: ja })}
                </div>
                <div className={`text-sm font-extrabold ${isToday_ ? "text-blue-700" : isWeekend_ ? "text-red-500" : "text-slate-800"}`}>
                  {format(date, "M/d")}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 現場行 */}
      {siteRows.map(({ site, assignments, teams }) => {
        const wtConfig = WORK_TYPE_CONFIG[site.workType]
        const isSelected = selectedSiteId === site.id
        return (
          <div
            key={site.id}
            className={`bg-white rounded-sm border-2 overflow-hidden transition-all ${
              isSelected ? "border-blue-400 ring-2 ring-blue-200" : "border-slate-300"
            }`}
          >
            <div className="flex gap-0">
              {/* 現場情報 */}
              <button
                onClick={() => onSelectSite(isSelected ? null : site.id)}
                className="w-[220px] shrink-0 px-4 py-3 border-r-2 border-slate-200 text-left hover:bg-slate-50 active:opacity-90 transition-colors"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-sm text-xs font-bold ${wtConfig.bg} ${wtConfig.color} border-2 ${wtConfig.border}`}>
                    <Wrench className="w-3 h-3" />
                    {wtConfig.label}
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-slate-900 leading-tight truncate">{site.name}</h4>
                <p className="text-xs font-bold text-slate-500 mt-0.5 truncate">{site.companyName}</p>
                <div className="flex items-center gap-1 mt-1">
                  {teams.map(t => (
                    <span key={t.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-xs font-bold bg-slate-100 text-slate-600">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: t.colorCode }} />
                      {t.name}
                    </span>
                  ))}
                </div>
              </button>

              {/* 日別配置 */}
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>
                {dates.map(date => {
                  const dateKey = format(date, "yyyy-MM-dd")
                  const dayAssignments = assignments.filter(a => a.dateKey === dateKey)
                  const isWeekend_ = isWeekend(date)
                  const isToday_ = isToday(date)
                  const foremanCount = dayAssignments.filter(a => a.assignedRole === "FOREMAN").length
                  const workerCount = dayAssignments.filter(a => a.assignedRole === "WORKER").length

                  return (
                    <div
                      key={date.toISOString()}
                      className={`flex flex-col items-center justify-center py-2 px-1 border-r border-slate-100 last:border-r-0 min-h-[80px] ${
                        isToday_ ? "bg-blue-50/30" : isWeekend_ ? "bg-red-50/20" : ""
                      }`}
                    >
                      {dayAssignments.length > 0 ? (
                        <>
                          {/* 作業員アイコン群 */}
                          <div className="flex flex-wrap justify-center gap-0.5 mb-1">
                            {dayAssignments.slice(0, 6).map(a => {
                              const worker = MOCK_WORKERS.find(w => w.id === a.workerId)
                              if (!worker) return null
                              const wtCfg = WORKER_TYPE_CONFIG[worker.workerType]
                              return (
                                <div
                                  key={a.id}
                                  className={`w-5 h-5 rounded-sm flex items-center justify-center text-[8px] font-extrabold ${
                                    a.assignedRole === "FOREMAN" ? "ring-2 ring-amber-400" : ""
                                  }`}
                                  style={{ backgroundColor: wtCfg.helmet, color: worker.workerType === "SUBCONTRACTOR" ? "#374151" : "#fff" }}
                                  title={`${worker.name}${a.assignedRole === "FOREMAN" ? "（職長）" : ""}`}
                                >
                                  {worker.name.slice(0, 1)}
                                </div>
                              )
                            })}
                            {dayAssignments.length > 6 && (
                              <div className="w-5 h-5 rounded-sm bg-slate-200 flex items-center justify-center text-[8px] font-extrabold text-slate-500">
                                +{dayAssignments.length - 6}
                              </div>
                            )}
                          </div>
                          <div className="text-center">
                            {foremanCount > 0 && (
                              <span className="text-[10px] font-bold text-amber-600 block">職長{foremanCount}</span>
                            )}
                            <span className="text-[10px] font-bold text-slate-600">{workerCount}名</span>
                          </div>
                        </>
                      ) : isWeekend_ ? (
                        <span className="text-xs text-slate-300">休</span>
                      ) : (
                        <button className="w-6 h-6 rounded-sm bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600 flex items-center justify-center active:scale-95 transition-all">
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── 現場カード（班ビュー内） ──────────────────────────

function SiteCardV2({ site, assignments, teamColor, isSelected, onSelect }: {
  site: MockSite
  assignments: MockAssignment[]
  teamColor: string
  isSelected: boolean
  onSelect: () => void
}) {
  const wtConfig = WORK_TYPE_CONFIG[site.workType]
  const foreman = assignments.find(a => a.assignedRole === "FOREMAN")
  const workers = assignments.filter(a => a.assignedRole === "WORKER")
  const foremanWorker = foreman ? MOCK_WORKERS.find(w => w.id === foreman.workerId) : null

  return (
    <div
      onClick={onSelect}
      className={`rounded-sm border-l-[4px] p-1.5 cursor-pointer transition-all ${
        isSelected
          ? "bg-blue-50 border-2 border-blue-400 ring-1 ring-blue-200"
          : `bg-white border border-slate-200 hover:bg-slate-50`
      }`}
      style={{ borderLeftColor: teamColor }}
    >
      {/* 現場名 + 工種 */}
      <div className="flex items-center gap-1 mb-1">
        <span className={`px-1 py-0.5 rounded-sm text-[10px] font-bold ${wtConfig.bg} ${wtConfig.color}`}>
          {wtConfig.label}
        </span>
        <span className="text-xs font-extrabold text-slate-800 truncate leading-tight">{site.name}</span>
      </div>

      {/* 職長 */}
      {foremanWorker && (
        <div className="flex items-center gap-1 mb-1">
          <Shield className="w-3 h-3 text-amber-500" />
          <span className="text-[10px] font-bold text-amber-700">{foremanWorker.name}</span>
        </div>
      )}

      {/* 作業員ヘルメット群 */}
      <div className="flex flex-wrap gap-0.5">
        {workers.map(a => {
          const worker = MOCK_WORKERS.find(w => w.id === a.workerId)
          if (!worker) return null
          const wtCfg = WORKER_TYPE_CONFIG[worker.workerType]
          return (
            <div
              key={a.id}
              className="relative group"
              title={worker.name}
            >
              {/* ヘルメット型 */}
              <div className="flex flex-col items-center">
                <div
                  className="w-[36px] h-[22px] rounded-t-md rounded-b-none flex items-center justify-center text-[9px] font-bold leading-none"
                  style={{
                    backgroundColor: wtCfg.helmet,
                    color: worker.workerType === "SUBCONTRACTOR" ? "#374151" : "#fff",
                    border: worker.workerType === "SUBCONTRACTOR" ? "1.5px solid #d1d5db" : "none",
                    borderBottom: "none",
                  }}
                >
                  {worker.name.slice(0, 2)}
                </div>
                <div className="w-[40px] h-[2px] rounded-sm" style={{ backgroundColor: wtCfg.helmet }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 作業員バッジ（未配置リスト用） ─────────────────────

function WorkerBadgeV2({ worker }: { worker: MockWorker }) {
  const wtCfg = WORKER_TYPE_CONFIG[worker.workerType]
  const license = LICENSE_LABEL[worker.driverLicenseType]

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 rounded-sm border-2 border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer active:scale-95">
      {/* ヘルメットアイコン */}
      <div
        className="w-7 h-7 rounded-sm flex items-center justify-center text-xs font-extrabold shrink-0"
        style={{
          backgroundColor: wtCfg.helmet,
          color: worker.workerType === "SUBCONTRACTOR" ? "#374151" : "#fff",
          border: worker.workerType === "SUBCONTRACTOR" ? "1.5px solid #d1d5db" : "none",
        }}
      >
        {worker.name.slice(0, 1)}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-extrabold text-slate-800 truncate">{worker.name}</div>
        <div className="flex items-center gap-1">
          <span className={`text-[10px] font-bold px-1 py-0 rounded-sm ${wtCfg.bg} ${wtCfg.text}`}>
            {wtCfg.label}
          </span>
          {license && (
            <span className="text-[10px] font-bold px-1 py-0 rounded-sm bg-slate-100 text-slate-600">
              {license}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ユーティリティ ──────────────────────────────────────

function groupBySite(assignments: MockAssignment[]) {
  const map = new Map<string, MockAssignment[]>()
  for (const a of assignments) {
    const arr = map.get(a.siteId) ?? []
    arr.push(a)
    map.set(a.siteId, arr)
  }
  return [...map.entries()].map(([siteId, assigns]) => ({
    site: MOCK_SITES.find(s => s.id === siteId)!,
    assignments: assigns,
  })).filter(g => g.site)
}
