import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 日本の祝日（2025〜2027年の主要祝日）
const HOLIDAYS = new Set([
  // 2025
  "2025-01-01","2025-01-13","2025-02-11","2025-02-23","2025-02-24","2025-03-20",
  "2025-04-29","2025-05-03","2025-05-04","2025-05-05","2025-05-06",
  "2025-07-21","2025-08-11","2025-09-15","2025-09-23","2025-10-13",
  "2025-11-03","2025-11-23","2025-11-24",
  // 2026
  "2026-01-01","2026-01-12","2026-02-11","2026-02-23","2026-03-20",
  "2026-04-29","2026-05-03","2026-05-04","2026-05-05","2026-05-06",
  "2026-07-20","2026-08-11","2026-09-21","2026-09-22","2026-09-23",
  "2026-10-12","2026-11-03","2026-11-23",
  // 2027
  "2027-01-01","2027-01-11","2027-02-11","2027-02-23","2027-03-21",
  "2027-04-29","2027-05-03","2027-05-04","2027-05-05",
  "2027-07-19","2027-08-11","2027-09-20","2027-09-23","2027-10-11",
  "2027-11-03","2027-11-23",
])

function isHoliday(date: Date): boolean {
  const key = date.toISOString().slice(0, 10)
  return HOLIDAYS.has(key)
}

