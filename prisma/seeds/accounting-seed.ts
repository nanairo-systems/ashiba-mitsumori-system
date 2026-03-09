/**
 * [SEED] 経理システム サンプルデータ投入スクリプト
 *
 * 実行: npx tsx prisma/seeds/accounting-seed.ts
 *
 * 投入データ:
 * - 会社マスター（2件）
 * - 部門マスター（5件 × 2社 = 10件）
 * - 店舗マスター（塗装部門のみ 4件 × 2社 = 8件）
 * - 取引先マスター（10件）
 * - 取引先-部門リレーション（11件）
 * - 外注費サンプル（15件）
 *
 * upsert を使用し、重複登録を防止。既存データは削除しない。
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 経理システム シードデータの投入を開始します...")

  // ────────────────────────────────────────
  // 1. 会社マスター（2件）
  // ────────────────────────────────────────
  console.log("\n📦 会社マスターを投入中...")

  const nanairo = await prisma.accountingCompany.upsert({
    where: { id: "acc-company-nanairo" },
    update: { name: "株式会社七色", colorCode: "#3B82F6", sortOrder: 1 },
    create: {
      id: "acc-company-nanairo",
      name: "株式会社七色",
      colorCode: "#3B82F6",
      sortOrder: 1,
    },
  })
  console.log(`  ✅ ${nanairo.name}`)

  const minami = await prisma.accountingCompany.upsert({
    where: { id: "acc-company-minami" },
    update: { name: "南施工サービス", colorCode: "#22C55E", sortOrder: 2 },
    create: {
      id: "acc-company-minami",
      name: "南施工サービス",
      colorCode: "#22C55E",
      sortOrder: 2,
    },
  })
  console.log(`  ✅ ${minami.name}`)

  // ────────────────────────────────────────
  // 2. 部門マスター（5件 × 2社）
  // ────────────────────────────────────────
  console.log("\n📦 部門マスターを投入中...")

  const deptNames = [
    { suffix: "tosou", name: "塗装", sortOrder: 1 },
    { suffix: "reform", name: "リフォーム", sortOrder: 2 },
    { suffix: "ashiba", name: "足場", sortOrder: 3 },
    { suffix: "baibai", name: "足場買取販売", sortOrder: 4 },
    { suffix: "honbu", name: "本部経費", sortOrder: 5 },
  ]

  const companyList = [
    { company: nanairo, prefix: "nanairo" },
    { company: minami, prefix: "minami" },
  ]

  // 部門IDを格納するMap（後で使う）
  const deptMap: Record<string, string> = {}

  for (const { company, prefix } of companyList) {
    for (const { suffix, name, sortOrder } of deptNames) {
      const id = `acc-dept-${prefix}-${suffix}`
      const dept = await prisma.department.upsert({
        where: { id },
        update: { name, sortOrder },
        create: {
          id,
          companyId: company.id,
          name,
          sortOrder,
        },
      })
      deptMap[`${prefix}-${suffix}`] = dept.id
      console.log(`  ✅ ${company.name} / ${dept.name}`)
    }
  }

  // ────────────────────────────────────────
  // 3. 店舗マスター（塗装部門のみ 4件 × 2社）
  // ────────────────────────────────────────
  console.log("\n📦 店舗マスターを投入中...")

  const storeNames = [
    { suffix: "honsha", name: "本社", sortOrder: 1 },
    { suffix: "midori", name: "緑店", sortOrder: 2 },
    { suffix: "kasugai", name: "春日井店", sortOrder: 3 },
    { suffix: "yokohama", name: "横浜店", sortOrder: 4 },
  ]

  const storeMap: Record<string, string> = {}

  for (const { prefix } of companyList) {
    const tosouDeptId = deptMap[`${prefix}-tosou`]
    const companyName = prefix === "nanairo" ? "七色" : "南施工"
    for (const { suffix, name, sortOrder } of storeNames) {
      const id = `acc-store-${prefix}-${suffix}`
      const store = await prisma.store.upsert({
        where: { id },
        update: { name, sortOrder },
        create: {
          id,
          departmentId: tosouDeptId,
          name,
          sortOrder,
        },
      })
      storeMap[`${prefix}-${suffix}`] = store.id
      console.log(`  ✅ ${companyName} 塗装 / ${store.name}`)
    }
  }

  // ────────────────────────────────────────
  // 4. 取引先マスター（10件）
  // ────────────────────────────────────────
  console.log("\n📦 取引先マスターを投入中...")

  // すべて七色に紐付け（companyId）
  const vendors = [
    {
      id: "acc-vendor-01",
      name: "山田塗装株式会社",
      furigana: "やまだとそう",
      closingType: "MONTH_END" as const,
      hasInvoiceRegistration: true,
      invoiceNumber: "T1234567890123",
      bankName: "三菱UFJ銀行",
      branchName: "名古屋支店",
      accountType: "ORDINARY" as const,
      accountNumber: "1234567",
      accountHolder: "ヤマダトソウ",
      depts: ["tosou"],
    },
    {
      id: "acc-vendor-02",
      name: "鈴木足場工業",
      furigana: "すずきあしばこうぎょう",
      closingType: "MONTH_END" as const,
      hasInvoiceRegistration: true,
      invoiceNumber: "T2345678901234",
      bankName: "名古屋銀行",
      branchName: "栄支店",
      accountType: "ORDINARY" as const,
      accountNumber: "2345678",
      accountHolder: "スズキアシバコウギョウ",
      depts: ["ashiba"],
    },
    {
      id: "acc-vendor-03",
      name: "田中防水工業",
      furigana: "たなかぼうすいこうぎょう",
      closingType: "MONTH_END" as const,
      hasInvoiceRegistration: false,
      invoiceNumber: null,
      bankName: "東海労働金庫",
      branchName: "本店",
      accountType: "ORDINARY" as const,
      accountNumber: "3456789",
      accountHolder: "タナカボウスイコウギョウ",
      depts: ["tosou"],
    },
    {
      id: "acc-vendor-04",
      name: "佐藤シーリング",
      furigana: "さとうしーりんぐ",
      closingType: "MONTH_END" as const,
      hasInvoiceRegistration: true,
      invoiceNumber: "T4567890123456",
      bankName: "愛知銀行",
      branchName: "栄支店",
      accountType: "ORDINARY" as const,
      accountNumber: "4567890",
      accountHolder: "サトウシーリング",
      depts: ["ashiba"],
    },
    {
      id: "acc-vendor-05",
      name: "伊藤建設株式会社",
      furigana: "いとうけんせつ",
      closingType: "MONTH_END" as const,
      hasInvoiceRegistration: true,
      invoiceNumber: "T5678901234567",
      bankName: "三井住友銀行",
      branchName: "名古屋支店",
      accountType: "ORDINARY" as const,
      accountNumber: "5678901",
      accountHolder: "イトウケンセツ",
      depts: ["tosou", "ashiba"],
    },
    {
      id: "acc-vendor-06",
      name: "渡辺リフォーム",
      furigana: "わたなべりふぉーむ",
      closingType: "MONTH_END" as const,
      hasInvoiceRegistration: true,
      invoiceNumber: "T6789012345678",
      bankName: "ゆうちょ銀行",
      branchName: "",
      accountType: "ORDINARY" as const,
      accountNumber: "6789012",
      accountHolder: "ワタナベリフォーム",
      depts: ["reform"],
    },
    {
      id: "acc-vendor-07",
      name: "中村塗装店",
      furigana: "なかむらとそうてん",
      closingType: "MONTH_END" as const,
      hasInvoiceRegistration: false,
      invoiceNumber: null,
      bankName: "名古屋銀行",
      branchName: "金山支店",
      accountType: "ORDINARY" as const,
      accountNumber: "7890123",
      accountHolder: "ナカムラトソウテン",
      depts: ["tosou"],
    },
    {
      id: "acc-vendor-08",
      name: "小林足場サービス",
      furigana: "こばやしあしばさーびす",
      closingType: "MONTH_END" as const,
      hasInvoiceRegistration: true,
      invoiceNumber: "T8901234567890",
      bankName: "三菱UFJ銀行",
      branchName: "栄支店",
      accountType: "ORDINARY" as const,
      accountNumber: "8901234",
      accountHolder: "コバヤシアシバサービス",
      depts: ["ashiba"],
    },
    {
      id: "acc-vendor-09",
      name: "加藤電気工業",
      furigana: "かとうでんきこうぎょう",
      closingType: "MONTH_END" as const,
      hasInvoiceRegistration: true,
      invoiceNumber: "T9012345678901",
      bankName: "愛知銀行",
      branchName: "本店",
      accountType: "ORDINARY" as const,
      accountNumber: "9012345",
      accountHolder: "カトウデンキコウギョウ",
      depts: ["honbu"],
    },
    {
      id: "acc-vendor-10",
      name: "松本個人事業",
      furigana: "まつもとこじんじぎょう",
      closingType: "DAY_15" as const,
      hasInvoiceRegistration: false,
      invoiceNumber: null,
      bankName: "ゆうちょ銀行",
      branchName: "",
      accountType: "ORDINARY" as const,
      accountNumber: "0123456",
      accountHolder: "マツモトコジンジギョウ",
      depts: ["tosou"],
    },
  ]

  for (const v of vendors) {
    const vendor = await prisma.vendor.upsert({
      where: { id: v.id },
      update: {
        name: v.name,
        furigana: v.furigana,
        closingType: v.closingType,
        hasInvoiceRegistration: v.hasInvoiceRegistration,
        invoiceNumber: v.invoiceNumber,
        bankName: v.bankName,
        branchName: v.branchName || null,
        accountType: v.accountType,
        accountNumber: v.accountNumber,
        accountHolder: v.accountHolder,
      },
      create: {
        id: v.id,
        companyId: nanairo.id,
        name: v.name,
        furigana: v.furigana,
        closingType: v.closingType,
        hasInvoiceRegistration: v.hasInvoiceRegistration,
        invoiceNumber: v.invoiceNumber,
        bankName: v.bankName,
        branchName: v.branchName || null,
        accountType: v.accountType,
        accountNumber: v.accountNumber,
        accountHolder: v.accountHolder,
      },
    })
    console.log(`  ✅ ${vendor.name}`)

    // 取引先-部門リレーション
    for (const deptSuffix of v.depts) {
      const departmentId = deptMap[`nanairo-${deptSuffix}`]
      if (!departmentId) continue
      await prisma.vendorDepartment.upsert({
        where: {
          vendorId_departmentId: {
            vendorId: vendor.id,
            departmentId,
          },
        },
        update: {},
        create: {
          vendorId: vendor.id,
          departmentId,
        },
      })
    }
  }

  // ────────────────────────────────────────
  // 5. 外注費サンプル（15件）
  // ────────────────────────────────────────
  console.log("\n📦 外注費サンプルを投入中...")

  const invoiceSamples = [
    // 2026年1月 - 七色
    {
      id: "acc-inv-01",
      vendorId: "acc-vendor-01",
      companyId: nanairo.id,
      departmentId: deptMap["nanairo-tosou"],
      storeId: storeMap["nanairo-honsha"],
      billingYearMonth: new Date(2026, 0, 1),
      amount: 350000,
      closingType: "MONTH_END" as const,
      paymentDueDate: new Date(2026, 1, 28),
      paymentDate: new Date(2026, 1, 28),
      status: "PAID" as const,
      note: "1月分 塗装工事",
    },
    {
      id: "acc-inv-02",
      vendorId: "acc-vendor-02",
      companyId: nanairo.id,
      departmentId: deptMap["nanairo-ashiba"],
      storeId: null,
      billingYearMonth: new Date(2026, 0, 1),
      amount: 780000,
      closingType: "MONTH_END" as const,
      paymentDueDate: new Date(2026, 1, 28),
      paymentDate: new Date(2026, 1, 28),
      status: "PAID" as const,
      note: "1月分 足場組立・解体",
    },
    {
      id: "acc-inv-03",
      vendorId: "acc-vendor-05",
      companyId: nanairo.id,
      departmentId: deptMap["nanairo-tosou"],
      storeId: storeMap["nanairo-midori"],
      billingYearMonth: new Date(2026, 0, 1),
      amount: 250000,
      closingType: "MONTH_END" as const,
      paymentDueDate: new Date(2026, 1, 28),
      paymentDate: new Date(2026, 1, 25),
      status: "PAID" as const,
      note: "1月分 塗装下請け",
    },
    {
      id: "acc-inv-04",
      vendorId: "acc-vendor-10",
      companyId: nanairo.id,
      departmentId: deptMap["nanairo-tosou"],
      storeId: storeMap["nanairo-kasugai"],
      billingYearMonth: new Date(2026, 0, 1),
      amount: 120000,
      closingType: "DAY_15" as const,
      paymentDueDate: new Date(2026, 1, 15),
      paymentDate: new Date(2026, 1, 15),
      status: "PAID" as const,
      note: "1月分 個人外注",
    },
    // 2026年1月 - 南施工
    {
      id: "acc-inv-05",
      vendorId: "acc-vendor-03",
      companyId: minami.id,
      departmentId: deptMap["minami-tosou"],
      storeId: storeMap["minami-honsha"],
      billingYearMonth: new Date(2026, 0, 1),
      amount: 450000,
      closingType: "MONTH_END" as const,
      paymentDueDate: new Date(2026, 1, 28),
      paymentDate: new Date(2026, 1, 28),
      status: "PAID" as const,
      note: "1月分 防水工事",
    },
    // 2026年2月 - 七色
    {
      id: "acc-inv-06",
      vendorId: "acc-vendor-01",
      companyId: nanairo.id,
      departmentId: deptMap["nanairo-tosou"],
      storeId: storeMap["nanairo-honsha"],
      billingYearMonth: new Date(2026, 1, 1),
      amount: 420000,
      closingType: "MONTH_END" as const,
      paymentDueDate: new Date(2026, 2, 31),
      paymentDate: new Date(2026, 2, 30),
      status: "PAID" as const,
      note: "2月分 塗装工事",
    },
    {
      id: "acc-inv-07",
      vendorId: "acc-vendor-04",
      companyId: nanairo.id,
      departmentId: deptMap["nanairo-ashiba"],
      storeId: null,
      billingYearMonth: new Date(2026, 1, 1),
      amount: 550000,
      closingType: "MONTH_END" as const,
      paymentDueDate: new Date(2026, 2, 31),
      paymentDate: null,
      status: "PENDING" as const,
      note: "2月分 シーリング工事",
    },
    {
      id: "acc-inv-08",
      vendorId: "acc-vendor-06",
      companyId: nanairo.id,
      departmentId: deptMap["nanairo-reform"],
      storeId: null,
      billingYearMonth: new Date(2026, 1, 1),
      amount: 980000,
      closingType: "MONTH_END" as const,
      paymentDueDate: new Date(2026, 2, 31),
      paymentDate: null,
      status: "PENDING" as const,
      note: "2月分 リフォーム工事",
    },
    // 2026年2月 - 南施工
    {
      id: "acc-inv-09",
      vendorId: "acc-vendor-07",
      companyId: minami.id,
      departmentId: deptMap["minami-tosou"],
      storeId: storeMap["minami-midori"],
      billingYearMonth: new Date(2026, 1, 1),
      amount: 180000,
      closingType: "MONTH_END" as const,
      paymentDueDate: new Date(2026, 2, 31),
      paymentDate: null,
      status: "PENDING" as const,
      note: "2月分 塗装工事",
    },
    {
      id: "acc-inv-10",
      vendorId: "acc-vendor-08",
      companyId: minami.id,
      departmentId: deptMap["minami-ashiba"],
      storeId: null,
      billingYearMonth: new Date(2026, 1, 1),
      amount: 650000,
      closingType: "MONTH_END" as const,
      paymentDueDate: new Date(2026, 2, 31),
      paymentDate: null,
      status: "PENDING" as const,
      note: "2月分 足場工事",
    },
    // 2026年3月 - 七色
    {
      id: "acc-inv-11",
      vendorId: "acc-vendor-02",
      companyId: nanairo.id,
      departmentId: deptMap["nanairo-ashiba"],
      storeId: null,
      billingYearMonth: new Date(2026, 2, 1),
      amount: 890000,
      closingType: "MONTH_END" as const,
      paymentDueDate: new Date(2026, 3, 30),
      paymentDate: null,
      status: "PENDING" as const,
      note: "3月分 足場組立",
    },
    {
      id: "acc-inv-12",
      vendorId: "acc-vendor-05",
      companyId: nanairo.id,
      departmentId: deptMap["nanairo-tosou"],
      storeId: storeMap["nanairo-yokohama"],
      billingYearMonth: new Date(2026, 2, 1),
      amount: 320000,
      closingType: "MONTH_END" as const,
      paymentDueDate: new Date(2026, 3, 30),
      paymentDate: null,
      status: "PENDING" as const,
      note: "3月分 横浜現場 塗装",
    },
    {
      id: "acc-inv-13",
      vendorId: "acc-vendor-09",
      companyId: nanairo.id,
      departmentId: deptMap["nanairo-honbu"],
      storeId: null,
      billingYearMonth: new Date(2026, 2, 1),
      amount: 150000,
      closingType: "MONTH_END" as const,
      paymentDueDate: new Date(2026, 3, 30),
      paymentDate: null,
      status: "PENDING" as const,
      note: "3月分 電気工事",
    },
    // 2026年3月 - 南施工
    {
      id: "acc-inv-14",
      vendorId: "acc-vendor-03",
      companyId: minami.id,
      departmentId: deptMap["minami-tosou"],
      storeId: storeMap["minami-kasugai"],
      billingYearMonth: new Date(2026, 2, 1),
      amount: 510000,
      closingType: "MONTH_END" as const,
      paymentDueDate: new Date(2026, 3, 30),
      paymentDate: null,
      status: "PENDING" as const,
      note: "3月分 防水工事",
    },
    {
      id: "acc-inv-15",
      vendorId: "acc-vendor-10",
      companyId: minami.id,
      departmentId: deptMap["minami-tosou"],
      storeId: storeMap["minami-honsha"],
      billingYearMonth: new Date(2026, 2, 1),
      amount: 100000,
      closingType: "DAY_15" as const,
      paymentDueDate: new Date(2026, 3, 15),
      paymentDate: null,
      status: "PENDING" as const,
      note: "3月分 個人外注",
    },
  ]

  for (const inv of invoiceSamples) {
    const invoice = await prisma.subcontractorInvoice.upsert({
      where: { id: inv.id },
      update: {
        amount: inv.amount,
        status: inv.status,
        paymentDate: inv.paymentDate,
        note: inv.note,
      },
      create: {
        id: inv.id,
        vendorId: inv.vendorId,
        companyId: inv.companyId,
        departmentId: inv.departmentId,
        storeId: inv.storeId,
        billingYearMonth: inv.billingYearMonth,
        amount: inv.amount,
        closingType: inv.closingType,
        paymentDueDate: inv.paymentDueDate,
        paymentDate: inv.paymentDate,
        status: inv.status,
        note: inv.note,
      },
    })
    console.log(
      `  ✅ ${inv.note} - ¥${inv.amount.toLocaleString()} (${invoice.status})`
    )
  }

  // ────────────────────────────────────────
  // 完了レポート
  // ────────────────────────────────────────
  console.log("\n" + "=".repeat(50))
  console.log("🎉 経理システム シードデータの投入が完了しました！")
  console.log("=".repeat(50))
  console.log(`  会社マスター:     2件`)
  console.log(`  部門マスター:     ${deptNames.length * companyList.length}件`)
  console.log(
    `  店舗マスター:     ${storeNames.length * companyList.length}件`
  )
  console.log(`  取引先マスター:   ${vendors.length}件`)
  console.log(
    `  取引先-部門:      ${vendors.reduce((sum, v) => sum + v.depts.length, 0)}件`
  )
  console.log(`  外注費サンプル:   ${invoiceSamples.length}件`)
  console.log(
    `  合計:             ${2 + deptNames.length * companyList.length + storeNames.length * companyList.length + vendors.length + vendors.reduce((sum, v) => sum + v.depts.length, 0) + invoiceSamples.length}件`
  )
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ エラーが発生しました:", e)
    prisma.$disconnect()
    process.exit(1)
  })
