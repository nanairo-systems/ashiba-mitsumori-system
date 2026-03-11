/**
 * [SEED] 外注支払（SubcontractorPayment）サンプルデータ追加
 *
 * 既存の契約・外注業者に紐づけて、様々なステータスの支払データを投入する。
 *
 * 実行: npx tsx prisma/seed-subcontractor-payments.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const connStr = process.env.DATABASE_URL
if (!connStr) throw new Error("DATABASE_URL not set")
const adapter = new PrismaPg({ connectionString: connStr, pool: { max: 5 } })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 外注支払サンプルデータの投入を開始します...")

  // 既存の外注業者を取得
  const subcontractors = await prisma.subcontractor.findMany()
  if (subcontractors.length === 0) {
    console.error("❌ 外注業者が登録されていません")
    return
  }
  const subMap: Record<string, string> = {}
  for (const s of subcontractors) subMap[s.name] = s.id

  // 金額のある既存契約を取得
  const contracts = await prisma.contract.findMany({
    where: { totalAmount: { gt: 0 } },
    include: { project: { select: { name: true } } },
    orderBy: { contractDate: "asc" },
  })

  // 既存の外注支払を取得してスキップ判定用
  const existingPayments = await prisma.subcontractorPayment.findMany({
    select: { contractId: true, subcontractorId: true },
  })
  const existingKeys = new Set(
    existingPayments.map((p) => `${p.contractId}__${p.subcontractorId}`)
  )

  // 支払データ定義
  const paymentDefs = [
    // 札幌駅前再開発 - 大型案件なので複数外注
    {
      projectName: "中央建設 札幌駅前再開発",
      sub: "株式会社 北海道仮設",
      orderAmount: 850000,
      status: "PAID" as const,
      closingDate: "2026-02-28",
      paymentDueDate: "2026-03-31",
      paymentDate: "2026-03-28",
      notes: "足場材運搬・設置補助",
    },
    {
      projectName: "中央建設 札幌駅前再開発",
      sub: "丸山建設",
      orderAmount: 420000,
      status: "PAID" as const,
      closingDate: "2026-01-31",
      paymentDueDate: "2026-02-28",
      paymentDate: "2026-02-25",
      notes: "解体作業補助",
    },
    // 博多駅南ホテル新築
    {
      projectName: "九州建工 博多駅南ホテル新築",
      sub: "大和足場工業",
      orderAmount: 650000,
      status: "SCHEDULED" as const,
      closingDate: "2026-03-31",
      paymentDueDate: "2026-04-30",
      paymentDate: null,
      notes: "高層部足場組立応援",
    },
    {
      projectName: "九州建工 博多駅南ホテル新築",
      sub: "有限会社 丸山鳶工業",
      orderAmount: 380000,
      status: "PAID" as const,
      closingDate: "2026-02-28",
      paymentDueDate: "2026-03-31",
      paymentDate: "2026-03-29",
      notes: "鳶工3名×8日間",
    },
    // 田中マンション新築工事
    {
      projectName: "田中マンション新築工事",
      sub: "合同会社 西田足場",
      orderAmount: 520000,
      status: "PAID" as const,
      closingDate: "2026-01-20",
      paymentDueDate: "2026-02-28",
      paymentDate: "2026-02-27",
      notes: "足場組立応援・養生作業",
    },
    {
      projectName: "田中マンション新築工事",
      sub: "有限会社 丸山鳶工業",
      orderAmount: 280000,
      status: "PENDING" as const,
      closingDate: "2026-02-20",
      paymentDueDate: "2026-03-31",
      paymentDate: null,
      notes: "解体工事応援 鳶工2名",
    },
    // 鈴木レジデンス名古屋
    {
      projectName: "鈴木レジデンス名古屋 大規模修繕",
      sub: "大和足場工業",
      orderAmount: 780000,
      status: "SCHEDULED" as const,
      closingDate: "2026-01-31",
      paymentDueDate: "2026-03-20",
      paymentDate: null,
      notes: "大規模修繕 足場組立メイン作業",
    },
    {
      projectName: "鈴木レジデンス名古屋 大規模修繕",
      sub: "丸山建設",
      orderAmount: 350000,
      status: "PENDING" as const,
      closingDate: "2026-02-28",
      paymentDueDate: "2026-04-20",
      paymentDate: null,
      notes: "資材運搬・搬入出",
    },
    // 熊本城周辺歩道橋
    {
      projectName: "九州建工 熊本城周辺歩道橋",
      sub: "合同会社 西田足場",
      orderAmount: 180000,
      status: "PAID" as const,
      closingDate: "2026-03-31",
      paymentDueDate: "2026-04-30",
      paymentDate: "2026-04-28",
      notes: "歩道橋足場 特殊作業",
    },
    // 堺市倉庫塗装
    {
      projectName: "田中工務店 堺市倉庫塗装",
      sub: "株式会社 北海道仮設",
      orderAmount: 150000,
      status: "PAID" as const,
      closingDate: "2026-02-20",
      paymentDueDate: "2026-03-31",
      paymentDate: "2026-03-30",
      notes: "資材リース・運搬",
    },
    // 渋谷駅前ビル
    {
      projectName: "渋谷駅前ビル外壁改修工事",
      sub: "大和足場工業",
      orderAmount: 550000,
      status: "PENDING" as const,
      closingDate: "2026-03-31",
      paymentDueDate: "2026-04-30",
      paymentDate: null,
      notes: "外壁改修足場 組立応援",
    },
    {
      projectName: "渋谷駅前ビル外壁改修工事",
      sub: "有限会社 丸山鳶工業",
      orderAmount: 320000,
      status: "PENDING" as const,
      closingDate: "2026-03-31",
      paymentDueDate: "2026-04-30",
      paymentDate: null,
      notes: "鳶工4名×4日間",
    },
    // 新宿タワーマンション
    {
      projectName: "新宿タワーマンション新築足場",
      sub: "丸山建設",
      orderAmount: 1200000,
      status: "SCHEDULED" as const,
      closingDate: "2026-03-31",
      paymentDueDate: "2026-04-30",
      paymentDate: null,
      notes: "タワーマンション高層足場 長期応援",
    },
    {
      projectName: "新宿タワーマンション新築足場",
      sub: "合同会社 西田足場",
      orderAmount: 680000,
      status: "PENDING" as const,
      closingDate: "2026-03-31",
      paymentDueDate: "2026-04-30",
      paymentDate: null,
      notes: "養生・安全設備設置",
    },
    // 目黒区マンション
    {
      projectName: "目黒区マンション大規模修繕",
      sub: "大和足場工業",
      orderAmount: 900000,
      status: "PENDING" as const,
      closingDate: "2026-03-31",
      paymentDueDate: "2026-04-30",
      paymentDate: null,
      notes: "大規模修繕 仮設足場一式",
    },
    // 川崎市商業ビル
    {
      projectName: "川崎市商業ビル改修",
      sub: "株式会社 北海道仮設",
      orderAmount: 420000,
      status: "SCHEDULED" as const,
      closingDate: "2026-03-31",
      paymentDueDate: "2026-04-30",
      paymentDate: null,
      notes: "商業ビル足場 資材提供・施工補助",
    },
  ]

  let created = 0
  let skipped = 0

  for (const def of paymentDefs) {
    // 契約を名前で検索
    const contract = contracts.find((c) => c.project.name === def.projectName)
    if (!contract) {
      console.log(`⚠️ 契約なし: ${def.projectName}`)
      continue
    }

    const subId = subMap[def.sub]
    if (!subId) {
      console.log(`⚠️ 外注業者なし: ${def.sub}`)
      continue
    }

    // 既存チェック
    const key = `${contract.id}__${subId}`
    if (existingKeys.has(key)) {
      console.log(`⏭️ スキップ（既存）: ${def.projectName} → ${def.sub}`)
      skipped++
      continue
    }

    const taxRate = 0.1
    const taxAmount = Math.floor(def.orderAmount * taxRate)
    const totalAmount = def.orderAmount + taxAmount

    await prisma.subcontractorPayment.create({
      data: {
        contractId: contract.id,
        subcontractorId: subId,
        orderAmount: def.orderAmount,
        taxAmount,
        totalAmount,
        closingDate: new Date(def.closingDate),
        paymentDueDate: new Date(def.paymentDueDate),
        paymentDate: def.paymentDate ? new Date(def.paymentDate) : null,
        paymentAmount: def.status === "PAID" ? totalAmount : null,
        status: def.status,
        notes: def.notes,
      },
    })

    existingKeys.add(key)
    created++
    console.log(
      `✅ ${def.projectName} → ${def.sub} | ¥${totalAmount.toLocaleString()} | ${def.status}`
    )
  }

  console.log(`\n🎉 完了！ 作成: ${created}件, スキップ: ${skipped}件`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