/**
 * GET /api/accounting/etc/alerts
 * パラメータ:
 *   from: YYYY-MM-DD（開始日）
 *   to: YYYY-MM-DD（終了日）
 *   months: 月数（fromが無い場合のフォールバック、デフォルト1）
 *   threshold: 高額利用の閾値（デフォルト5000）
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const fromParam = searchParams.get("from")
  const toParam = searchParams.get("to")
  const months = parseInt(searchParams.get("months") ?? "1") || 1
  const threshold = parseInt(searchParams.get("threshold") ?? "5000") || 5000

  // 対象期間を決定
  let fromDate: Date
  let toDate: Date

  if (fromParam && toParam) {
    fromDate = new Date(fromParam)
    toDate = new Date(toParam + "T23:59:59")
  } else if (fromParam) {
    fromDate = new Date(fromParam)
    toDate = new Date()
  } else {
    const now = new Date()
    fromDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    toDate = now
  }

  // 対象月リスト
  const targetMonths: string[] = []
  const cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1)
  const endMonth = new Date(toDate.getFullYear(), toDate.getMonth(), 1)
  while (cur <= endMonth) {
    targetMonths.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`)
    cur.setMonth(cur.getMonth() + 1)
  }

  // 過去データ用（first_ic判定 + 個人平均計算）
  const historyMonths: string[] = []
  const histStart = new Date(fromDate.getFullYear(), fromDate.getMonth() - 3, 1)
  const histEnd = new Date(fromDate.getFullYear(), fromDate.getMonth() - 1, 1)
  const histCur = new Date(histStart)
  while (histCur <= histEnd) {
    historyMonths.push(`${histCur.getFullYear()}-${String(histCur.getMonth() + 1).padStart(2, "0")}`)
    histCur.setMonth(histCur.getMonth() + 1)
  }

  // データ取得
  const [records, knownICs, cards] = await Promise.all([
    prisma.etcRecord.findMany({
      where: { yearMonth: { in: [...targetMonths, ...historyMonths] } },
      orderBy: { usageDate: "desc" },
    }),
    prisma.highwayIC.findMany(),
    prisma.etcCard.findMany({ include: { vehicle: true, driver: true } }),
  ])

  const cardMap = Object.fromEntries(cards.map((c) => [c.cardNumber, c]))
  const knownICNames = new Set(knownICs.map((ic) => ic.name))
  const knownICBaseNames = new Set(knownICs.map((ic) => ic.name.replace(/(IC|JCT|出入口|PA\/SIC|SIC|スマートIC)$/, "")))

  function isKnownIC(name: string): boolean {
    if (!name) return true
    if (knownICNames.has(name)) return true
    const baseName = name.replace(/(IC|JCT|出入口|PA\/SIC|SIC|スマートIC|入口|出口)$/, "").trim()
    if (knownICBaseNames.has(baseName)) return true
    for (const known of knownICBaseNames) {
      if (known && baseName.includes(known)) return true
      if (known && known.includes(baseName) && baseName.length >= 2) return true
    }
    return false
  }

  // 日付範囲内のレコードのみ
  const targetRecords = records.filter((r) => {
    if (!targetMonths.includes(r.yearMonth)) return false
    const d = new Date(r.usageDate)
    return d >= fromDate && d <= toDate
  })
  const historyRecords = records.filter((r) => historyMonths.includes(r.yearMonth))

  function makeRecord(r: typeof records[0]) {
    const card = cardMap[r.cardNumber]
    return {
      id: r.id,
      usageDate: r.usageDate,
      amount: Number(r.amount),
      cardNumber: r.cardNumber,
      destinationName: r.destinationName,
      usageType: r.usageType,
      plateNumber: r.plateNumber,
      vehicleName: card?.vehicle?.nickname ?? card?.vehicle?.plateNumber ?? r.cardNumber,
      driverName: card?.driver?.name ?? "不明",
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alerts: any[] = []

  // --- 1. unknown_ic: ICマスターに未登録のIC ---
  if (knownICs.length > 0) {
    for (const r of targetRecords) {
      if (r.destinationName && !isKnownIC(r.destinationName)) {
        alerts.push({
          type: "unknown_ic",
          severity: "warning",
          title: "未登録ICの利用",
          description: `「${r.destinationName}」はICマスターに登録されていません`,
          record: makeRecord(r),
        })
      }
    }
  }

  // --- 2. high_amount: 高額利用 ---
  for (const r of targetRecords) {
    if (Number(r.amount) >= threshold) {
      alerts.push({
        type: "high_amount",
        severity: "warning",
        title: "高額利用",
        description: `${Number(r.amount).toLocaleString()}円（閾値: ${threshold.toLocaleString()}円）`,
        record: makeRecord(r),
      })
    }
  }

  // --- 3. unusual_time: 休日・祝日・深夜利用 ---
  for (const r of targetRecords) {
    const d = new Date(r.usageDate)
    const day = d.getDay()
    const hour = d.getHours()
    const isSunday = day === 0
    const isSaturday = day === 6
    const isHol = isHoliday(d)
    const isLateNight = hour >= 22 || hour < 6

    if (isSunday || isSaturday || isHol || isLateNight) {
      const reasons: string[] = []
      if (isSunday) reasons.push("日曜")
      else if (isSaturday) reasons.push("土曜")
      if (isHol) reasons.push("祝日")
      if (isLateNight) reasons.push("深夜")
      const reason = reasons.join("・") + "利用"

      alerts.push({
        type: "unusual_time",
        severity: isSunday || isHol ? "warning" : "info",
        title: reason,
        description: `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} の利用`,
        record: makeRecord(r),
      })
    }
  }

  // --- 4. first_ic: ドライバー初めてのIC ---
  const historyICsByCard = new Map<string, Set<string>>()
  for (const r of historyRecords) {
    if (!r.destinationName) continue
    const set = historyICsByCard.get(r.cardNumber) ?? new Set()
    set.add(r.destinationName)
    historyICsByCard.set(r.cardNumber, set)
  }

  if (historyRecords.length > 0) {
    for (const r of targetRecords) {
      if (!r.destinationName) continue
      const pastICs = historyICsByCard.get(r.cardNumber)
      if (pastICs && pastICs.size > 0 && !pastICs.has(r.destinationName)) {
        const isAlsoHighAmount = Number(r.amount) >= threshold
        alerts.push({
          type: "first_ic",
          severity: isAlsoHighAmount ? "warning" : "info",
          title: isAlsoHighAmount ? "初めての行先 + 高額" : "初めての行先",
          description: `「${r.destinationName}」は過去3ヶ月で初めての利用${isAlsoHighAmount ? `（${Number(r.amount).toLocaleString()}円）` : ""}`,
          record: makeRecord(r),
        })
      }
    }
  }

  // --- 5. high_frequency: 1日に同カード5回以上 ---
  const dailyCount = new Map<string, number>()
  for (const r of targetRecords) {
    const dateKey = `${r.cardNumber}_${new Date(r.usageDate).toISOString().slice(0, 10)}`
    dailyCount.set(dateKey, (dailyCount.get(dateKey) ?? 0) + 1)
  }
  const flaggedDays = new Set<string>()
  for (const [key, count] of dailyCount) {
    if (count >= 5 && !flaggedDays.has(key)) {
      flaggedDays.add(key)
      const [cardNumber, date] = key.split("_")
      const card = cardMap[cardNumber]
      alerts.push({
        type: "high_frequency",
        severity: "warning",
        title: "高頻度利用",
        description: `${date} に ${count}回の利用`,
        record: {
          id: key,
          usageDate: new Date(date),
          amount: 0,
          cardNumber,
          destinationName: null,
          usageType: null,
          plateNumber: null,
          vehicleName: card?.vehicle?.nickname ?? card?.vehicle?.plateNumber ?? cardNumber,
          driverName: card?.driver?.name ?? "不明",
        },
      })
    }
  }

  // --- 6. monthly_spike: 月間前月比150%以上 ---
  if (targetMonths.length >= 1 && historyMonths.length >= 1) {
    const prevMonth = historyMonths[historyMonths.length - 1]
    const currentByCardMonth = new Map<string, Map<string, number>>()
    const prevByCard = new Map<string, number>()

    for (const r of records) {
      if (targetMonths.includes(r.yearMonth)) {
        const byCard = currentByCardMonth.get(r.yearMonth) ?? new Map()
        byCard.set(r.cardNumber, (byCard.get(r.cardNumber) ?? 0) + Number(r.amount))
        currentByCardMonth.set(r.yearMonth, byCard)
      }
      if (r.yearMonth === prevMonth) {
        prevByCard.set(r.cardNumber, (prevByCard.get(r.cardNumber) ?? 0) + Number(r.amount))
      }
    }

    for (const [ym, byCard] of currentByCardMonth) {
      for (const [cardNumber, current] of byCard) {
        const prev = prevByCard.get(cardNumber) ?? 0
        if (prev > 0 && current >= prev * 1.5) {
          const card = cardMap[cardNumber]
          const ratio = Math.round((current / prev) * 100)
          alerts.push({
            type: "monthly_spike",
            severity: "warning",
            title: "月間利用額急増",
            description: `${ym}: ${current.toLocaleString()}円（前月比${ratio}%）`,
            record: {
              id: `spike_${cardNumber}_${ym}`,
              usageDate: new Date(ym + "-15"),
              amount: current,
              cardNumber,
              destinationName: null,
              usageType: null,
              plateNumber: null,
              vehicleName: card?.vehicle?.nickname ?? card?.vehicle?.plateNumber ?? cardNumber,
              driverName: card?.driver?.name ?? "不明",
            },
          })
        }
      }
    }
  }

  // --- 7. above_personal_avg: 個人平均の2倍以上 ---
  const histAvgByCard = new Map<string, number>()
  const histCountByCard = new Map<string, number>()
  for (const r of historyRecords) {
    histAvgByCard.set(r.cardNumber, (histAvgByCard.get(r.cardNumber) ?? 0) + Number(r.amount))
    histCountByCard.set(r.cardNumber, (histCountByCard.get(r.cardNumber) ?? 0) + 1)
  }
  for (const [cn, total] of histAvgByCard) {
    histAvgByCard.set(cn, total / (histCountByCard.get(cn) ?? 1))
  }

  if (historyRecords.length > 0) {
    for (const r of targetRecords) {
      const avg = histAvgByCard.get(r.cardNumber)
      if (avg && avg > 0 && Number(r.amount) >= avg * 2.5) {
        alerts.push({
          type: "above_avg",
          severity: "warning",
          title: "個人平均大幅超過",
          description: `${Number(r.amount).toLocaleString()}円（過去平均: ${Math.round(avg).toLocaleString()}円の${Math.round(Number(r.amount) / avg * 100)}%）`,
          record: makeRecord(r),
        })
      }
    }
  }

  // severity順でソート（warning > info）、同severity内は日付降順
  alerts.sort((a, b) => {
    const sevOrder = { warning: 0, info: 1 }
    const sa = sevOrder[a.severity as keyof typeof sevOrder] ?? 2
    const sb = sevOrder[b.severity as keyof typeof sevOrder] ?? 2
    if (sa !== sb) return sa - sb
    return new Date(b.record.usageDate).getTime() - new Date(a.record.usageDate).getTime()
  })

  return NextResponse.json({
    alerts,
    summary: {
      total: alerts.length,
      unknown_ic: alerts.filter((a) => a.type === "unknown_ic").length,
      high_amount: alerts.filter((a) => a.type === "high_amount").length,
      unusual_time: alerts.filter((a) => a.type === "unusual_time").length,
      first_ic: alerts.filter((a) => a.type === "first_ic").length,
      high_frequency: alerts.filter((a) => a.type === "high_frequency").length,
      monthly_spike: alerts.filter((a) => a.type === "monthly_spike").length,
      above_avg: alerts.filter((a) => a.type === "above_avg").length,
    },
    icMasterCount: knownICs.length,
    period: { from: fromDate.toISOString(), to: toDate.toISOString() },
  })
}
