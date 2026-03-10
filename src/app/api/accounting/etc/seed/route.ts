import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/accounting/etc/seed
 * サンプルデータを投入（車両・ドライバー・カード・利用記録）
 */
export async function POST() {
  // 車両サンプル
  const vehiclesData = [
    { plateNumber: "品川 300 あ 1234", nickname: "ハイエース1号", vehicleType: "トヨタ ハイエース" },
    { plateNumber: "品川 300 い 5678", nickname: "キャラバン", vehicleType: "日産 キャラバン" },
    { plateNumber: "品川 100 う 9012", nickname: "ダンプ", vehicleType: "いすゞ エルフ" },
    { plateNumber: "品川 300 え 3456", nickname: "ハイエース2号", vehicleType: "トヨタ ハイエース" },
  ]

  // ドライバーサンプル（10名）
  const driversData = [
    { name: "田中 太郎" },
    { name: "佐藤 一郎" },
    { name: "鈴木 健太" },
    { name: "山田 次郎" },
    { name: "高橋 三郎" },
    { name: "伊藤 誠" },
    { name: "渡辺 大輔" },
    { name: "中村 修" },
    { name: "小林 隆" },
    { name: "加藤 勇気" },
  ]

  const vehicles = []
  for (const v of vehiclesData) {
    const existing = await prisma.etcVehicle.findUnique({ where: { plateNumber: v.plateNumber } })
    if (existing) {
      vehicles.push(existing)
    } else {
      vehicles.push(await prisma.etcVehicle.create({ data: v }))
    }
  }

  const drivers = []
  for (const d of driversData) {
    const existing = await prisma.etcDriver.findFirst({ where: { name: d.name } })
    if (existing) {
      drivers.push(existing)
    } else {
      drivers.push(await prisma.etcDriver.create({ data: d }))
    }
  }

  // カードサンプル（車両・ドライバー紐付け）
  const cardsData = [
    { cardNumber: "1234-5678-9012-3456-001", vehicleIdx: 0, driverIdx: 0 },
    { cardNumber: "1234-5678-9012-3456-002", vehicleIdx: 1, driverIdx: 1 },
    { cardNumber: "1234-5678-9012-3456-003", vehicleIdx: 2, driverIdx: 2 },
    { cardNumber: "1234-5678-9012-3456-004", vehicleIdx: 3, driverIdx: 3 },
  ]

  const cards = []
  for (const c of cardsData) {
    const existing = await prisma.etcCard.findUnique({ where: { cardNumber: c.cardNumber } })
    if (existing) {
      cards.push(existing)
    } else {
      cards.push(await prisma.etcCard.create({
        data: {
          cardNumber: c.cardNumber,
          vehicleId: vehicles[c.vehicleIdx].id,
          driverId: drivers[c.driverIdx].id,
        },
      }))
    }
  }

  // 利用記録サンプル（過去6ヶ月分）
  const routes = [
    { entry: "東京", exit: "用賀", amounts: [320, 320, 320] },
    { entry: "用賀", exit: "厚木", amounts: [1320, 1320, 1320] },
    { entry: "大井", exit: "横浜青葉", amounts: [730, 730, 730] },
    { entry: "東京", exit: "三郷", amounts: [640, 640, 640] },
    { entry: "川口", exit: "浦和", amounts: [420, 420, 420] },
    { entry: "新座", exit: "所沢", amounts: [520, 520, 520] },
    { entry: "練馬", exit: "大泉", amounts: [310, 310, 310] },
    { entry: "八王子", exit: "相模原", amounts: [870, 870, 870] },
    { entry: "横浜町田", exit: "海老名", amounts: [580, 580, 580] },
    { entry: "東名川崎", exit: "厚木", amounts: [980, 980, 980] },
  ]

  const dayOfWeekNames = ["日", "月", "火", "水", "木", "金", "土"]

  const now = new Date()
  let recordCount = 0

  for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1)
    const yearMonth = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`
    const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate()

    for (let cardIdx = 0; cardIdx < cards.length; cardIdx++) {
      // 各カード、月に8〜15件のランダムな利用
      const usageCount = 8 + Math.floor(Math.random() * 8)

      for (let i = 0; i < usageCount; i++) {
        const day = 1 + Math.floor(Math.random() * daysInMonth)
        const usageDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), day)

        // 未来の日付はスキップ
        if (usageDate > now) continue

        const route = routes[Math.floor(Math.random() * routes.length)]
        const amount = route.amounts[Math.floor(Math.random() * route.amounts.length)]
        const hour = 6 + Math.floor(Math.random() * 14)
        const minute = Math.floor(Math.random() * 60)

        await prisma.etcRecord.create({
          data: {
            cardId: cards[cardIdx].id,
            cardNumber: cards[cardIdx].cardNumber,
            usageDate,
            dayOfWeek: dayOfWeekNames[usageDate.getDay()],
            usageType: "通行料金",
            plateNumber: vehicles[cardIdx].plateNumber,
            amount,
            usageInfo: `入口IC：${route.entry}、出口IC：${route.exit}、課金時刻：${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
            yearMonth,
          },
        })
        recordCount++
      }
    }
  }

  return NextResponse.json({
    message: "サンプルデータを投入しました",
    vehicles: vehicles.length,
    drivers: drivers.length,
    cards: cards.length,
    records: recordCount,
  })
}
