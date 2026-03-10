import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

interface FuelRow {
  顧客コード?: string | number
  利用日: Date | string | number
  曜日?: string
  利用内容?: string
  納車先名?: string
  "運転者名（漢字）（姓）"?: string
  "運転者名（漢字）（名）"?: string
  カード番号: string | number
  登録番号?: string
  社内車両番号?: string | number
  "金額（税込）"?: number
  消費税?: number
  利用情報?: string
  適正利用情報?: string
  顧客固有コード?: string | number
}

function parseDate(val: Date | string | number): Date | null {
  if (!val) return null
  if (val instanceof Date) return val
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return new Date(d.y, d.m - 1, d.d)
  }
  const parsed = new Date(val)
  return isNaN(parsed.getTime()) ? null : parsed
}

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "ファイルがありません" }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<FuelRow>(ws, { defval: null })

  // 既存カードマップ（カード番号 → id）
  const existingCards = await prisma.fuelCard.findMany({ select: { id: true, cardNumber: true } })
  const cardMap = new Map(existingCards.map((c) => [c.cardNumber, c.id]))

  const records: Array<{
    cardId: string | null
    cardNumber: string
    customerCode: string | null
    usageDate: Date
    dayOfWeek: string | null
    usageType: string | null
    destinationName: string | null
    driverLastName: string | null
    driverFirstName: string | null
    plateNumber: string | null
    internalVehicleNo: string | null
    amount: number
    tax: number | null
    usageInfo: string | null
    complianceInfo: string | null
    customerSpecificCode: string | null
    yearMonth: string
  }> = []

  for (const row of rows) {
    const cardNumberRaw = String(row["カード番号"] ?? "").trim()
    if (!cardNumberRaw) continue

    const usageDate = parseDate(row["利用日"])
    if (!usageDate) continue

    const yearMonth = `${usageDate.getFullYear()}-${String(usageDate.getMonth() + 1).padStart(2, "0")}`
    const amount = Number(row["金額（税込）"] ?? 0)
    const tax = row["消費税"] != null ? Number(row["消費税"]) : null

    records.push({
      cardId: cardMap.get(cardNumberRaw) ?? null,
      cardNumber: cardNumberRaw,
      customerCode: row["顧客コード"] != null ? String(row["顧客コード"]).trim() : null,
      usageDate,
      dayOfWeek: row["曜日"] ? String(row["曜日"]) : null,
      usageType: row["利用内容"] ? String(row["利用内容"]) : null,
      destinationName: row["納車先名"] ? String(row["納車先名"]) : null,
      driverLastName: row["運転者名（漢字）（姓）"] ? String(row["運転者名（漢字）（姓）"]) : null,
      driverFirstName: row["運転者名（漢字）（名）"] ? String(row["運転者名（漢字）（名）"]) : null,
      plateNumber: row["登録番号"] ? String(row["登録番号"]).trim() : null,
      internalVehicleNo: row["社内車両番号"] != null ? String(row["社内車両番号"]).trim() : null,
      amount,
      tax,
      usageInfo: row["利用情報"] ? String(row["利用情報"]) : null,
      complianceInfo: row["適正利用情報"] ? String(row["適正利用情報"]) : null,
      customerSpecificCode: row["顧客固有コード"] != null ? String(row["顧客固有コード"]).trim() : null,
      yearMonth,
    })
  }

  if (records.length === 0) {
    return NextResponse.json({ error: "取り込めるデータがありません" }, { status: 400 })
  }

  // 重複チェック: 同一カード番号・同一利用日・同一金額・同一利用情報は skip
  const existingRecords = await prisma.fuelRecord.findMany({
    where: { yearMonth: { in: [...new Set(records.map((r) => r.yearMonth))] } },
    select: { cardNumber: true, usageDate: true, amount: true, usageInfo: true },
  })

  const existingSet = new Set(
    existingRecords.map((r) => `${r.cardNumber}|${r.usageDate.toISOString()}|${r.amount}|${r.usageInfo ?? ""}`)
  )

  const newRecords = records.filter((r) => {
    const key = `${r.cardNumber}|${r.usageDate.toISOString()}|${r.amount}|${r.usageInfo ?? ""}`
    return !existingSet.has(key)
  })

  if (newRecords.length === 0) {
    return NextResponse.json({ message: "全て取込済みです", imported: 0, skipped: records.length })
  }

  await prisma.fuelRecord.createMany({ data: newRecords })

  return NextResponse.json({
    message: `${newRecords.length} 件取り込みました`,
    imported: newRecords.length,
    skipped: records.length - newRecords.length,
  })
}
