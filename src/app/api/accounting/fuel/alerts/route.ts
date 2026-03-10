import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 日本の祝日（2025〜2027年）
const HOLIDAYS = new Set([
  "2025-01-01","2025-01-13","2025-02-11","2025-02-23","2025-02-24","2025-03-20",
  "2025-04-29","2025-05-03","2025-05-04","2025-05-05","2025-05-06",
  "2025-07-21","2025-08-11","2025-09-15","2025-09-23","2025-10-13",
  "2025-11-03","2025-11-23","2025-11-24",
  "2026-01-01","2026-01-12","2026-02-11","2026-02-23","2026-03-20",
  "2026-04-29","2026-05-03","2026-05-04","2026-05-05","2026-05-06",
  "2026-07-20","2026-08-11","2026-09-21","2026-09-22","2026-09-23",
  "2026-10-12","2026-11-03","2026-11-23",
  "2027-01-01","2027-01-11","2027-02-11","2027-02-23","2027-03-21",
  "2027-04-29","2027-05-03","2027-05-04","2027-05-05",
  "2027-07-19","2027-08-11","2027-09-20","2027-09-23","2027-10-11",
  "2027-11-03","2027-11-23",
])

function isHoliday(date: Date): boolean {
  return HOLIDAYS.has(date.toISOString().slice(0, 10))
}

function parseUsageInfo(info: string | null) {
  if (!info) return { ssName: null, ssAddress: null, unitPrice: null, quantity: null, fuelCost: null }
  const ssName = info.match(/SS名：([^、]+)/)?.[1]?.trim() ?? null
  const ssAddress = info.match(/SS住所：([^、]+)/)?.[1]?.trim() ?? null
  const unitPriceStr = info.match(/単価：([0-9,.]+)/)?.[1]
  const quantityStr = info.match(/数量：([0-9,.]+)/)?.[1]
  const fuelCostStr = info.match(/燃料代金：([0-9,]+)/)?.[1]
  return {
    ssName,
    ssAddress,
    unitPrice: unitPriceStr ? parseFloat(unitPriceStr.replace(/,/g, "")) : null,
    quantity: quantityStr ? parseFloat(quantityStr.replace(/,/g, "")) : null,
    fuelCost: fuelCostStr ? parseInt(fuelCostStr.replace(/,/g, "")) : null,
  }
}

