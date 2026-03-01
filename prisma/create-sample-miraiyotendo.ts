/**
 * 土木現場「未来養天堂」サンプル見積 + 3ページテンプレート作成スクリプト
 * 実行: npx tsx prisma/create-sample-miraiyotendo.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 未来養天堂サンプルデータを作成します...")

  // ── 既存データを取得 ──
  const company = await prisma.company.findFirst({
    where: { name: "株式会社山田建設" },
    include: { branches: true, contacts: true },
  })
  if (!company) throw new Error("株式会社山田建設 が見つかりません。先に seed を実行してください。")

  const branch = company.branches[0]
  const contact = company.contacts[0] ?? null

  const user = await prisma.user.findFirst()
  if (!user) throw new Error("ユーザーが見つかりません。")

  // 単位マップ
  const allUnits = await prisma.unit.findMany()
  const uMap: Record<string, string> = {}
  for (const u of allUnits) uMap[u.name] = u.id

  // 足りない単位を追加
  const extraUnits = ["m³", "t", "本", "台", "kg", "L", "人工"]
  for (const name of extraUnits) {
    if (!uMap[name]) {
      const u = await prisma.unit.upsert({
        where: { name },
        update: {},
        create: { name },
      })
      uMap[name] = u.id
    }
  }

  // ── shortId を生成 ──
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const count = await prisma.project.count()
  const shortId = `P-${yy}${mm}-${String(count + 1).padStart(3, "0")}`

  // ── 現場「未来養天堂」を作成 ──
  const project = await prisma.project.create({
    data: {
      shortId,
      name: "未来養天堂 土木整備工事",
      branchId: branch.id,
      contactId: contact?.id ?? null,
    },
  })
  console.log(`✅ 現場作成: ${project.name} (${project.shortId})`)

  // ── 見積番号 ──
  const estCount = await prisma.estimate.count()
  const estimateNumber = `E-${yy}${mm}-${String(estCount + 1).padStart(3, "0")}`

  // ── 3ページ分の明細定義 ──
  type Item = { name: string; qty: number; unit: string; price: number }
  type Group = { name: string; items: Item[] }
  type Section = { name: string; groups: Group[] }

  const sections: Section[] = [
    {
      name: "第1章 仮設工事",
      groups: [
        {
          name: "準備工",
          items: [
            { name: "現場準備・片付け", qty: 1, unit: "式", price: 180000 },
            { name: "仮囲い設置・撤去（H=1.8m）", qty: 85, unit: "m", price: 3200 },
            { name: "仮設ゲート（電動式）", qty: 2, unit: "箇所", price: 125000 },
            { name: "仮設事務所設置・撤去", qty: 1, unit: "式", price: 350000 },
            { name: "仮設トイレ（工事期間中）", qty: 2, unit: "台", price: 85000 },
          ],
        },
        {
          name: "安全施設等",
          items: [
            { name: "保安灯設置（夜間工事対応）", qty: 20, unit: "台", price: 4500 },
            { name: "安全ネット設置", qty: 120, unit: "㎡", price: 1800 },
            { name: "工事看板・標識類", qty: 1, unit: "式", price: 95000 },
            { name: "交通誘導員（2名×20日）", qty: 40, unit: "人工", price: 18500 },
            { name: "墜落防止ネット", qty: 60, unit: "㎡", price: 2200 },
          ],
        },
        {
          name: "測量・調査",
          items: [
            { name: "施工前測量", qty: 1, unit: "式", price: 280000 },
            { name: "土質調査・ボーリング（N値取得）", qty: 3, unit: "箇所", price: 95000 },
            { name: "施工中・完了測量", qty: 1, unit: "式", price: 180000 },
          ],
        },
      ],
    },
    {
      name: "第2章 土工事",
      groups: [
        {
          name: "掘削工",
          items: [
            { name: "表土剥ぎ取り（平均t=0.3m）", qty: 420, unit: "㎡", price: 1500 },
            { name: "床付け掘削（バックホウ0.45㎥）", qty: 850, unit: "m³", price: 2800 },
            { name: "基礎掘削（手掘り含む）", qty: 180, unit: "m³", price: 4200 },
            { name: "土留め工（親杭横矢板）", qty: 65, unit: "m", price: 28000 },
            { name: "切梁・腹起し工", qty: 1, unit: "式", price: 450000 },
          ],
        },
        {
          name: "残土処分工",
          items: [
            { name: "残土積込（バックホウ）", qty: 980, unit: "m³", price: 1200 },
            { name: "残土運搬（10t ダンプ）", qty: 980, unit: "m³", price: 2500 },
            { name: "残土処分費", qty: 980, unit: "m³", price: 3800 },
            { name: "産廃マニフェスト手続き", qty: 1, unit: "式", price: 45000 },
          ],
        },
        {
          name: "埋め戻し・転圧工",
          items: [
            { name: "RC40砕石 埋め戻し", qty: 350, unit: "m³", price: 5500 },
            { name: "砂 埋め戻し", qty: 120, unit: "m³", price: 4800 },
            { name: "転圧（振動ローラー）", qty: 420, unit: "㎡", price: 800 },
            { name: "残土購入・補充土", qty: 80, unit: "m³", price: 3500 },
          ],
        },
      ],
    },
    {
      name: "第3章 基礎・躯体工事",
      groups: [
        {
          name: "地業工事",
          items: [
            { name: "砕石地業（RC40 t=150mm）", qty: 280, unit: "㎡", price: 2800 },
            { name: "砂利地業（t=100mm）", qty: 150, unit: "㎡", price: 2200 },
            { name: "防湿シート敷設", qty: 280, unit: "㎡", price: 350 },
            { name: "捨てコンクリート（Fc=15N/㎡ t=50mm）", qty: 280, unit: "㎡", price: 1500 },
          ],
        },
        {
          name: "鉄筋工事",
          items: [
            { name: "異形鉄筋 D13（基礎）", qty: 12, unit: "t", price: 185000 },
            { name: "異形鉄筋 D16（梁・柱）", qty: 8, unit: "t", price: 190000 },
            { name: "鉄筋加工・組立費", qty: 20, unit: "t", price: 45000 },
            { name: "スペーサー・結束線", qty: 1, unit: "式", price: 38000 },
          ],
        },
        {
          name: "コンクリート工事",
          items: [
            { name: "生コンクリート Fc=21N/㎜² 基礎", qty: 95, unit: "m³", price: 18500 },
            { name: "生コンクリート Fc=24N/㎜² 躯体", qty: 130, unit: "m³", price: 19800 },
            { name: "コンクリートポンプ圧送", qty: 225, unit: "m³", price: 5500 },
            { name: "型枠（合板・桟木）", qty: 480, unit: "㎡", price: 4200 },
            { name: "型枠剥離・清掃", qty: 480, unit: "㎡", price: 800 },
          ],
        },
      ],
    },
    {
      name: "第4章 排水・管路工事",
      groups: [
        {
          name: "雨水排水工事",
          items: [
            { name: "雨水管布設 VP-200", qty: 85, unit: "m", price: 8500 },
            { name: "雨水管布設 VP-150", qty: 65, unit: "m", price: 6800 },
            { name: "集水桝（コンクリート製）", qty: 8, unit: "箇所", price: 45000 },
            { name: "排水マス（塩ビ製φ300）", qty: 12, unit: "箇所", price: 28000 },
          ],
        },
        {
          name: "汚水排水工事",
          items: [
            { name: "汚水管布設 VP-100", qty: 60, unit: "m", price: 7200 },
            { name: "汚水管布設 VP-150", qty: 40, unit: "m", price: 8800 },
            { name: "汚水マス（塩ビ製）", qty: 10, unit: "箇所", price: 32000 },
            { name: "既存配管撤去・処分", qty: 1, unit: "式", price: 180000 },
          ],
        },
      ],
    },
    {
      name: "第5章 舗装工事",
      groups: [
        {
          name: "路盤工",
          items: [
            { name: "下層路盤 クラッシャーラン t=150mm", qty: 380, unit: "㎡", price: 2800 },
            { name: "上層路盤 粒調砕石 t=100mm", qty: 380, unit: "㎡", price: 3200 },
            { name: "プライムコート", qty: 380, unit: "㎡", price: 450 },
          ],
        },
        {
          name: "アスファルト舗装",
          items: [
            { name: "基層工（密粒 t=50mm）", qty: 380, unit: "㎡", price: 4800 },
            { name: "表層工（密粒 t=30mm）", qty: 380, unit: "㎡", price: 5200 },
            { name: "タックコート", qty: 380, unit: "㎡", price: 380 },
            { name: "区画線・標示工", qty: 1, unit: "式", price: 185000 },
          ],
        },
        {
          name: "縁石・排水溝工",
          items: [
            { name: "縁石設置（L形）", qty: 120, unit: "m", price: 5500 },
            { name: "U字溝設置（300×300）", qty: 95, unit: "m", price: 8200 },
            { name: "グレーチング蓋（W300）", qty: 95, unit: "m", price: 4800 },
          ],
        },
      ],
    },
    {
      name: "第6章 付帯工事・諸経費",
      groups: [
        {
          name: "植栽・緑化工事",
          items: [
            { name: "植栽工（中木 H=1.5m）", qty: 15, unit: "本", price: 28000 },
            { name: "芝張り工（高麗芝）", qty: 180, unit: "㎡", price: 2800 },
            { name: "植栽帯縁石工", qty: 45, unit: "m", price: 4500 },
          ],
        },
        {
          name: "電気・設備工事",
          items: [
            { name: "屋外照明設備（ポール灯）", qty: 8, unit: "台", price: 185000 },
            { name: "電気配管・配線工事", qty: 1, unit: "式", price: 650000 },
            { name: "防犯カメラ設置", qty: 4, unit: "台", price: 95000 },
            { name: "インターホン・表札灯", qty: 1, unit: "式", price: 120000 },
          ],
        },
        {
          name: "諸経費",
          items: [
            { name: "現場管理費", qty: 1, unit: "式", price: 850000 },
            { name: "一般管理費", qty: 1, unit: "式", price: 580000 },
            { name: "設計管理費", qty: 1, unit: "式", price: 320000 },
          ],
        },
      ],
    },
  ]

  // ── 見積を作成 ──
  const estimate = await prisma.estimate.create({
    data: {
      estimateNumber,
      projectId: project.id,
      userId: user.id,
      status: "CONFIRMED",
      title: "第1回 土木整備工事 見積",
      estimateType: "INITIAL",
      validDays: 60,
      confirmedAt: new Date(),
    },
  })

  let secOrder = 0
  for (const sec of sections) {
    const secRec = await prisma.estimateSection.create({
      data: { estimateId: estimate.id, name: sec.name, sortOrder: secOrder++ },
    })
    let grpOrder = 0
    for (const grp of sec.groups) {
      const grpRec = await prisma.estimateGroup.create({
        data: { sectionId: secRec.id, name: grp.name, sortOrder: grpOrder++ },
      })
      let itemOrder = 0
      for (const item of grp.items) {
        const unitId = uMap[item.unit]
        if (!unitId) throw new Error(`単位 "${item.unit}" が見つかりません`)
        await prisma.estimateItem.create({
          data: {
            groupId: grpRec.id,
            name: item.name,
            quantity: item.qty,
            unitId,
            unitPrice: item.price,
            sortOrder: itemOrder++,
          },
        })
      }
    }
  }

  console.log(`✅ 見積作成: ${estimateNumber} (${sections.length}セクション)`)

  // ── 3ページ用テンプレートを作成 ──
  const templateName = "土木工事 総合テンプレート（3ページ）"
  const existingTemplate = await prisma.template.findFirst({ where: { name: templateName } })
  if (existingTemplate) {
    console.log("⚠️  テンプレートは既に存在します。スキップします。")
  } else {
    const template = await prisma.template.create({
      data: {
        name: templateName,
        description: "土木工事（仮設〜舗装〜諸経費）の標準構成。A4×3ページ相当の項目数。",
      },
    })

    let tSecOrder = 0
    for (const sec of sections) {
      const tSec = await prisma.templateSection.create({
        data: { templateId: template.id, name: sec.name, sortOrder: tSecOrder++ },
      })
      let tGrpOrder = 0
      for (const grp of sec.groups) {
        const tGrp = await prisma.templateGroup.create({
          data: { sectionId: tSec.id, name: grp.name, sortOrder: tGrpOrder++ },
        })
        let tItemOrder = 0
        for (const item of grp.items) {
          const unitId = uMap[item.unit]
          if (!unitId) throw new Error(`単位 "${item.unit}" が見つかりません`)
          await prisma.templateItem.create({
            data: {
              groupId: tGrp.id,
              name: item.name,
              quantity: item.qty,
              unitId,
              unitPrice: item.price,
              sortOrder: tItemOrder++,
            },
          })
        }
      }
    }
    console.log(`✅ テンプレート作成: ${templateName}`)
  }

  const totalItems = sections.reduce(
    (s, sec) => s + sec.groups.reduce((gs, g) => gs + g.items.length, 0),
    0
  )
  console.log(`\n📋 合計: ${totalItems}行 / ${sections.length}セクション / ${sections.reduce((s, sec) => s + sec.groups.length, 0)}グループ`)
  console.log("🎉 完了しました！")
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ エラー:", e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
