/**
 * [SEED] データベース初期投入スクリプト
 *
 * 実行: npm run db:seed
 *
 * 投入データ:
 * - 単位マスター（8種）
 * - タグマスター（5種）
 * - 会社・支店・担当者（5社）
 * - 現場（5件）
 * - テンプレート（1件）
 * - 見積サンプル（5件、各現場に1件）
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL!,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 シードデータの投入を開始します...")

  // ────────────────────────────────────────
  // 1. 単位マスター
  // ────────────────────────────────────────
  const unitDefs = [
    { name: "一式", sortOrder: 1 },
    { name: "式", sortOrder: 2 },
    { name: "m", sortOrder: 3 },
    { name: "㎡", sortOrder: 4 },
    { name: "箇所", sortOrder: 5 },
    { name: "枚", sortOrder: 6 },
    { name: "セット", sortOrder: 7 },
    { name: "日", sortOrder: 8 },
  ]

  const unitMap: Record<string, string> = {}
  for (const u of unitDefs) {
    const unit = await prisma.unit.upsert({
      where: { name: u.name },
      update: {},
      create: u,
    })
    unitMap[u.name] = unit.id
  }
  console.log("✅ 単位マスター: 完了")

  // ────────────────────────────────────────
  // 2. タグマスター
  // ────────────────────────────────────────
  const tagDefs = ["足場", "外壁工事", "新築", "改修", "大型案件"]
  const tagMap: Record<string, string> = {}
  for (const name of tagDefs) {
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    })
    tagMap[name] = tag.id
  }
  console.log("✅ タグマスター: 完了")

  // ────────────────────────────────────────
  // 3. 会社・支店・担当者（5社）
  // ────────────────────────────────────────
  const companies = [
    {
      name: "株式会社山田建設",
      phone: "03-1234-5678",
      branches: ["東京本店", "横浜支店"],
      contacts: [
        { name: "山田 太郎", phone: "090-1111-2222", email: "yamada.taro@yamada-kensetsu.co.jp" },
        { name: "山田 花子", phone: "090-3333-4444", email: "yamada.hanako@yamada-kensetsu.co.jp" },
      ],
    },
    {
      name: "田中工務店",
      phone: "06-2345-6789",
      branches: ["大阪本社", "神戸営業所"],
      contacts: [
        { name: "田中 一郎", phone: "080-2222-3333", email: "tanaka.ichiro@tanaka-koumuten.co.jp" },
        { name: "佐藤 次郎", phone: "080-4444-5555", email: "sato.jiro@tanaka-koumuten.co.jp" },
      ],
    },
    {
      name: "鈴木不動産開発株式会社",
      phone: "052-3456-7890",
      branches: ["名古屋本店", "岐阜支店", "静岡支店"],
      contacts: [
        { name: "鈴木 三郎", phone: "070-5555-6666", email: "suzuki.saburo@suzuki-fudosan.co.jp" },
      ],
    },
    {
      name: "中央建設株式会社",
      phone: "011-4567-8901",
      branches: ["札幌本社"],
      contacts: [
        { name: "高橋 四郎", phone: "090-7777-8888", email: "takahashi@chuo-kensetsu.co.jp" },
        { name: "伊藤 五郎", phone: "080-9999-0000", email: "ito@chuo-kensetsu.co.jp" },
      ],
    },
    {
      name: "九州建工株式会社",
      phone: "092-5678-9012",
      branches: ["福岡本社", "熊本支店"],
      contacts: [
        { name: "渡辺 六郎", phone: "070-1234-5678", email: "watanabe@kyushu-kenkou.co.jp" },
      ],
    },
  ]

  const branchMap: Record<string, string> = {}
  const contactMap: Record<string, string> = {}

  for (const c of companies) {
    const company = await prisma.company.upsert({
      where: { name: c.name },
      update: {},
      create: {
        name: c.name,
        phone: c.phone,
        taxRate: 0.1,
      },
    })

    for (const bName of c.branches) {
      const branch = await prisma.branch.upsert({
        where: { companyId_name: { companyId: company.id, name: bName } },
        update: {},
        create: { companyId: company.id, name: bName },
      })
      branchMap[`${c.name}/${bName}`] = branch.id
    }

    for (const ct of c.contacts) {
      const existing = await prisma.contact.findFirst({
        where: { companyId: company.id, email: ct.email },
      })
      const contact = existing ?? await prisma.contact.create({
        data: { companyId: company.id, ...ct },
      })
      contactMap[ct.email] = contact.id
    }
  }
  console.log("✅ 会社・支店・担当者: 完了")

  // ────────────────────────────────────────
  // 4. ユーザー取得
  // ────────────────────────────────────────
  const user = await prisma.user.findFirst()
  if (!user) {
    console.error("❌ ユーザーが見つかりません。先にユーザーを作成してください。")
    return
  }

  // ────────────────────────────────────────
  // 5. テンプレート（足場工事 標準テンプレ）
  // ────────────────────────────────────────
  const existingTpl = await prisma.template.findFirst({ where: { name: "足場工事 標準テンプレ" } })
  if (!existingTpl) {
    const tpl = await prisma.template.create({
      data: {
        name: "足場工事 標準テンプレ",
        description: "くさび緊結式足場の標準的な構成",
        templateTags: {
          create: [
            { tag: { connect: { id: tagMap["足場"] } } },
          ],
        },
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
                        { name: "くさび緊結式足場 組立・解体", quantity: 500, unitId: unitMap["㎡"], unitPrice: 800, sortOrder: 1 },
                        { name: "養生シート", quantity: 500, unitId: unitMap["㎡"], unitPrice: 300, sortOrder: 2 },
                        { name: "朝顔（第1種）", quantity: 10, unitId: unitMap["箇所"], unitPrice: 15000, sortOrder: 3 },
                      ],
                    },
                  },
                  {
                    name: "安全設備",
                    sortOrder: 2,
                    items: {
                      create: [
                        { name: "安全標識・看板", quantity: 1, unitId: unitMap["式"], unitPrice: 30000, sortOrder: 1 },
                        { name: "仮設照明", quantity: 1, unitId: unitMap["式"], unitPrice: 50000, sortOrder: 2 },
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
                        { name: "運搬費・搬出入費", quantity: 1, unitId: unitMap["一式"], unitPrice: 80000, sortOrder: 1 },
                        { name: "産業廃棄物処理費", quantity: 1, unitId: unitMap["一式"], unitPrice: 20000, sortOrder: 2 },
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
    console.log(`✅ テンプレート作成: ${tpl.name}`)
  }

  // ────────────────────────────────────────
  // 6. 現場・見積サンプル（5件）
  // ────────────────────────────────────────
  const projectDefs = [
    {
      name: "山田ビル新築工事",
      branchKey: "株式会社山田建設/東京本店",
      contactEmail: "yamada.taro@yamada-kensetsu.co.jp",
      address: "東京都渋谷区〇〇1-2-3",
      estimate: {
        status: "SENT" as const,
        estimateNumber: "2602-001",
        revision: 1,
        note: "3ヶ月の工期を想定。足場面積は図面より算出。",
        sections: [
          {
            name: "足場工事",
            groups: [
              {
                name: "仮設足場",
                items: [
                  { name: "くさび緊結式足場 組立・解体", qty: 620, unit: "㎡", price: 800 },
                  { name: "養生シート（防音・防塵）", qty: 620, unit: "㎡", price: 320 },
                  { name: "朝顔（第1種）", qty: 12, unit: "箇所", price: 15000 },
                ],
              },
              {
                name: "安全設備",
                items: [
                  { name: "安全標識・看板", qty: 1, unit: "式", price: 35000 },
                  { name: "仮設照明（LED）", qty: 1, unit: "式", price: 55000 },
                ],
              },
            ],
          },
          {
            name: "諸経費",
            groups: [
              {
                name: "その他",
                items: [
                  { name: "運搬費・搬出入費", qty: 1, unit: "一式", price: 90000 },
                  { name: "産業廃棄物処理費", qty: 1, unit: "一式", price: 25000 },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      name: "田中工務店 大阪倉庫改修",
      branchKey: "田中工務店/大阪本社",
      contactEmail: "tanaka.ichiro@tanaka-koumuten.co.jp",
      address: "大阪府大阪市北区△△2-3-4",
      estimate: {
        status: "CONFIRMED" as const,
        estimateNumber: "2602-002",
        revision: 1,
        note: "既存建物の外壁改修。鉄骨造4階建て。",
        sections: [
          {
            name: "足場工事",
            groups: [
              {
                name: "仮設足場",
                items: [
                  { name: "枠組足場 組立・解体", qty: 800, unit: "㎡", price: 750 },
                  { name: "養生シート", qty: 800, unit: "㎡", price: 300 },
                ],
              },
            ],
          },
          {
            name: "諸経費",
            groups: [
              {
                name: "その他",
                items: [
                  { name: "運搬費・搬出入費", qty: 1, unit: "一式", price: 100000 },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      name: "鈴木マンション外壁塗装",
      branchKey: "鈴木不動産開発株式会社/名古屋本店",
      contactEmail: "suzuki.saburo@suzuki-fudosan.co.jp",
      address: "愛知県名古屋市中区□□3-4-5",
      estimate: {
        status: "DRAFT" as const,
        estimateNumber: null,
        revision: 1,
        note: null,
        sections: [
          {
            name: "足場工事",
            groups: [
              {
                name: "仮設足場",
                items: [
                  { name: "くさび緊結式足場 組立・解体", qty: 450, unit: "㎡", price: 800 },
                  { name: "養生シート（メッシュ）", qty: 450, unit: "㎡", price: 280 },
                ],
              },
            ],
          },
          {
            name: "諸経費",
            groups: [
              {
                name: "その他",
                items: [
                  { name: "運搬費・搬出入費", qty: 1, unit: "一式", price: 75000 },
                  { name: "産業廃棄物処理費", qty: 1, unit: "一式", price: 18000 },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      name: "中央建設 札幌オフィスビル新築",
      branchKey: "中央建設株式会社/札幌本社",
      contactEmail: "takahashi@chuo-kensetsu.co.jp",
      address: "北海道札幌市中央区◇◇4-5-6",
      estimate: {
        status: "SENT" as const,
        estimateNumber: "2601-008",
        revision: 2,
        note: "冬季施工のため防寒養生シートを追加。",
        sections: [
          {
            name: "足場工事",
            groups: [
              {
                name: "仮設足場",
                items: [
                  { name: "くさび緊結式足場 組立・解体", qty: 1200, unit: "㎡", price: 850 },
                  { name: "養生シート（防寒・防風）", qty: 1200, unit: "㎡", price: 400 },
                  { name: "朝顔（第1種）", qty: 20, unit: "箇所", price: 15000 },
                  { name: "ステージ（作業床）", qty: 3, unit: "セット", price: 80000 },
                ],
              },
              {
                name: "安全設備",
                items: [
                  { name: "安全標識・看板", qty: 1, unit: "式", price: 50000 },
                  { name: "仮設照明（LED）", qty: 2, unit: "式", price: 55000 },
                ],
              },
            ],
          },
          {
            name: "諸経費",
            groups: [
              {
                name: "その他",
                items: [
                  { name: "運搬費・搬出入費", qty: 1, unit: "一式", price: 150000 },
                  { name: "産業廃棄物処理費", qty: 1, unit: "一式", price: 40000 },
                  { name: "冬季割増費", qty: 1, unit: "一式", price: 100000 },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      name: "九州建工 福岡商業施設",
      branchKey: "九州建工株式会社/福岡本社",
      contactEmail: "watanabe@kyushu-kenkou.co.jp",
      address: "福岡県福岡市博多区★★5-6-7",
      estimate: {
        status: "DRAFT" as const,
        estimateNumber: null,
        revision: 1,
        note: "SC外壁改修工事。営業しながらの施工のため養生に特に注意。",
        sections: [
          {
            name: "足場工事",
            groups: [
              {
                name: "仮設足場",
                items: [
                  { name: "枠組足場 組立・解体", qty: 950, unit: "㎡", price: 780 },
                  { name: "養生シート（防音・防塵）", qty: 950, unit: "㎡", price: 350 },
                  { name: "養生トンネル（歩行者通路）", qty: 30, unit: "m", price: 12000 },
                ],
              },
            ],
          },
          {
            name: "諸経費",
            groups: [
              {
                name: "その他",
                items: [
                  { name: "運搬費・搬出入費", qty: 1, unit: "一式", price: 120000 },
                  { name: "産業廃棄物処理費", qty: 1, unit: "一式", price: 30000 },
                ],
              },
            ],
          },
        ],
      },
    },
  ]

  const now = new Date()

  for (let i = 0; i < projectDefs.length; i++) {
    const def = projectDefs[i]
    const branchId = branchMap[def.branchKey]
    const contactId = contactMap[def.contactEmail]

    if (!branchId) {
      console.error(`❌ 支店が見つかりません: ${def.branchKey}`)
      continue
    }

    const ym = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`
    const shortId = `P-${ym}-${String(i + 1).padStart(3, "0")}`

    const existing = await prisma.project.findUnique({ where: { shortId } })
    if (existing) {
      console.log(`⏭️  現場スキップ（既存）: ${def.name}`)
      continue
    }

    const project = await prisma.project.create({
      data: {
        shortId,
        name: def.name,
        branchId,
        contactId: contactId ?? null,
        address: def.address,
      },
    })

    const est = def.estimate
    await prisma.estimate.create({
      data: {
        projectId: project.id,
        userId: user.id,
        status: est.status,
        estimateNumber: est.estimateNumber,
        revision: est.revision,
        note: est.note,
        confirmedAt: est.status !== "DRAFT" ? now : null,
        sentAt: est.status === "SENT" ? now : null,
        sections: {
          create: est.sections.map((sec, si) => ({
            name: sec.name,
            sortOrder: si + 1,
            groups: {
              create: sec.groups.map((grp, gi) => ({
                name: grp.name,
                sortOrder: gi + 1,
                items: {
                  create: grp.items.map((item, ii) => ({
                    name: item.name,
                    quantity: item.qty,
                    unitId: unitMap[item.unit],
                    unitPrice: item.price,
                    sortOrder: ii + 1,
                  })),
                },
              })),
            },
          })),
        },
      },
    })

    console.log(`✅ 現場・見積作成: ${def.name}（${est.status}）`)
  }

  console.log("\n🎉 シードデータの投入が完了しました！")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