/**
 * GET /api/accounting/fuel/alerts
 * パラメータ:
 *   from: YYYY-MM-DD, to: YYYY-MM-DD, months: 月数(デフォルト1), threshold: 高額閾値(デフォルト15000)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const fromParam = searchParams.get("from")
  const toParam = searchParams.get("to")
  const months = parseInt(searchParams.get("months") ?? "1") || 1
  const threshold = parseInt(searchParams.get("threshold") ?? "15000") || 15000

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

  // 過去データ用
  const historyMonths: string[] = []
  const histStart = new Date(fromDate.getFullYear(), fromDate.getMonth() - 3, 1)
  const histEnd = new Date(fromDate.getFullYear(), fromDate.getMonth() - 1, 1)
  const histCur = new Date(histStart)
  while (histCur <= histEnd) {
    historyMonths.push(`${histCur.getFullYear()}-${String(histCur.getMonth() + 1).padStart(2, "0")}`)
    histCur.setMonth(histCur.getMonth() + 1)
  }

  const [records, cards] = await Promise.all([
    prisma.fuelRecord.findMany({
      where: { yearMonth: { in: [...targetMonths, ...historyMonths] } },
      orderBy: { usageDate: "desc" },
    }),
    prisma.fuelCard.findMany({ include: { vehicle: true, driver: true } }),
  ])

  const cardMap = Object.fromEntries(cards.map((c) => [c.cardNumber, c]))

  const targetRecords = records.filter((r) => {
    if (!targetMonths.includes(r.yearMonth)) return false
    const d = new Date(r.usageDate)
    return d >= fromDate && d <= toDate
  })
  const historyRecords = records.filter((r) => historyMonths.includes(r.yearMonth))

  function makeRecord(r: typeof records[0]) {
    const card = cardMap[r.cardNumber]
    const parsed = parseUsageInfo(r.usageInfo)
    return {
      id: r.id,
      usageDate: r.usageDate,
      amount: Number(r.amount),
      tax: r.tax ? Number(r.tax) : null,
      cardNumber: r.cardNumber,
      usageType: r.usageType,
      plateNumber: r.plateNumber,
      destinationName: r.destinationName,
      driverLastName: r.driverLastName,
      driverFirstName: r.driverFirstName,
      vehicleName: card?.vehicle?.nickname ?? card?.vehicle?.plateNumber ?? r.plateNumber ?? "不明",
      driverName: card?.driver?.name ?? (r.driverLastName ? `${r.driverLastName}${r.driverFirstName ?? ""}` : "不明"),
      ssName: parsed.ssName,
      ssAddress: parsed.ssAddress,
      unitPrice: parsed.unitPrice,
      quantity: parsed.quantity,
      complianceInfo: r.complianceInfo,
      usageInfo: r.usageInfo,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alerts: any[] = []

  // --- 1. compliance_fuel_mismatch: 指定外燃料給油 ---
  for (const r of targetRecords) {
    if (r.complianceInfo?.includes("指定外燃料給油")) {
      alerts.push({
        type: "compliance_fuel_mismatch",
        severity: "warning",
        title: "指定外燃料給油",
        description: `車両の指定燃料と異なる燃料で給油されました（${r.usageType ?? "不明"}）`,
        record: makeRecord(r),
      })
    }
  }

  // --- 2. compliance_multi_refuel: 同日複数回給油 ---
  for (const r of targetRecords) {
    if (r.complianceInfo?.includes("同日複数回給油")) {
      alerts.push({
        type: "compliance_multi_refuel",
        severity: "warning",
        title: "同日複数回給油",
        description: `同じカードで1日に複数回の給油が行われました`,
        record: makeRecord(r),
      })
    }
  }

  // --- 3. compliance_holiday: 指定休日給油 ---
  for (const r of targetRecords) {
    if (r.complianceInfo?.includes("指定休日給油")) {
      alerts.push({
        type: "compliance_holiday",
        severity: "info",
        title: "指定休日給油",
        description: `休日指定されている日に給油が行われました`,
        record: makeRecord(r),
      })
    }
  }

  // --- 4. high_amount: 高額利用 ---
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

  // --- 5. unusual_time: 休日・祝日・深夜利用 ---
  for (const r of targetRecords) {
    const d = new Date(r.usageDate)
    const day = d.getDay()
    const hour = d.getHours()
    const isSunday = day === 0
    const isSaturday = day === 6
    const isHol = isHoliday(d)
    const isLateNight = hour >= 22 || hour < 6
    // complianceInfoに既に休日が含まれる場合はスキップ
    if (r.complianceInfo?.includes("指定休日給油")) continue

    if (isSunday || isHol || isLateNight) {
      const reasons: string[] = []
      if (isSunday) reasons.push("日曜")
      else if (isSaturday) reasons.push("土曜")
      if (isHol) reasons.push("祝日")
      if (isLateNight) reasons.push("深夜")

      alerts.push({
        type: "unusual_time",
        severity: isSunday || isHol ? "warning" : "info",
        title: reasons.join("・") + "利用",
        description: `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} の利用`,
        record: makeRecord(r),
      })
    }
  }

  // --- 6. monthly_spike: 月間急増（前月比150%以上） ---
  if (targetMonths.length >= 1 && historyMonths.length >= 1) {
    const prevMonth = historyMonths[historyMonths.length - 1]
    const currentByCard = new Map<string, Map<string, number>>()
    const prevByCard = new Map<string, number>()

    for (const r of records) {
      if (targetMonths.includes(r.yearMonth)) {
        const byCard = currentByCard.get(r.yearMonth) ?? new Map()
        byCard.set(r.cardNumber, (byCard.get(r.cardNumber) ?? 0) + Number(r.amount))
        currentByCard.set(r.yearMonth, byCard)
      }
      if (r.yearMonth === prevMonth) {
        prevByCard.set(r.cardNumber, (prevByCard.get(r.cardNumber) ?? 0) + Number(r.amount))
      }
    }

    for (const [ym, byCard] of currentByCard) {
      for (const [cardNumber, current] of byCard) {
        const prev = prevByCard.get(cardNumber) ?? 0
        if (prev > 0 && current >= prev * 1.5) {
          const card = cardMap[cardNumber]
          const ratio = Math.round((current / prev) * 100)
          alerts.push({
            type: "monthly_spike",
            severity: "warning",
            title: "月間利用額急増",
            description: `${ym}: ${current.toLocaleString()}円（前月${Math.round(prev).toLocaleString()}円の${ratio}%）`,
            record: {
              id: `spike_${cardNumber}_${ym}`,
              usageDate: new Date(ym + "-15"),
              amount: current,
              tax: null,
              cardNumber,
              usageType: null,
              plateNumber: null,
              destinationName: null,
              driverLastName: null,
              driverFirstName: null,
              vehicleName: card?.vehicle?.nickname ?? card?.vehicle?.plateNumber ?? cardNumber,
              driverName: card?.driver?.name ?? "不明",
              ssName: null,
              ssAddress: null,
              unitPrice: null,
              quantity: null,
              complianceInfo: null,
              usageInfo: null,
            },
          })
        }
      }
    }
  }

  // --- 7. above_avg: 個人平均の2.5倍以上 ---
  const histAvgByCard = new Map<string, number>()
  const histCountByCard = new Map<string, number>()
  for (const r of historyRecords) {
    if (!r.usageType?.includes("給油")) continue
    histAvgByCard.set(r.cardNumber, (histAvgByCard.get(r.cardNumber) ?? 0) + Number(r.amount))
    histCountByCard.set(r.cardNumber, (histCountByCard.get(r.cardNumber) ?? 0) + 1)
  }
  for (const [cn, total] of histAvgByCard) {
    histAvgByCard.set(cn, total / (histCountByCard.get(cn) ?? 1))
  }

  if (historyRecords.length > 0) {
    for (const r of targetRecords) {
      if (!r.usageType?.includes("給油")) continue
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

  // --- 8. high_frequency: 高頻度給油（週3回以上） ---
  const weeklyCount = new Map<string, Map<string, number>>()
  for (const r of targetRecords) {
    if (!r.usageType?.includes("給油")) continue
    const d = new Date(r.usageDate)
    // 週番号（月曜始まり）
    const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000)
    const weekNum = Math.floor((dayOfYear + new Date(d.getFullYear(), 0, 1).getDay()) / 7)
    const weekKey = `${d.getFullYear()}-W${weekNum}`
    const cardWeeks = weeklyCount.get(r.cardNumber) ?? new Map()
    cardWeeks.set(weekKey, (cardWeeks.get(weekKey) ?? 0) + 1)
    weeklyCount.set(r.cardNumber, cardWeeks)
  }
  const flaggedWeeks = new Set<string>()
  for (const [cardNumber, weeks] of weeklyCount) {
    for (const [weekKey, count] of weeks) {
      if (count >= 3) {
        const key = `${cardNumber}_${weekKey}`
        if (flaggedWeeks.has(key)) continue
        flaggedWeeks.add(key)
        const card = cardMap[cardNumber]
        alerts.push({
          type: "high_frequency",
          severity: "warning",
          title: "高頻度給油",
          description: `${weekKey.replace("-W", "年第")}週: ${count}回の給油（週3回以上）`,
          record: {
            id: key,
            usageDate: new Date(),
            amount: 0,
            tax: null,
            cardNumber,
            usageType: "給油",
            plateNumber: null,
            destinationName: null,
            driverLastName: null,
            driverFirstName: null,
            vehicleName: card?.vehicle?.nickname ?? card?.vehicle?.plateNumber ?? cardNumber,
            driverName: card?.driver?.name ?? "不明",
            ssName: null,
            ssAddress: null,
            unitPrice: null,
            quantity: null,
            complianceInfo: null,
            usageInfo: null,
          },
        })
      }
    }
  }

  // --- 9. small_quantity: 少量給油（10L以下） ---
  for (const r of targetRecords) {
    if (!r.usageType?.includes("給油")) continue
    const parsed = parseUsageInfo(r.usageInfo)
    if (parsed.quantity !== null && parsed.quantity <= 10) {
      alerts.push({
        type: "small_quantity",
        severity: "info",
        title: "少量給油",
        description: `${parsed.quantity}L の少量給油（10L以下）`,
        record: makeRecord(r),
      })
    }
  }

  // --- 10. non_fuel: 給油以外の利用 ---
  for (const r of targetRecords) {
    if (r.usageType && !r.usageType.includes("給油")) {
      alerts.push({
        type: "non_fuel",
        severity: "info",
        title: "給油以外の利用",
        description: `「${r.usageType}」の利用が検出されました`,
        record: makeRecord(r),
      })
    }
  }

  // --- 11. unknown_ss: 初めてのSS（過去3ヶ月で未利用のSS） ---
  if (historyRecords.length > 0) {
    const historySsByCard = new Map<string, Set<string>>()
    for (const r of historyRecords) {
      const parsed = parseUsageInfo(r.usageInfo)
      if (!parsed.ssName) continue
      const set = historySsByCard.get(r.cardNumber) ?? new Set()
      set.add(parsed.ssName)
      historySsByCard.set(r.cardNumber, set)
    }

    for (const r of targetRecords) {
      if (!r.usageType?.includes("給油")) continue
      const parsed = parseUsageInfo(r.usageInfo)
      if (!parsed.ssName) continue
      const pastSSes = historySsByCard.get(r.cardNumber)
      if (pastSSes && pastSSes.size > 0 && !pastSSes.has(parsed.ssName)) {
        alerts.push({
          type: "unknown_ss",
          severity: "info",
          title: "初めてのSS",
          description: `「${parsed.ssName}」は過去3ヶ月で初めての利用SS`,
          record: makeRecord(r),
        })
      }
    }
  }

  // --- 12. price_anomaly: 単価異常 ---
  // 対象期間の同燃料種別の平均単価を算出
  const pricesByType = new Map<string, number[]>()
  for (const r of targetRecords) {
    if (!r.usageType?.includes("給油")) continue
    const parsed = parseUsageInfo(r.usageInfo)
    if (parsed.unitPrice === null) continue
    const type = r.usageType ?? "給油"
    const arr = pricesByType.get(type) ?? []
    arr.push(parsed.unitPrice)
    pricesByType.set(type, arr)
  }
  const avgPriceByType = new Map<string, { avg: number; stddev: number }>()
  for (const [type, prices] of pricesByType) {
    if (prices.length < 3) continue
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length
    const variance = prices.reduce((s, p) => s + (p - avg) ** 2, 0) / prices.length
    const stddev = Math.sqrt(variance)
    avgPriceByType.set(type, { avg, stddev })
  }

  for (const r of targetRecords) {
    if (!r.usageType?.includes("給油")) continue
    const parsed = parseUsageInfo(r.usageInfo)
    if (parsed.unitPrice === null) continue
    const type = r.usageType ?? "給油"
    const stats = avgPriceByType.get(type)
    if (!stats || stats.stddev === 0) continue
    const deviation = Math.abs(parsed.unitPrice - stats.avg)
    if (deviation > stats.stddev * 2) {
      const direction = parsed.unitPrice > stats.avg ? "高い" : "安い"
      alerts.push({
        type: "price_anomaly",
        severity: "warning",
        title: "単価異常",
        description: `${parsed.unitPrice}円/L（${type}平均${stats.avg.toFixed(1)}円との差 ${deviation.toFixed(1)}円 ${direction}）`,
        record: makeRecord(r),
      })
    }
  }

  // ソート: warning > info、同severity内は日付降順
  alerts.sort((a: { severity: string; record: { usageDate: string | Date } }, b: { severity: string; record: { usageDate: string | Date } }) => {
    const sevOrder: Record<string, number> = { warning: 0, info: 1 }
    const sa = sevOrder[a.severity] ?? 2
    const sb = sevOrder[b.severity] ?? 2
    if (sa !== sb) return sa - sb
    return new Date(b.record.usageDate).getTime() - new Date(a.record.usageDate).getTime()
  })

  return NextResponse.json({
    alerts,
    summary: {
      total: alerts.length,
      compliance_fuel_mismatch: alerts.filter((a: { type: string }) => a.type === "compliance_fuel_mismatch").length,
      compliance_multi_refuel: alerts.filter((a: { type: string }) => a.type === "compliance_multi_refuel").length,
      compliance_holiday: alerts.filter((a: { type: string }) => a.type === "compliance_holiday").length,
      high_amount: alerts.filter((a: { type: string }) => a.type === "high_amount").length,
      unusual_time: alerts.filter((a: { type: string }) => a.type === "unusual_time").length,
      monthly_spike: alerts.filter((a: { type: string }) => a.type === "monthly_spike").length,
      above_avg: alerts.filter((a: { type: string }) => a.type === "above_avg").length,
      high_frequency: alerts.filter((a: { type: string }) => a.type === "high_frequency").length,
      small_quantity: alerts.filter((a: { type: string }) => a.type === "small_quantity").length,
      non_fuel: alerts.filter((a: { type: string }) => a.type === "non_fuel").length,
      unknown_ss: alerts.filter((a: { type: string }) => a.type === "unknown_ss").length,
      price_anomaly: alerts.filter((a: { type: string }) => a.type === "price_anomaly").length,
    },
    period: { from: fromDate.toISOString(), to: toDate.toISOString() },
  })
}
