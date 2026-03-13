/**
 * [SEED] 請求管理ページ確認用サンプルデータ
 *
 * 10件の現場（1〜3月に分散）を複数会社にまたがって作成。
 * 見積 → 契約 → 工程 → 請求/入金まで一通り生成する。
 *
 * 実行: npx tsx prisma/seed-invoices.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

const DAY = 86400000

async function main() {
  console.log("🌱 請求サンプルデータの投入を開始します...")

  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } })
  if (!user) {
    console.error("❌ ユーザーが見つかりません")
    return
  }

  const unitMap: Record<string, string> = {}
  const units = await prisma.unit.findMany()
  for (const u of units) unitMap[u.name] = u.id

  // ── 会社に締め日を設定 ──
  const companySettings: { name: string; closingDay: number | null; monthOffset: number; payDay: number | null }[] = [
    { name: "株式会社山田建設", closingDay: null, monthOffset: 1, payDay: null },       // 末日締め 翌月末払い
    { name: "田中工務店", closingDay: 20, monthOffset: 1, payDay: null },                // 20日締め 翌月末払い
    { name: "鈴木不動産開発株式会社", closingDay: null, monthOffset: 2, payDay: 20 },    // 末日締め 翌々月20日払い
    { name: "中央建設株式会社", closingDay: 25, monthOffset: 1, payDay: 25 },            // 25日締め 翌月25日払い
    { name: "九州建工株式会社", closingDay: null, monthOffset: 1, payDay: null },         // 末日締め 翌月末払い
  ]

  for (const cs of companySettings) {
    await prisma.company.updateMany({
      where: { name: cs.name },
      data: {
        paymentClosingDay: cs.closingDay,
        paymentMonthOffset: cs.monthOffset,
        paymentPayDay: cs.payDay,
      },
    })
  }
  console.log("✅ 会社の締め日設定: 完了")

  // ── 支店・担当者IDを取得 ──
  const branchMap: Record<string, string> = {}
  const branches = await prisma.branch.findMany({ include: { company: true } })
  for (const b of branches) branchMap[`${b.company.name}/${b.name}`] = b.id

  const contactMap: Record<string, string> = {}
  const contacts = await prisma.contact.findMany()
  for (const c of contacts) contactMap[c.email] = c.id

  // ── 10件の現場定義 ──
  const projects = [
    {
      shortId: "P-2601-101",
      name: "山田ビル 屋上防水足場",
      branchKey: "株式会社山田建設/東京本店",
      contactEmail: "yamada.taro@yamada-kensetsu.co.jp",
      address: "東京都港区赤坂3-10-5",
      contractDate: new Date("2025-12-15"),
      startDate: new Date("2026-01-06"),
      endDate: new Date("2026-01-31"),
      status: "COMPLETED" as const,
      amount: 680000,
      title: "屋上防水改修に伴う足場工事",
      schedules: [
        { type: "ASSEMBLY" as const, ps: "2026-01-06", pe: "2026-01-08", as: "2026-01-06", ae: "2026-01-09", w: 3 },
        { type: "DISASSEMBLY" as const, ps: "2026-01-27", pe: "2026-01-29", as: "2026-01-27", ae: "2026-01-30", w: 3 },
      ],
      invoices: [
        { type: "FULL" as const, date: "2026-01-31", due: "2026-02-28", status: "SENT" as const, ratio: 1 },
      ],
    },
    {
      shortId: "P-2601-102",
      name: "山田ビル別館 外壁補修",
      branchKey: "株式会社山田建設/東京本店",
      contactEmail: "yamada.taro@yamada-kensetsu.co.jp",
      address: "東京都港区赤坂3-10-7",
      contractDate: new Date("2026-01-10"),
      startDate: new Date("2026-01-20"),
      endDate: new Date("2026-02-28"),
      status: "IN_PROGRESS" as const,
      amount: 1250000,
      title: "別館外壁タイル補修足場",
      schedules: [
        { type: "ASSEMBLY" as const, ps: "2026-01-20", pe: "2026-01-24", as: "2026-01-20", ae: "2026-01-25", w: 4 },
        { type: "DISASSEMBLY" as const, ps: "2026-02-20", pe: "2026-02-23", as: null, ae: null, w: 3 },
      ],
      invoices: [],
    },
    {
      shortId: "P-2601-103",
      name: "田中マンション新築工事",
      branchKey: "田中工務店/大阪本社",
      contactEmail: "tanaka.ichiro@tanaka-koumuten.co.jp",
      address: "大阪府大阪市中央区心斎橋1-5-8",
      contractDate: new Date("2025-12-20"),
      startDate: new Date("2026-01-08"),
      endDate: new Date("2026-02-15"),
      status: "BILLED" as const,
      amount: 2100000,
      title: "新築マンション仮設足場一式",
      schedules: [
        { type: "ASSEMBLY" as const, ps: "2026-01-08", pe: "2026-01-14", as: "2026-01-08", ae: "2026-01-14", w: 5 },
        { type: "DISASSEMBLY" as const, ps: "2026-02-05", pe: "2026-02-10", as: "2026-02-05", ae: "2026-02-10", w: 4 },
      ],
      invoices: [
        { type: "ASSEMBLY" as const, date: "2026-01-20", due: "2026-02-28", status: "PAID" as const, ratio: 0.6 },
        { type: "DISASSEMBLY" as const, date: "2026-02-20", due: "2026-03-31", status: "SENT" as const, ratio: 0.4 },
      ],
    },
    {
      shortId: "P-2602-104",
      name: "田中工務店 堺市倉庫塗装",
      branchKey: "田中工務店/大阪本社",
      contactEmail: "sato.jiro@tanaka-koumuten.co.jp",
      address: "大阪府堺市堺区南三国ヶ丘3-2-1",
      contractDate: new Date("2026-01-25"),
      startDate: new Date("2026-02-03"),
      endDate: new Date("2026-02-28"),
      status: "COMPLETED" as const,
      amount: 890000,
      title: "倉庫外壁塗装工事に伴う足場",
      schedules: [
        { type: "ASSEMBLY" as const, ps: "2026-02-03", pe: "2026-02-05", as: "2026-02-03", ae: "2026-02-05", w: 3 },
        { type: "DISASSEMBLY" as const, ps: "2026-02-24", pe: "2026-02-26", as: "2026-02-24", ae: "2026-02-26", w: 3 },
      ],
      invoices: [
        { type: "FULL" as const, date: "2026-02-20", due: "2026-03-31", status: "SENT" as const, ratio: 1 },
      ],
    },
    {
      shortId: "P-2602-105",
      name: "鈴木レジデンス名古屋 大規模修繕",
      branchKey: "鈴木不動産開発株式会社/名古屋本店",
      contactEmail: "suzuki.saburo@suzuki-fudosan.co.jp",
      address: "愛知県名古屋市千種区星が丘2-15-3",
      contractDate: new Date("2026-01-05"),
      startDate: new Date("2026-01-15"),
      endDate: new Date("2026-03-31"),
      status: "IN_PROGRESS" as const,
      amount: 3500000,
      title: "大規模修繕工事 仮設足場（全面）",
      schedules: [
        { type: "ASSEMBLY" as const, ps: "2026-01-15", pe: "2026-01-22", as: "2026-01-15", ae: "2026-01-23", w: 6 },
        { type: "DISASSEMBLY" as const, ps: "2026-03-20", pe: "2026-03-27", as: null, ae: null, w: 5 },
      ],
      invoices: [
        { type: "PROGRESS" as const, date: "2026-01-31", due: "2026-03-20", status: "PAID" as const, ratio: 0.3, notes: "第1回出来高" },
        { type: "PROGRESS" as const, date: "2026-02-28", due: "2026-04-20", status: "SENT" as const, ratio: 0.3, notes: "第2回出来高" },
      ],
    },
    {
      shortId: "P-2602-106",
      name: "鈴木不動産 静岡テナントビル改修",
      branchKey: "鈴木不動産開発株式会社/静岡支店",
      contactEmail: "suzuki.saburo@suzuki-fudosan.co.jp",
      address: "静岡県静岡市葵区呉服町1-8-2",
      contractDate: new Date("2026-02-01"),
      startDate: new Date("2026-02-10"),
      endDate: new Date("2026-03-15"),
      status: "SCHEDULE_CREATED" as const,
      amount: 1450000,
      title: "テナントビル外壁改修足場",
      schedules: [
        { type: "ASSEMBLY" as const, ps: "2026-02-10", pe: "2026-02-14", as: null, ae: null, w: 4 },
        { type: "DISASSEMBLY" as const, ps: "2026-03-10", pe: "2026-03-13", as: null, ae: null, w: 3 },
      ],
      invoices: [],
    },
    {
      shortId: "P-2601-107",
      name: "中央建設 札幌駅前再開発",
      branchKey: "中央建設株式会社/札幌本社",
      contactEmail: "takahashi@chuo-kensetsu.co.jp",
      address: "北海道札幌市北区北7条西4-1-1",
      contractDate: new Date("2025-11-20"),
      startDate: new Date("2025-12-10"),
      endDate: new Date("2026-02-28"),
      status: "PAID" as const,
      amount: 4200000,
      title: "駅前再開発ビル仮設足場",
      schedules: [
        { type: "ASSEMBLY" as const, ps: "2025-12-10", pe: "2025-12-18", as: "2025-12-10", ae: "2025-12-18", w: 6 },
        { type: "DISASSEMBLY" as const, ps: "2026-02-16", pe: "2026-02-22", as: "2026-02-16", ae: "2026-02-23", w: 5 },
        { type: "REWORK" as const, ps: "2026-02-24", pe: "2026-02-25", as: "2026-02-24", ae: "2026-02-25", w: 2 },
      ],
      invoices: [
        { type: "ASSEMBLY" as const, date: "2025-12-25", due: "2026-01-25", status: "PAID" as const, ratio: 0.5 },
        { type: "DISASSEMBLY" as const, date: "2026-02-25", due: "2026-03-25", status: "PAID" as const, ratio: 0.5 },
      ],
    },
    {
      shortId: "P-2602-108",
      name: "中央建設 旭川工場増築",
      branchKey: "中央建設株式会社/札幌本社",
      contactEmail: "ito@chuo-kensetsu.co.jp",
      address: "北海道旭川市工業団地1-3-5",
      contractDate: new Date("2026-02-10"),
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-04-15"),
      status: "CONTRACTED" as const,
      amount: 1800000,
      title: "工場増築に伴う足場工事",
      schedules: [],
      invoices: [],
    },
    {
      shortId: "P-2601-109",
      name: "九州建工 博多駅南ホテル新築",
      branchKey: "九州建工株式会社/福岡本社",
      contactEmail: "watanabe@kyushu-kenkou.co.jp",
      address: "福岡県福岡市博多区博多駅南2-4-6",
      contractDate: new Date("2025-12-01"),
      startDate: new Date("2026-01-10"),
      endDate: new Date("2026-03-20"),
      status: "COMPLETED" as const,
      amount: 2800000,
      title: "ホテル新築工事 仮設足場",
      schedules: [
        { type: "ASSEMBLY" as const, ps: "2026-01-10", pe: "2026-01-17", as: "2026-01-10", ae: "2026-01-18", w: 5 },
        { type: "DISASSEMBLY" as const, ps: "2026-03-05", pe: "2026-03-10", as: "2026-03-05", ae: "2026-03-11", w: 4 },
      ],
      invoices: [
        { type: "FULL" as const, date: "2026-03-11", due: "2026-04-30", status: "DRAFT" as const, ratio: 1 },
      ],
    },
    {
      shortId: "P-2602-110",
      name: "九州建工 熊本城周辺歩道橋",
      branchKey: "九州建工株式会社/熊本支店",
      contactEmail: "watanabe@kyushu-kenkou.co.jp",
      address: "熊本県熊本市中央区城東町5-1",
      contractDate: new Date("2026-01-20"),
      startDate: new Date("2026-02-01"),
      endDate: new Date("2026-03-10"),
      status: "BILLED" as const,
      amount: 950000,
      title: "歩道橋補修工事用足場",
      schedules: [
        { type: "ASSEMBLY" as const, ps: "2026-02-01", pe: "2026-02-03", as: "2026-02-01", ae: "2026-02-03", w: 3 },
        { type: "DISASSEMBLY" as const, ps: "2026-03-05", pe: "2026-03-07", as: "2026-03-05", ae: "2026-03-07", w: 2 },
      ],
      invoices: [
        { type: "FULL" as const, date: "2026-02-28", due: "2026-03-31", status: "SENT" as const, ratio: 1 },
      ],
    },
  ]

  // ── 各現場を作成 ──
  for (const def of projects) {
    const branchId = branchMap[def.branchKey]
    if (!branchId) {
      console.error(`❌ 支店なし: ${def.branchKey}`)
      continue
    }
    const contactId = contactMap[def.contactEmail] ?? null

    const existing = await prisma.project.findUnique({ where: { shortId: def.shortId } })
    if (existing) {
      console.log(`⏭️  スキップ（既存）: ${def.name}`)
      continue
    }

    const project = await prisma.project.create({
      data: {
        shortId: def.shortId,
        name: def.name,
        branchId,
        contactId,
        address: def.address,
      },
    })

    const taxRate = 0.10
    const subtotal = def.amount
    const tax = Math.floor(subtotal * taxRate)
    const total = subtotal + tax

    const estimate = await prisma.estimate.create({
      data: {
        projectId: project.id,
        userId: user.id,
        status: "CONFIRMED",
        estimateNumber: `26${def.shortId.split("-")[1].slice(2)}-${def.shortId.split("-")[2]}`,
        revision: 1,
        title: def.title,
        confirmedAt: new Date(def.contractDate.getTime() - 3 * DAY),
        sections: {
          create: [
            {
              name: "足場工事",
              sortOrder: 1,
              groups: {
                create: [
                  {
                    name: "仮設足場",
                    sortOrder: 1,
                    items: {
                      create: [
                        {
                          name: "くさび緊結式足場 組立・解体",
                          quantity: Math.round(subtotal * 0.7 / 800),
                          unitId: unitMap["㎡"],
                          unitPrice: 800,
                          sortOrder: 1,
                        },
                        {
                          name: "養生シート",
                          quantity: Math.round(subtotal * 0.7 / 800),
                          unitId: unitMap["㎡"],
                          unitPrice: 300,
                          sortOrder: 2,
                        },
                      ],
                    },
                  },
                ],
              },
            },
            {
              name: "諸経費",
              sortOrder: 2,
              groups: {
                create: [
                  {
                    name: "その他",
                    sortOrder: 1,
                    items: {
                      create: [
                        {
                          name: "運搬費・搬出入費",
                          quantity: 1,
                          unitId: unitMap["一式"],
                          unitPrice: Math.round(subtotal * 0.08),
                          sortOrder: 1,
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    })

    const contractNumber = `C-${def.shortId.split("-")[1]}-${def.shortId.split("-")[2]}`
    const existingContract = await prisma.contract.findFirst({ where: { contractNumber } })
    if (existingContract) {
      console.log(`⏭️  契約スキップ: ${contractNumber}`)
      continue
    }

    const contract = await prisma.contract.create({
      data: {
        contractNumber,
        projectId: project.id,
        estimateId: estimate.id,
        contractAmount: subtotal,
        taxAmount: tax,
        totalAmount: total,
        contractDate: def.contractDate,
        startDate: def.startDate,
        endDate: def.endDate,
        paymentTerms: "締め日に基づく支払い",
        status: def.status,
      },
    })

    // ── 工事区分 ──
    await prisma.contractWork.create({
      data: {
        contractId: contract.id,
        workType: "INHOUSE",
        workerCount: 3 + Math.floor(subtotal / 1000000),
        workDays: Math.ceil((def.endDate.getTime() - def.startDate.getTime()) / DAY / 5),
      },
    })

    // ── 工程スケジュール ──
    for (const sch of def.schedules) {
      await prisma.constructionSchedule.create({
        data: {
          contractId: contract.id,
          projectId: project.id,
          workType: sch.type,
          plannedStartDate: new Date(sch.ps),
          plannedEndDate: new Date(sch.pe),
          actualStartDate: sch.as ? new Date(sch.as) : null,
          actualEndDate: sch.ae ? new Date(sch.ae) : null,
          workersCount: sch.w,
        },
      })
    }

    // ── 請求 ──
    for (let i = 0; i < def.invoices.length; i++) {
      const inv = def.invoices[i]
      const invAmount = Math.floor(subtotal * inv.ratio)
      const invTax = Math.floor(invAmount * taxRate)
      const invTotal = invAmount + invTax

      const invNumber = `INV-${def.shortId.split("-")[1]}-${def.shortId.split("-")[2]}${def.invoices.length > 1 ? `-${i + 1}` : ""}`
      const existingInv = await prisma.invoice.findFirst({ where: { invoiceNumber: invNumber } })
      if (existingInv) continue

      const invoice = await prisma.invoice.create({
        data: {
          contractId: contract.id,
          invoiceNumber: invNumber,
          invoiceType: inv.type,
          amount: invAmount,
          taxAmount: invTax,
          totalAmount: invTotal,
          invoiceDate: new Date(inv.date),
          dueDate: new Date(inv.due),
          status: inv.status,
          paidAmount: inv.status === "PAID" ? invTotal : null,
          paidAt: inv.status === "PAID" ? new Date(new Date(inv.due).getTime() - 2 * DAY) : null,
          notes: (inv as { notes?: string }).notes ?? null,
        },
      })

      if (inv.status === "PAID") {
        const fee = 440
        await prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            paymentDate: new Date(new Date(inv.due).getTime() - 2 * DAY),
            paymentAmount: invTotal - fee,
            transferFee: fee,
            discountAmount: 0,
            notes: "振込手数料先方負担",
          },
        })
      }
    }

    console.log(`✅ ${def.name}（${def.status}）: 現場・見積・契約・工程・請求 作成完了`)
  }

  console.log("\n🎉 請求サンプルデータの投入が完了しました！")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
