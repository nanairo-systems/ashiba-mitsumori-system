/**
 * [SEED] 1日工程テストデータ
 *
 * 3/10〜3/12 に1日完結の組立・解体工程を作成する。
 * workerAssignment は作成しないので、すべて「未配置」として表示される。
 *
 * 実行: npx tsx prisma/seed-oneday-test-data.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 1日工程テストデータの投入を開始します...")

  // ── 既存データ取得 ──
  const branches = await prisma.branch.findMany({ include: { company: true }, take: 3 })
  if (branches.length === 0) throw new Error("ブランチが存在しません")

  const user = await prisma.user.findFirst({ where: { email: "staff@ashiba-sample.com" } })
  if (!user) throw new Error("ユーザーが存在しません")

  const unitIshiki = await prisma.unit.findFirst({ where: { name: "一式" } })
  if (!unitIshiki) throw new Error("単位マスターが不足しています")

  // ── 現場2件 ──
  const projectDefs = [
    {
      shortId: "P-2603-060",
      name: "渋谷区戸建て外壁補修",
      branchId: branches[0].id,
      address: "東京都渋谷区神宮前2-3-1",
      startDate: new Date("2026-03-10"),
      endDate: new Date("2026-03-12"),
    },
    {
      shortId: "P-2603-061",
      name: "港区マンション手すり交換",
      branchId: branches[1]?.id ?? branches[0].id,
      address: "東京都港区白金台5-7-2",
      startDate: new Date("2026-03-11"),
      endDate: new Date("2026-03-12"),
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

  // ── 見積2件 ──
  const estimates = []
  const estDefs = [
    { projectId: projects[0].id, title: "渋谷戸建 足場見積", amount: 350000 },
    { projectId: projects[1].id, title: "港区マンション 足場見積", amount: 280000 },
  ]
  for (let i = 0; i < estDefs.length; i++) {
    const ed = estDefs[i]
    const estimate = await prisma.estimate.create({
      data: {
        projectId: ed.projectId,
        userId: user.id,
        estimateNumber: `2603-OD${(i + 1).toString().padStart(2, "0")}`,
        revision: 1,
        title: ed.title,
        status: "CONFIRMED",
        confirmedAt: new Date("2026-03-08"),
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

  // ── 契約2件 ──
  const contracts = []
  const cDefs = [
    { num: "C-2603-060", pIdx: 0, eIdx: 0, amount: 350000, start: "2026-03-10", end: "2026-03-12" },
    { num: "C-2603-061", pIdx: 1, eIdx: 1, amount: 280000, start: "2026-03-11", end: "2026-03-12" },
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
        contractDate: new Date("2026-03-08"),
        startDate: new Date(cd.start),
        endDate: new Date(cd.end),
        status: "SCHEDULE_CREATED",
      },
    })
    contracts.push(contract)
    console.log(`  ✅ 契約: ${cd.num}`)
  }

  // ── 工期スケジュール4件（すべて1日・未配置） ──
  const scheduleDefs = [
    // 渋谷戸建: 組立 3/10 (1日)
    {
      contractId: contracts[0].id,
      workType: "ASSEMBLY",
      name: "渋谷戸建 足場組立",
      plannedStartDate: new Date("2026-03-10"),
      plannedEndDate: new Date("2026-03-10"),
      workersCount: 3,
    },
    // 渋谷戸建: 解体 3/12 (1日)
    {
      contractId: contracts[0].id,
      workType: "DISASSEMBLY",
      name: "渋谷戸建 足場解体",
      plannedStartDate: new Date("2026-03-12"),
      plannedEndDate: new Date("2026-03-12"),
      workersCount: 3,
    },
    // 港区マンション: 組立 3/11 (1日)
    {
      contractId: contracts[1].id,
      workType: "ASSEMBLY",
      name: "港区マンション 足場組立",
      plannedStartDate: new Date("2026-03-11"),
      plannedEndDate: new Date("2026-03-11"),
      workersCount: 2,
    },
    // 港区マンション: 解体 3/12 (1日)
    {
      contractId: contracts[1].id,
      workType: "DISASSEMBLY",
      name: "港区マンション 足場解体",
      plannedStartDate: new Date("2026-03-12"),
      plannedEndDate: new Date("2026-03-12"),
      workersCount: 2,
    },
  ]

  for (const sd of scheduleDefs) {
    await prisma.constructionSchedule.create({
      data: {
        contractId: sd.contractId,
        workType: sd.workType,
        name: sd.name,
        plannedStartDate: sd.plannedStartDate,
        plannedEndDate: sd.plannedEndDate,
        workersCount: sd.workersCount,
      },
    })
    console.log(`  ✅ 工程: ${sd.name} (${sd.workType}) - 1日`)
  }

  console.log("")
  console.log("🎉 1日工程テストデータ投入完了！")
  console.log("")
  console.log("投入内容:")
  console.log(`  現場: ${projects.length}件`)
  console.log(`  契約: ${contracts.length}件`)
  console.log(`  1日工程: ${scheduleDefs.length}件`)
  console.log("")
  console.log("人員配置画面で3月8日〜を表示してテストしてください。")
  console.log("未配置バーに1日工程が4件表示されます。")

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("❌ エラー:", e)
  process.exit(1)
})
