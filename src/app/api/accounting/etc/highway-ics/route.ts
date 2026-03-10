import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

/**
 * GET /api/accounting/etc/highway-ics
 * 高速ICマスター一覧
 */
export async function GET() {
  const ics = await prisma.highwayIC.findMany({
    orderBy: [{ area: "asc" }, { roadName: "asc" }, { name: "asc" }],
  })
  return NextResponse.json(ics)
}

const createSchema = z.object({
  name: z.string().min(1),
  roadName: z.string().optional().nullable(),
  area: z.enum(["normal", "outside"]).default("normal"),
  note: z.string().optional(),
})

/**
 * POST /api/accounting/etc/highway-ics
 * IC新規登録
 */
export async function POST(req: Request) {
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const ic = await prisma.highwayIC.create({ data: parsed.data })
    return NextResponse.json(ic, { status: 201 })
  } catch {
    return NextResponse.json({ error: "同名のICが既に登録されています" }, { status: 409 })
  }
}

/**
 * POST /api/accounting/etc/highway-ics (bulk seed)
 * シードデータ投入（bodyに { seed: true } を渡す）
 */
export async function PUT() {
  const seedData = [
    // 東名高速道路
    { name: "豊橋IC", roadName: "東名高速", area: "normal" },
    { name: "音羽蒲郡IC", roadName: "東名高速", area: "normal" },
    { name: "岡崎IC", roadName: "東名高速", area: "normal" },
    { name: "豊田IC", roadName: "東名高速", area: "normal" },
    { name: "東名三好IC", roadName: "東名高速", area: "normal" },
    { name: "日進JCT", roadName: "東名高速", area: "normal" },
    { name: "名古屋IC", roadName: "東名高速", area: "normal" },
    { name: "守山スマートIC", roadName: "東名高速", area: "normal" },
    { name: "春日井IC", roadName: "東名高速", area: "normal" },
    { name: "小牧IC", roadName: "東名高速", area: "normal" },
    { name: "小牧JCT", roadName: "東名高速", area: "normal" },
    { name: "豊川IC", roadName: "東名高速", area: "normal" },
    // 新東名高速道路
    { name: "新城IC", roadName: "新東名高速", area: "normal" },
    { name: "岡崎東IC", roadName: "新東名高速", area: "normal" },
    { name: "豊田東IC", roadName: "新東名高速", area: "normal" },
    { name: "長篠設楽原PA/SIC", roadName: "新東名高速", area: "normal" },
    // 名神高速道路
    { name: "一宮IC", roadName: "名神高速", area: "normal" },
    { name: "一宮JCT", roadName: "名神高速", area: "normal" },
    { name: "岐阜羽島IC", roadName: "名神高速", area: "normal" },
    { name: "大垣IC", roadName: "名神高速", area: "normal" },
    { name: "関ヶ原IC", roadName: "名神高速", area: "normal" },
    // 東名阪自動車道
    { name: "名古屋西IC", roadName: "東名阪", area: "normal" },
    { name: "名古屋西JCT", roadName: "東名阪", area: "normal" },
    { name: "蟹江IC", roadName: "東名阪", area: "normal" },
    { name: "弥富IC", roadName: "東名阪", area: "normal" },
    { name: "長島IC", roadName: "東名阪", area: "normal" },
    { name: "桑名東IC", roadName: "東名阪", area: "normal" },
    { name: "桑名IC", roadName: "東名阪", area: "normal" },
    { name: "四日市東IC", roadName: "東名阪", area: "normal" },
    { name: "四日市IC", roadName: "東名阪", area: "normal" },
    { name: "四日市JCT", roadName: "東名阪", area: "normal" },
    { name: "鈴鹿IC", roadName: "東名阪", area: "normal" },
    { name: "亀山IC", roadName: "東名阪", area: "normal" },
    { name: "亀山JCT", roadName: "東名阪", area: "normal" },
    // 伊勢湾岸自動車道
    { name: "東海IC", roadName: "伊勢湾岸", area: "normal" },
    { name: "名港中央IC", roadName: "伊勢湾岸", area: "normal" },
    { name: "名港潮見IC", roadName: "伊勢湾岸", area: "normal" },
    { name: "飛島IC", roadName: "伊勢湾岸", area: "normal" },
    { name: "湾岸弥富IC", roadName: "伊勢湾岸", area: "normal" },
    { name: "みえ川越IC", roadName: "伊勢湾岸", area: "normal" },
    { name: "豊明IC", roadName: "伊勢湾岸", area: "normal" },
    { name: "豊田南IC", roadName: "伊勢湾岸", area: "normal" },
    { name: "刈谷PA/SIC", roadName: "伊勢湾岸", area: "normal" },
    // 伊勢自動車道
    { name: "芸濃IC", roadName: "伊勢道", area: "normal" },
    { name: "津IC", roadName: "伊勢道", area: "normal" },
    { name: "久居IC", roadName: "伊勢道", area: "normal" },
    { name: "松阪IC", roadName: "伊勢道", area: "normal" },
    { name: "伊勢西IC", roadName: "伊勢道", area: "normal" },
    { name: "伊勢IC", roadName: "伊勢道", area: "normal" },
    // 中央自動車道
    { name: "小牧東IC", roadName: "中央道", area: "normal" },
    { name: "多治見IC", roadName: "中央道", area: "normal" },
    { name: "土岐IC", roadName: "中央道", area: "normal" },
    { name: "瑞浪IC", roadName: "中央道", area: "normal" },
    { name: "恵那IC", roadName: "中央道", area: "normal" },
    { name: "中津川IC", roadName: "中央道", area: "normal" },
    // 東海北陸自動車道
    { name: "一宮木曽川IC", roadName: "東海北陸", area: "normal" },
    { name: "一宮西IC", roadName: "東海北陸", area: "normal" },
    { name: "岐阜各務原IC", roadName: "東海北陸", area: "normal" },
    { name: "関IC", roadName: "東海北陸", area: "normal" },
    { name: "美濃IC", roadName: "東海北陸", area: "normal" },
    { name: "郡上八幡IC", roadName: "東海北陸", area: "normal" },
    { name: "高鷲IC", roadName: "東海北陸", area: "normal" },
    // 名二環（名古屋第二環状）
    { name: "名古屋南JCT", roadName: "名二環", area: "normal" },
    { name: "有松IC", roadName: "名二環", area: "normal" },
    { name: "鳴海IC", roadName: "名二環", area: "normal" },
    { name: "植田IC", roadName: "名二環", area: "normal" },
    { name: "高針JCT", roadName: "名二環", area: "normal" },
    { name: "上社JCT", roadName: "名二環", area: "normal" },
    { name: "大森IC", roadName: "名二環", area: "normal" },
    { name: "勝川IC", roadName: "名二環", area: "normal" },
    { name: "楠JCT", roadName: "名二環", area: "normal" },
    { name: "清洲JCT", roadName: "名二環", area: "normal" },
    // 名古屋高速
    { name: "栄出入口", roadName: "名古屋高速", area: "normal" },
    { name: "丸の内出入口", roadName: "名古屋高速", area: "normal" },
    { name: "明道町出入口", roadName: "名古屋高速", area: "normal" },
    { name: "東新町出入口", roadName: "名古屋高速", area: "normal" },
    { name: "白川出入口", roadName: "名古屋高速", area: "normal" },
    { name: "堀田出入口", roadName: "名古屋高速", area: "normal" },
    { name: "呼続出入口", roadName: "名古屋高速", area: "normal" },
    { name: "大高出入口", roadName: "名古屋高速", area: "normal" },
    { name: "笠寺出入口", roadName: "名古屋高速", area: "normal" },
    { name: "星崎出入口", roadName: "名古屋高速", area: "normal" },
    { name: "大平通出入口", roadName: "名古屋高速", area: "normal" },
    { name: "山王出入口", roadName: "名古屋高速", area: "normal" },
    { name: "黄金出入口", roadName: "名古屋高速", area: "normal" },
    { name: "鶴舞南出入口", roadName: "名古屋高速", area: "normal" },
    { name: "吹上出入口", roadName: "名古屋高速", area: "normal" },
    { name: "春岡出入口", roadName: "名古屋高速", area: "normal" },
    { name: "四谷出入口", roadName: "名古屋高速", area: "normal" },
    { name: "高針出入口", roadName: "名古屋高速", area: "normal" },
    { name: "楠出入口", roadName: "名古屋高速", area: "normal" },
    { name: "小牧南出入口", roadName: "名古屋高速", area: "normal" },
    { name: "小牧北出入口", roadName: "名古屋高速", area: "normal" },
    { name: "清洲出入口", roadName: "名古屋高速", area: "normal" },
    { name: "一宮南出入口", roadName: "名古屋高速", area: "normal" },
    { name: "一宮中出入口", roadName: "名古屋高速", area: "normal" },
    // 東海環状自動車道
    { name: "せと品野IC", roadName: "東海環状", area: "normal" },
    { name: "せと赤津IC", roadName: "東海環状", area: "normal" },
    { name: "土岐南多治見IC", roadName: "東海環状", area: "normal" },
    { name: "豊田勘八IC", roadName: "東海環状", area: "normal" },
    { name: "豊田松平IC", roadName: "東海環状", area: "normal" },
    { name: "いなべIC", roadName: "東海環状", area: "normal" },
    // 知多半島道路・知多横断道路
    { name: "大府IC", roadName: "知多半島道路", area: "normal" },
    { name: "半田IC", roadName: "知多半島道路", area: "normal" },
    { name: "武豊IC", roadName: "知多半島道路", area: "normal" },
    { name: "美浜IC", roadName: "知多半島道路", area: "normal" },
    { name: "南知多IC", roadName: "知多半島道路", area: "normal" },
    { name: "りんくうIC", roadName: "知多横断道路", area: "normal" },
  ]

  let created = 0
  let skipped = 0
  for (const ic of seedData) {
    try {
      await prisma.highwayIC.create({ data: ic })
      created++
    } catch {
      skipped++ // 既に存在
    }
  }

  return NextResponse.json({ created, skipped, total: seedData.length })
}
