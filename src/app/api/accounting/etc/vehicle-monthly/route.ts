import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/accounting/etc/vehicle-monthly?from=YYYY-MM&to=YYYY-MM
 * 車両×月のクロス集計データを返す（配車履歴対応・店舗付き）
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  // 期間内の月リストを生成
  const months: string[] = []
  if (from && to) {
    const [fy, fm] = from.split("-").map(Number)
    const [ty, tm] = to.split("-").map(Number)
    let cur = new Date(fy, fm - 1, 1)
    const end = new Date(ty, tm - 1, 1)
    while (cur <= end) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`)
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }
  } else {
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    }
  }

  // 車両（カード）× 月の集計
  const records = await prisma.etcRecord.groupBy({
    by: ["yearMonth", "cardNumber"],
    where: { yearMonth: { in: months } },
    _sum: { amount: true },
    _count: true,
  })

  // カード→車両・ドライバー紐付け（ドライバーに部門・店舗を含む）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cards: any[]
  try {
    cards = await prisma.etcCard.findMany({
      include: {
        vehicle: true,
        driver: {
          include: {
            department: { include: { company: true } },
            store: true,
          },
        },
      },
    })
  } catch {
    cards = await prisma.etcCard.findMany({
      include: { vehicle: true, driver: true },
    })
  }
  const cardMap = Object.fromEntries(cards.map((c: any) => [c.cardNumber, c]))

  // 配車履歴を取得（テーブル未作成の場合は空配列）
  let assignments: { cardId: string; startDate: Date; endDate: Date | null; driver: { name: string; department?: { name: string; company: { name: string } } | null; store?: { name: string } | null } }[] = []
  try {
    assignments = await prisma.etcDriverAssignment.findMany({
      include: {
        driver: {
          include: {
            department: { include: { company: true } },
            store: true,
          },
        },
      },
      orderBy: { startDate: "asc" },
    })
  } catch {
    // テーブル未作成
  }

  // カードID→配車履歴マップ
  const assignmentsByCard = new Map<string, typeof assignments>()
  for (const a of assignments) {
    const list = assignmentsByCard.get(a.cardId) ?? []
    list.push(a)
    assignmentsByCard.set(a.cardId, list)
  }

  // ある月にそのカードを使っていたドライバーを配車履歴から判定
  function getDriverForMonth(cardId: string, yearMonth: string, fallbackDriver: { name: string; department?: { name: string; company: { name: string } } | null; store?: { name: string } | null } | null) {
    const cardAssignments = assignmentsByCard.get(cardId)
    if (!cardAssignments || cardAssignments.length === 0) return fallbackDriver

    const [year, month] = yearMonth.split("-").map(Number)
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0, 23, 59, 59)

    // その月に有効だった最新の配車を探す
    for (let i = cardAssignments.length - 1; i >= 0; i--) {
      const a = cardAssignments[i]
      const aStart = new Date(a.startDate)
      const aEnd = a.endDate ? new Date(a.endDate) : new Date(9999, 11, 31)
      if (aStart <= monthEnd && aEnd >= monthStart) {
        return a.driver
      }
    }
    return fallbackDriver
  }

  // 車両キー×ドライバー別にまとめる
  // ドライバーが変わったら別行にする
  const rowMap = new Map<string, {
    rowKey: string
    vehicleKey: string
    vehicleName: string
    plateNumber: string
    driverName: string
    departmentName: string
    storeName: string
    monthly: Record<string, { amount: number; count: number }>
  }>()

  for (const r of records) {
    const card = cardMap[r.cardNumber]
    const plateNumber = card?.vehicle?.plateNumber ?? r.cardNumber
    const vehicleKey = card?.vehicle?.id ?? r.cardNumber
    const vehicleName = card?.vehicle?.nickname ?? card?.vehicle?.plateNumber ?? r.cardNumber
    const cardId = card?.id ?? ""

    const driver = getDriverForMonth(cardId, r.yearMonth, card?.driver ?? null)
    const driverName = driver?.name ?? "未設定"
    const departmentName = driver?.department
      ? `${driver.department.company.name} / ${driver.department.name}`
      : ""
    const storeName = driver?.store?.name ?? ""

    const rowKey = `${vehicleKey}__${driverName}`

    if (!rowMap.has(rowKey)) {
      rowMap.set(rowKey, {
        rowKey,
        vehicleKey,
        vehicleName,
        plateNumber,
        driverName,
        departmentName,
        storeName,
        monthly: {},
      })
    }

    const entry = rowMap.get(rowKey)!
    if (!entry.monthly[r.yearMonth]) {
      entry.monthly[r.yearMonth] = { amount: 0, count: 0 }
    }
    entry.monthly[r.yearMonth].amount += Number(r._sum.amount ?? 0)
    entry.monthly[r.yearMonth].count += r._count
  }

  // 月別合計
  const monthlyTotals: Record<string, number> = {}
  for (const ym of months) {
    monthlyTotals[ym] = 0
  }
  for (const v of rowMap.values()) {
    for (const [ym, data] of Object.entries(v.monthly)) {
      monthlyTotals[ym] = (monthlyTotals[ym] ?? 0) + data.amount
    }
  }

  return NextResponse.json({
    months,
    vehicles: Array.from(rowMap.values()).sort((a, b) =>
      a.plateNumber.localeCompare(b.plateNumber) || a.driverName.localeCompare(b.driverName)
    ),
    monthlyTotals,
  })
}
