/**
 * [SEED] 工期管理サンプルデータ投入スクリプト
 *
 * 3月9日〜15日の1週間の現場データと配置済みスケジュールを投入する。
 *
 * 実行: npx tsx prisma/seed-sample-schedules.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 工期管理サンプルデータの投入を開始します...")

  // ── 既存のブランチを取得 ──
  const branches = await prisma.branch.findMany({
    include: { company: true },
    take: 5,
  })
  if (branches.length === 0) throw new Error("ブランチが存在しません")

  // ── 既存のユーザーを取得 ──
  const user = await prisma.user.findFirst({ where: { email: "staff@ashiba-sample.com" } })
  if (!user) throw new Error("ユーザーが存在しません")

  // ── 既存の単位を取得 ──
  const unitIshiki = await prisma.unit.findFirst({ where: { name: "一式" } })
  const unitM2 = await prisma.unit.findFirst({ where: { name: "㎡" } })
  const unitM = await prisma.unit.findFirst({ where: { name: "m" } })
  if (!unitIshiki || !unitM2 || !unitM) throw new Error("単位マスターが不足しています")

  // ────────────────────────────────────────
  // 1. 新規現場の作成（4件）
  // ────────────────────────────────────────
  const projectDefs = [
    {
      shortId: "P-2603-028",
      name: "渋谷駅前ビル外壁改修工事",
      branchId: branches[0].id,
      address: "東京都渋谷区渋谷2-1-1",
      startDate: new Date("2026-03-09"),
      endDate: new Date("2026-03-20"),
    },
    {
      shortId: "P-2603-029",
      name: "新宿タワーマンション新築足場",
      branchId: branches[1]?.id ?? branches[0].id,
      address: "東京都新宿区西新宿6-10-5",
      startDate: new Date("2026-03-09"),
      endDate: new Date("2026-03-22"),
    },
    {
      shortId: "P-2603-030",
      name: "横浜港南台中学校体育館改修",
      branchId: branches[2]?.id ?? branches[0].id,
      address: "神奈川県横浜市港南区港南台5-2-1",
      startDate: new Date("2026-03-10"),
      endDate: new Date("2026-03-17"),
    },
    {
      shortId: "P-2603-031",
      name: "品川倉庫解体工事",
      branchId: branches[0].id,
      address: "東京都品川区東品川4-3-12",
      startDate: new Date("2026-03-11"),
      endDate: new Date("2026-03-15"),
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
    console.log(`  ✅ 現場: ${pd.name} (${pd.shortId})`)
  }

  // ────────────────────────────────────────
  // 2. 見積の作成（各現場に1件）
  // ────────────────────────────────────────
  const estimateDefs = [
    { projectId: projects[0].id, title: "渋谷ビル外壁 足場見積", amount: 2500000 },
    { projectId: projects[1].id, title: "新宿タワー 足場見積", amount: 8500000 },
    { projectId: projects[2].id, title: "港南台中学校 足場見積", amount: 1200000 },
    { projectId: projects[3].id, title: "品川倉庫 解体足場見積", amount: 900000 },
  ]

  const estimates = []
  for (let i = 0; i < estimateDefs.length; i++) {
    const ed = estimateDefs[i]
    const taxRate = 0.10
    const taxAmount = Math.floor(ed.amount * taxRate)

    const estimate = await prisma.estimate.create({
      data: {
        projectId: ed.projectId,
        userId: user.id,
        estimateNumber: `2603-S${(i + 1).toString().padStart(2, "0")}`,
        revision: 1,
        title: ed.title,
        status: "CONFIRMED",
        confirmedAt: new Date("2026-03-07"),
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
                    quantity: ed.amount / 1200,
                    unitId: unitM2.id,
                    unitPrice: 1200,
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

  // ────────────────────────────────────────
  // 3. 契約の作成（各現場に1件）
  // ────────────────────────────────────────
  const contractDefs = [
    {
      contractNumber: "C-2603-008",
      projectId: projects[0].id,
      estimateId: estimates[0].id,
      amount: 2500000,
      startDate: new Date("2026-03-09"),
      endDate: new Date("2026-03-20"),
      status: "IN_PROGRESS" as const,
    },
    {
      contractNumber: "C-2603-009",
      projectId: projects[1].id,
      estimateId: estimates[1].id,
      amount: 8500000,
      startDate: new Date("2026-03-09"),
      endDate: new Date("2026-03-22"),
      status: "IN_PROGRESS" as const,
    },
    {
      contractNumber: "C-2603-010",
      projectId: projects[2].id,
      estimateId: estimates[2].id,
      amount: 1200000,
      startDate: new Date("2026-03-10"),
      endDate: new Date("2026-03-17"),
      status: "SCHEDULE_CREATED" as const,
    },
    {
      contractNumber: "C-2603-011",
      projectId: projects[3].id,
      estimateId: estimates[3].id,
      amount: 900000,
      startDate: new Date("2026-03-11"),
      endDate: new Date("2026-03-15"),
      status: "SCHEDULE_CREATED" as const,
    },
  ]

  const contracts = []
  for (const cd of contractDefs) {
    const taxAmount = Math.floor(cd.amount * 0.10)
    const contract = await prisma.contract.create({
      data: {
        contractNumber: cd.contractNumber,
        projectId: cd.projectId,
        estimateId: cd.estimateId,
        contractAmount: cd.amount,
        taxAmount: taxAmount,
        totalAmount: cd.amount + taxAmount,
        discountAmount: 0,
        contractDate: new Date("2026-03-07"),
        startDate: cd.startDate,
        endDate: cd.endDate,
        status: cd.status,
      },
    })
    contracts.push(contract)
    console.log(`  ✅ 契約: ${cd.contractNumber}`)
  }

  // ────────────────────────────────────────
  // 4. 工事区分の作成（各契約に自社工事）
  // ────────────────────────────────────────
  const workDefs = [
    // 渋谷ビル: 職長1名+職人4名=5人、6日
    { contractId: contracts[0].id, workerCount: 5, workDays: 6, note: "職長: 佐藤、職人4名" },
    // 新宿タワー: 職長2名+職人8名=10人、10日
    { contractId: contracts[1].id, workerCount: 10, workDays: 10, note: "職長: 田中・山本、職人8名" },
    // 港南台中学校: 職長1名+職人3名=4人、5日
    { contractId: contracts[2].id, workerCount: 4, workDays: 5, note: "職長: 鈴木、職人3名" },
    // 品川倉庫: 職長1名+職人2名=3人、3日
    { contractId: contracts[3].id, workerCount: 3, workDays: 3, note: "職長: 高橋、職人2名" },
  ]

  for (const wd of workDefs) {
    await prisma.contractWork.create({
      data: {
        contractId: wd.contractId,
        workType: "INHOUSE",
        workerCount: wd.workerCount,
        workDays: wd.workDays,
        note: wd.note,
      },
    })
    console.log(`  ✅ 工事区分: ${wd.note}`)
  }

  // ────────────────────────────────────────
  // 5. 工期スケジュールの作成（配置済みデータ）
  // ────────────────────────────────────────
  const scheduleDefs = [
    // === 渋谷ビル外壁改修工事 ===
    // 組立: 3/9-3/12 (4日間) 職長1名+職人4名=5人
    {
      contractId: contracts[0].id,
      workType: "ASSEMBLY",
      name: "渋谷ビル 南面足場組立",
      plannedStartDate: new Date("2026-03-09"),
      plannedEndDate: new Date("2026-03-12"),
      actualStartDate: new Date("2026-03-09"),
      actualEndDate: null,
      workersCount: 5,
      notes: "職長: 佐藤 / 職人: 中村・小林・渡辺・伊藤",
    },
    // 組立: 3/13-3/15 (3日間) 職長1名+職人3名=4人
    {
      contractId: contracts[0].id,
      workType: "ASSEMBLY",
      name: "渋谷ビル 北面足場組立",
      plannedStartDate: new Date("2026-03-13"),
      plannedEndDate: new Date("2026-03-15"),
      workersCount: 4,
      notes: "職長: 佐藤 / 職人: 中村・小林・渡辺",
    },
    // 解体: 3/16-3/18 (3日間) 職長1名+職人3名=4人
    {
      contractId: contracts[0].id,
      workType: "DISASSEMBLY",
      name: "渋谷ビル 南面足場解体",
      plannedStartDate: new Date("2026-03-16"),
      plannedEndDate: new Date("2026-03-18"),
      workersCount: 4,
      notes: "職長: 佐藤 / 職人: 中村・伊藤・加藤",
    },

    // === 新宿タワーマンション新築足場 ===
    // 組立: 3/9-3/14 (6日間) 職長2名+職人8名=10人
    {
      contractId: contracts[1].id,
      workType: "ASSEMBLY",
      name: "新宿タワー 東面1-5F組立",
      plannedStartDate: new Date("2026-03-09"),
      plannedEndDate: new Date("2026-03-11"),
      actualStartDate: new Date("2026-03-09"),
      actualEndDate: null,
      workersCount: 6,
      notes: "職長: 田中 / 職人: 木村・山口・松本・井上・石川",
    },
    {
      contractId: contracts[1].id,
      workType: "ASSEMBLY",
      name: "新宿タワー 東面6-10F組立",
      plannedStartDate: new Date("2026-03-12"),
      plannedEndDate: new Date("2026-03-14"),
      workersCount: 6,
      notes: "職長: 田中 / 職人: 木村・山口・松本・井上・石川",
    },
    {
      contractId: contracts[1].id,
      workType: "ASSEMBLY",
      name: "新宿タワー 西面1-5F組立",
      plannedStartDate: new Date("2026-03-09"),
      plannedEndDate: new Date("2026-03-11"),
      actualStartDate: new Date("2026-03-09"),
      actualEndDate: null,
      workersCount: 5,
      notes: "職長: 山本 / 職人: 斎藤・藤田・前田・岡田",
    },
    {
      contractId: contracts[1].id,
      workType: "ASSEMBLY",
      name: "新宿タワー 西面6-10F組立",
      plannedStartDate: new Date("2026-03-12"),
      plannedEndDate: new Date("2026-03-15"),
      workersCount: 5,
      notes: "職長: 山本 / 職人: 斎藤・藤田・前田・岡田",
    },
    // その他: 3/10-3/10 養生作業
    {
      contractId: contracts[1].id,
      workType: "REWORK",
      name: "新宿タワー 養生シート張り",
      plannedStartDate: new Date("2026-03-10"),
      plannedEndDate: new Date("2026-03-10"),
      actualStartDate: new Date("2026-03-10"),
      actualEndDate: new Date("2026-03-10"),
      workersCount: 3,
      notes: "職長: 田中 / 職人: 木村・山口",
    },
    // 解体: 3/16-3/22
    {
      contractId: contracts[1].id,
      workType: "DISASSEMBLY",
      name: "新宿タワー 東面解体",
      plannedStartDate: new Date("2026-03-16"),
      plannedEndDate: new Date("2026-03-19"),
      workersCount: 6,
      notes: "職長: 田中 / 職人: 木村・山口・松本・井上・石川",
    },
    {
      contractId: contracts[1].id,
      workType: "DISASSEMBLY",
      name: "新宿タワー 西面解体",
      plannedStartDate: new Date("2026-03-19"),
      plannedEndDate: new Date("2026-03-22"),
      workersCount: 5,
      notes: "職長: 山本 / 職人: 斎藤・藤田・前田・岡田",
    },

    // === 港南台中学校体育館改修 ===
    // 組立: 3/10-3/12 (3日間) 職長1名+職人3名=4人
    {
      contractId: contracts[2].id,
      workType: "ASSEMBLY",
      name: "体育館 正面足場組立",
      plannedStartDate: new Date("2026-03-10"),
      plannedEndDate: new Date("2026-03-12"),
      workersCount: 4,
      notes: "職長: 鈴木 / 職人: 吉田・佐々木・高田",
    },
    // 組立: 3/12-3/13 (2日間) 職長1名+職人2名=3人
    {
      contractId: contracts[2].id,
      workType: "ASSEMBLY",
      name: "体育館 裏面足場組立",
      plannedStartDate: new Date("2026-03-12"),
      plannedEndDate: new Date("2026-03-13"),
      workersCount: 3,
      notes: "職長: 鈴木 / 職人: 吉田・佐々木",
    },
    // 解体: 3/15-3/17 (3日間)
    {
      contractId: contracts[2].id,
      workType: "DISASSEMBLY",
      name: "体育館 全面解体",
      plannedStartDate: new Date("2026-03-15"),
      plannedEndDate: new Date("2026-03-17"),
      workersCount: 4,
      notes: "職長: 鈴木 / 職人: 吉田・佐々木・高田",
    },

    // === 品川倉庫解体工事 ===
    // 組立: 3/11-3/12 (2日間) 職長1名+職人2名=3人
    {
      contractId: contracts[3].id,
      workType: "ASSEMBLY",
      name: "品川倉庫 足場組立",
      plannedStartDate: new Date("2026-03-11"),
      plannedEndDate: new Date("2026-03-12"),
      workersCount: 3,
      notes: "職長: 高橋 / 職人: 林・清水",
    },
    // 解体: 3/14-3/15 (2日間)
    {
      contractId: contracts[3].id,
      workType: "DISASSEMBLY",
      name: "品川倉庫 足場解体",
      plannedStartDate: new Date("2026-03-14"),
      plannedEndDate: new Date("2026-03-15"),
      workersCount: 3,
      notes: "職長: 高橋 / 職人: 林・清水",
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
        actualStartDate: sd.actualStartDate ?? null,
        actualEndDate: sd.actualEndDate ?? null,
        workersCount: sd.workersCount,
        notes: sd.notes,
      },
    })
    console.log(`  ✅ スケジュール: ${sd.name} (${sd.workType}, ${sd.workersCount}人)`)
  }

  console.log("")
  console.log("🎉 サンプルデータ投入完了！")
  console.log("")
  console.log("投入内容:")
  console.log(`  現場: ${projects.length}件`)
  console.log(`  見積: ${estimates.length}件`)
  console.log(`  契約: ${contracts.length}件`)
  console.log(`  工事区分: ${workDefs.length}件`)
  console.log(`  工期スケジュール: ${scheduleDefs.length}件`)
  console.log("")
  console.log("現場一覧:")
  for (const p of projects) {
    const pd = projectDefs.find(d => d.shortId === p.shortId)!
    console.log(`  ${p.shortId}: ${pd.name} (${pd.startDate.toLocaleDateString("ja-JP")}〜${pd.endDate.toLocaleDateString("ja-JP")})`)
  }
  console.log("")
  console.log("配置済み職長・職人:")
  console.log("  佐藤 (職長) - 渋谷ビル: 中村・小林・渡辺・伊藤")
  console.log("  田中 (職長) - 新宿タワー東面: 木村・山口・松本・井上・石川")
  console.log("  山本 (職長) - 新宿タワー西面: 斎藤・藤田・前田・岡田")
  console.log("  鈴木 (職長) - 港南台中学校: 吉田・佐々木・高田")
  console.log("  高橋 (職長) - 品川倉庫: 林・清水")

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("❌ エラー:", e)
  process.exit(1)
})
