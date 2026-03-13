/**
 * [SEED] 未配置テストデータ（3週間後）
 *
 * 3月22日〜28日に未配置の工程を5件作成する。
 * workerAssignment は作成しないので、すべて「未配置」として表示される。
 *
 * 実行: npx tsx prisma/seed-future-test-data.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 未配置テストデータ（3月下旬）の投入を開始します...")

  // ── 既存データ取得 ──
  const branches = await prisma.branch.findMany({ include: { company: true }, take: 3 })
  if (branches.length === 0) throw new Error("ブランチが存在しません")

  const user = await prisma.user.findFirst({ where: { email: "staff@ashiba-sample.com" } })
  if (!user) throw new Error("ユーザーが存在しません")

  const unitIshiki = await prisma.unit.findFirst({ where: { name: "一式" } })
  if (!unitIshiki) throw new Error("単位マスターが不足しています")

  // ── 現場3件 ──
  const projectDefs = [
    {
      shortId: "P-2603-050",
      name: "目黒区マンション大規模修繕",
      branchId: branches[0].id,
      address: "東京都目黒区中目黒3-5-2",
      startDate: new Date("2026-03-22"),
      endDate: new Date("2026-04-05"),
    },
    {
      shortId: "P-2603-051",
      name: "世田谷区戸建て外壁塗装",
      branchId: branches[1]?.id ?? branches[0].id,
      address: "東京都世田谷区等々力4-8-1",
      startDate: new Date("2026-03-23"),
      endDate: new Date("2026-03-27"),
    },
    {
      shortId: "P-2603-052",
      name: "川崎市商業ビル改修",
      branchId: branches[0].id,
      address: "神奈川県川崎市幸区堀川町72-1",
      startDate: new Date("2026-03-24"),
      endDate: new Date("2026-04-02"),
    },
  ]

  const projects = []
  for (const pd of projectDefs) {
    const project = await prisma.project.upsert({
      where: { shortId: pd.shortId },
      update: {},
      create: pd,
    })
    projects.push(project)
    console.log(`  ✅ 現場: ${pd.name}`)
  }

  // ── 見積3件 ──
  const estimates = []
  const estDefs = [
    { projectId: projects[0].id, title: "目黒マンション 足場見積", amount: 3200000 },
    { projectId: projects[1].id, title: "世田谷戸建 足場見積", amount: 480000 },
    { projectId: projects[2].id, title: "川崎ビル 足場見積", amount: 1850000 },
  ]
  for (let i = 0; i < estDefs.length; i++) {
    const ed = estDefs[i]
    const estimate = await prisma.estimate.create({
      data: {
        projectId: ed.projectId,
        userId: user.id,
        estimateNumber: `2603-FT${(i + 1).toString().padStart(2, "0")}`,
        revision: 1,
        title: ed.title,
        status: "CONFIRMED",
        confirmedAt: new Date("2026-03-15"),
        sections: {
          create: {
            name: "足場工事",
            sortOrder: 0,
            groups: {
              create: {
                name: "枠組足場",
                sortOrder: 0,
                items: {
                  create: {
                    name: "枠組足場 架設・解体",
                    quantity: 1,
                    unitId: unitIshiki.id,
                    unitPrice: ed.amount,
                    sortOrder: 0,
                  },
                },
              },
            },
          },
        },
      },
    })
    estimates.push(estimate)
    console.log(`  ✅ 見積: ${ed.title}`)
  }

  // ── 契約3件 ──
  const contracts = []
  const cDefs = [
    { num: "C-2603-050", pIdx: 0, eIdx: 0, amount: 3200000, start: "2026-03-22", end: "2026-04-05" },
    { num: "C-2603-051", pIdx: 1, eIdx: 1, amount: 480000, start: "2026-03-23", end: "2026-03-27" },
    { num: "C-2603-052", pIdx: 2, eIdx: 2, amount: 1850000, start: "2026-03-24", end: "2026-04-02" },
  ]
  for (const cd of cDefs) {
    const tax = Math.floor(cd.amount * 0.10)
    const contract = await prisma.contract.create({
      data: {
        contractNumber: cd.num,
        projectId: projects[cd.pIdx].id,
        estimateId: estimates[cd.eIdx].id,
        contractAmount: cd.amount,
        taxAmount: tax,
        totalAmount: cd.amount + tax,
        discountAmount: 0,
        contractDate: new Date("2026-03-15"),
        startDate: new Date(cd.start),
        endDate: new Date(cd.end),
        status: "SCHEDULE_CREATED",
      },
    })
    contracts.push(contract)
    console.log(`  ✅ 契約: ${cd.num}`)
  }

  // ── 工期スケジュール5件（すべて未配置） ──
  const scheduleDefs = [
    // 目黒マンション: 組立 3/22-3/25 (4日間)
    {
      contractId: contracts[0].id,
      projectId: contracts[0].projectId,
      workType: "ASSEMBLY",
      name: "目黒マンション 足場組立",
      plannedStartDate: new Date("2026-03-22"),
      plannedEndDate: new Date("2026-03-25"),
      workersCount: 5,
    },
    // 目黒マンション: 解体 3/30-4/2 (4日間)
    {
      contractId: contracts[0].id,
      projectId: contracts[0].projectId,
      workType: "DISASSEMBLY",
      name: "目黒マンション 足場解体",
      plannedStartDate: new Date("2026-03-30"),
      plannedEndDate: new Date("2026-04-02"),
      workersCount: 4,
    },
    // 世田谷戸建: 組立 3/23-3/24 (2日間)
    {
      contractId: contracts[1].id,
      projectId: contracts[1].projectId,
      workType: "ASSEMBLY",
      name: "世田谷戸建 足場組立",
      plannedStartDate: new Date("2026-03-23"),
      plannedEndDate: new Date("2026-03-24"),
      workersCount: 3,
    },
    // 世田谷戸建: 解体 3/26-3/27 (2日間)
    {
      contractId: contracts[1].id,
      projectId: contracts[1].projectId,
      workType: "DISASSEMBLY",
      name: "世田谷戸建 足場解体",
      plannedStartDate: new Date("2026-03-26"),
      plannedEndDate: new Date("2026-03-27"),
      workersCount: 3,
    },
    // 川崎ビル: 組立 3/24-3/28 (5日間)
    {
      contractId: contracts[2].id,
      projectId: contracts[2].projectId,
      workType: "ASSEMBLY",
      name: "川崎ビル 足場組立",
      plannedStartDate: new Date("2026-03-24"),
      plannedEndDate: new Date("2026-03-28"),
      workersCount: 6,
    },
  ]

  for (const sd of scheduleDefs) {
    await prisma.constructionSchedule.create({
      data: {
        contractId: sd.contractId,
        projectId: sd.projectId,
        workType: sd.workType,
        name: sd.name,
        plannedStartDate: sd.plannedStartDate,
        plannedEndDate: sd.plannedEndDate,
        workersCount: sd.workersCount,
      },
    })
    console.log(`  ✅ 工程: ${sd.name} (${sd.workType})`)
  }

  console.log("")
  console.log("🎉 テストデータ投入完了！")
  console.log("")
  console.log("投入内容:")
  console.log(`  現場: ${projects.length}件`)
  console.log(`  契約: ${contracts.length}件`)
  console.log(`  未配置工程: ${scheduleDefs.length}件`)
  console.log("")
  console.log("人員配置画面で3月22日〜に移動してテストしてください。")
  console.log("テーブル側は空、未配置バーに5件の工程が表示されます。")

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("❌ エラー:", e)
  process.exit(1)
})
