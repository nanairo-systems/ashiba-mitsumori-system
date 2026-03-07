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
import { createClient } from "@supabase/supabase-js"

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
  // 4. ユーザー取得・ロール更新・スタッフ追加
  // ────────────────────────────────────────
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } })
  if (!user) {
    console.error("❌ ユーザーが見つかりません。先にユーザーを作成してください。")
    return
  }

  // 既存の最初のユーザーを管理者に昇格
  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } })
  console.log(`✅ 管理者ロール設定: ${user.name} (${user.email})`)

  // スタッフサンプルユーザーを作成（Supabase Auth + Prisma）
  const STAFF_EMAIL = "staff@ashiba-sample.com"
  const STAFF_PASSWORD = "staffpass1234"
  const STAFF_NAME = "田村 健二"

  let staffUser = await prisma.user.findUnique({ where: { email: STAFF_EMAIL } })
  if (!staffUser) {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: STAFF_EMAIL,
      password: STAFF_PASSWORD,
      email_confirm: true,
    })
    if (authErr || !authData.user) {
      console.warn(`⚠️  スタッフ Supabase Auth 作成失敗: ${authErr?.message}`)
    } else {
      staffUser = await prisma.user.create({
        data: {
          authId: authData.user.id,
          name: STAFF_NAME,
          email: STAFF_EMAIL,
          role: "STAFF",
          isActive: true,
        },
      })
      console.log(`✅ スタッフユーザー作成: ${STAFF_NAME} / ${STAFF_EMAIL} / PW: ${STAFF_PASSWORD}`)
    }
  } else {
    console.log(`⏭️  スタッフユーザースキップ（既存）: ${STAFF_EMAIL}`)
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
  // 5b. テンプレート（足場工事 一式見積り）
  // ────────────────────────────────────────
  const existingIssikiTpl = await prisma.template.findFirst({ where: { name: "足場工事一式" } })
  if (!existingIssikiTpl) {
    const issikiTpl = await prisma.template.create({
      data: {
        name: "足場工事一式",
        description: "合計金額のみで見積るシンプルな一式見積り",
        estimateType: "BOTH",
        sections: {
          create: [
            {
              name: "足場工事",
              sortOrder: 1,
              groups: {
                create: [
                  {
                    name: "足場工事",
                    sortOrder: 1,
                    items: {
                      create: [
                        { name: "足場工事一式", quantity: 1, unitId: unitMap["一式"], unitPrice: 0, sortOrder: 1 },
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
    console.log(`✅ テンプレート作成: ${issikiTpl.name}`)
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

  // ────────────────────────────────────────
  // 7. スタッフユーザーのサンプルデータ（4件）
  // ────────────────────────────────────────
  if (staffUser) {
    const staffProjectDefs = [
      {
        name: "田中工務店 神戸倉庫改修",
        branchKey: "田中工務店/神戸営業所",
        contactEmail: "tanaka.ichiro@tanaka-koumuten.co.jp",
        address: "兵庫県神戸市中央区〇〇2-3-4",
        estimate: {
          status: "DRAFT" as const,
          estimateNumber: "2602-S01",
          revision: 1,
          note: "倉庫外壁の改修に伴う足場工事。",
          sections: [
            {
              name: "足場工事",
              groups: [
                {
                  name: "枠組足場",
                  items: [
                    { name: "枠組足場 組立・解体", qty: 400, unit: "㎡", price: 750 },
                    { name: "養生シート", qty: 400, unit: "㎡", price: 280 },
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
                    { name: "運搬費", qty: 1, unit: "一式", price: 60000 },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        name: "鈴木不動産 岐阜マンション新築",
        branchKey: "鈴木不動産開発株式会社/岐阜支店",
        contactEmail: "suzuki.saburo@suzuki-fudosan.co.jp",
        address: "岐阜県岐阜市〇〇5-6-7",
        estimate: {
          status: "CONFIRMED" as const,
          estimateNumber: "2602-S02",
          revision: 1,
          note: "7階建てマンション新築工事。工期4ヶ月。",
          sections: [
            {
              name: "足場工事",
              groups: [
                {
                  name: "くさび緊結式足場",
                  items: [
                    { name: "くさび緊結式足場 組立・解体", qty: 850, unit: "㎡", price: 820 },
                    { name: "養生シート（防音タイプ）", qty: 850, unit: "㎡", price: 350 },
                    { name: "朝顔（第1種）", qty: 16, unit: "箇所", price: 15000 },
                  ],
                },
                {
                  name: "安全設備",
                  items: [
                    { name: "安全標識・看板", qty: 1, unit: "式", price: 40000 },
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
                    { name: "運搬費・搬出入費", qty: 1, unit: "一式", price: 120000 },
                    { name: "産業廃棄物処理費", qty: 1, unit: "一式", price: 35000 },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        name: "中央建設 札幌オフィス外壁補修",
        branchKey: "中央建設株式会社/札幌本社",
        contactEmail: "takahashi@chuo-kensetsu.co.jp",
        address: "北海道札幌市中央区〇〇1-1-1",
        estimate: {
          status: "SENT" as const,
          estimateNumber: "2602-S03",
          revision: 1,
          note: "外壁タイル補修のための仮設足場。冬季施工注意。",
          sections: [
            {
              name: "足場工事",
              groups: [
                {
                  name: "単管足場",
                  items: [
                    { name: "単管抱き足場 組立・解体", qty: 280, unit: "㎡", price: 700 },
                    { name: "養生シート", qty: 280, unit: "㎡", price: 260 },
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
                    { name: "運搬費", qty: 1, unit: "一式", price: 50000 },
                    { name: "寒冷地追加費用", qty: 1, unit: "一式", price: 30000 },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        name: "九州建工 熊本商業施設増築",
        branchKey: "九州建工株式会社/熊本支店",
        contactEmail: "watanabe@kyushu-kenkou.co.jp",
        address: "熊本県熊本市南区〇〇3-4-5",
        estimate: {
          status: "DRAFT" as const,
          estimateNumber: "2602-S04",
          revision: 1,
          note: "商業施設の増築工事。フロア増設に伴う外部足場。",
          sections: [
            {
              name: "足場工事",
              groups: [
                {
                  name: "くさび緊結式足場",
                  items: [
                    { name: "くさび緊結式足場 組立・解体", qty: 560, unit: "㎡", price: 800 },
                    { name: "養生シート", qty: 560, unit: "㎡", price: 300 },
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
                    { name: "運搬費・搬出入費", qty: 1, unit: "一式", price: 80000 },
                    { name: "産業廃棄物処理費", qty: 1, unit: "一式", price: 22000 },
                  ],
                },
              ],
            },
          ],
        },
      },
    ]

    for (const def of staffProjectDefs) {
      const branchId = branchMap[def.branchKey]
      if (!branchId) {
        console.warn(`⚠️  支店が見つかりません: ${def.branchKey}`)
        continue
      }
      const contactId = contactMap[def.contactEmail]

      const shortId = `S-${def.estimate.estimateNumber.split("-")[1]}`
      const existing = await prisma.project.findFirst({ where: { name: def.name } })
      if (existing) {
        console.log(`⏭️  スタッフ現場スキップ（既存）: ${def.name}`)
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
          userId: staffUser.id,
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

      console.log(`✅ スタッフ現場・見積作成: ${def.name}（${est.status}）`)
    }
  }

  // ────────────────────────────────────────
  // 8. サンプル契約データ（CONFIRMED/SENT の見積から契約を作成）
  // ────────────────────────────────────────
  const contractableEstimates = await prisma.estimate.findMany({
    where: {
      status: { in: ["CONFIRMED", "SENT"] },
      contract: null, // 契約未作成のもの
    },
    include: {
      sections: {
        include: {
          groups: {
            include: { items: true },
          },
        },
      },
      project: {
        include: {
          branch: { include: { company: true } },
        },
      },
    },
    take: 4, // 最大4件
  })

  const now2 = new Date()
  const yy = String(now2.getFullYear()).slice(2)
  const mm = String(now2.getMonth() + 1).padStart(2, "0")
  const prefix = `C-${yy}${mm}-`

  for (let i = 0; i < contractableEstimates.length; i++) {
    const est = contractableEstimates[i]
    const taxRate = Number(est.project.branch.company.taxRate)
    const subtotal = est.sections.reduce(
      (s, sec) => s + sec.groups.reduce(
        (gs, g) => gs + g.items.reduce((is, item) => is + Number(item.quantity) * Number(item.unitPrice), 0), 0
      ), 0
    )
    const taxAmount = Math.floor(subtotal * taxRate)
    const totalAmount = subtotal + taxAmount

    const contractNumber = `${prefix}${String(i + 1).padStart(3, "0")}`
    // 既存の契約番号との重複を避けるためチェック
    const exists = await prisma.contract.findUnique({ where: { contractNumber } })
    if (exists) {
      console.log(`⏭️  契約番号 ${contractNumber} は既に存在するためスキップ`)
      continue
    }

    await prisma.contract.create({
      data: {
        contractNumber,
        projectId: est.projectId,
        estimateId: est.id,
        contractAmount: subtotal,
        taxAmount,
        totalAmount,
        contractDate: new Date(now2.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000), // 1〜4週間前
        startDate: new Date(now2.getTime() + (i + 1) * 14 * 24 * 60 * 60 * 1000),   // 2〜8週間後
        endDate: new Date(now2.getTime() + (i + 4) * 30 * 24 * 60 * 60 * 1000),     // 1〜4ヶ月後
        paymentTerms: "末締め 翌月末払い",
        note: i === 0 ? "施工前に現地確認済み" : i === 1 ? "安全衛生計画書を提出済み" : null,
        status: i < 2 ? "CONTRACTED" : "COMPLETED",
      },
    })
    console.log(`✅ 契約作成: ${contractNumber}（${est.project.name}）`)
  }

  // ────────────────────────────────────────
  // 9. 外注先（サブコントラクター）
  // ────────────────────────────────────────
  const subDefs = [
    { name: "有限会社 丸山鳶工業", representative: "丸山 義雄", address: "東京都足立区千住〇〇1-2-3", phone: "03-6789-0123" },
    { name: "合同会社 西田足場", representative: "西田 孝之", address: "大阪府堺市北区△△4-5-6", phone: "072-1234-5678" },
    { name: "株式会社 北海道仮設", representative: "佐々木 誠", address: "北海道旭川市〇〇7-8-9", phone: "0166-12-3456" },
  ]

  const subMap: Record<string, string> = {}
  for (const sd of subDefs) {
    const existing = await prisma.subcontractor.findFirst({ where: { name: sd.name } })
    if (existing) {
      subMap[sd.name] = existing.id
      console.log(`⏭️  外注先スキップ（既存）: ${sd.name}`)
    } else {
      const sub = await prisma.subcontractor.create({ data: { ...sd, isActive: true } })
      subMap[sd.name] = sub.id
      console.log(`✅ 外注先作成: ${sd.name}`)
    }
  }

  // ────────────────────────────────────────
  // 10. 契約の拡充（ステータスを多様に）
  // ────────────────────────────────────────
  const allContracts = await prisma.contract.findMany({
    include: {
      project: { include: { branch: { include: { company: true } } } },
      estimate: {
        include: {
          sections: { include: { groups: { include: { items: true } } } },
        },
      },
    },
    orderBy: { contractDate: "asc" },
  })

  // ステータスを多様に設定（既存の契約を更新）
  const statusUpdates: { index: number; status: "CONTRACTED" | "IN_PROGRESS" | "COMPLETED" | "BILLED" | "PAID" }[] = [
    { index: 0, status: "IN_PROGRESS" },
    { index: 1, status: "COMPLETED" },
    { index: 2, status: "BILLED" },
    { index: 3, status: "PAID" },
  ]

  for (const su of statusUpdates) {
    if (su.index < allContracts.length) {
      await prisma.contract.update({
        where: { id: allContracts[su.index].id },
        data: { status: su.status },
      })
      console.log(`✅ 契約ステータス更新: ${allContracts[su.index].contractNumber} → ${su.status}`)
    }
  }

  // ────────────────────────────────────────
  // 11. 工事区分（自社工事・外注工事）サンプル
  // ────────────────────────────────────────
  for (let ci = 0; ci < Math.min(allContracts.length, 4); ci++) {
    const c = allContracts[ci]
    const existingWorks = await prisma.contractWork.findFirst({ where: { contractId: c.id } })
    if (existingWorks) {
      console.log(`⏭️  工事区分スキップ（既存）: ${c.contractNumber}`)
      continue
    }

    const taxRate2 = Number(c.project.branch.company.taxRate)

    // 自社工事を追加
    await prisma.contractWork.create({
      data: {
        contractId: c.id,
        workType: "INHOUSE",
        workerCount: 3 + ci,
        workDays: 5 + ci * 2,
        note: ci === 0 ? "足場組立メイン" : ci === 1 ? "足場解体・養生" : null,
      },
    })

    // 偶数番目は外注工事も追加
    if (ci % 2 === 0) {
      const subName = ci === 0 ? "有限会社 丸山鳶工業" : "合同会社 西田足場"
      const subId = subMap[subName]
      const orderAmt = 200000 + ci * 100000
      const orderTax = Math.floor(orderAmt * taxRate2)
      await prisma.contractWork.create({
        data: {
          contractId: c.id,
          workType: "SUBCONTRACT",
          subcontractorId: subId,
          orderAmount: orderAmt,
          orderTaxAmount: orderTax,
          orderTotalAmount: orderAmt + orderTax,
          orderStatus: ci === 0 ? "ORDERED" : "COMPLETED",
          orderedAt: ci === 0 ? new Date() : new Date(Date.now() - 14 * 86400000),
          note: "高所作業分を外注",
        },
      })
    }

    console.log(`✅ 工事区分作成: ${c.contractNumber}`)
  }

  // ────────────────────────────────────────
  // 12. 工期管理（工程スケジュール）サンプル
  // ────────────────────────────────────────
  for (let ci = 0; ci < Math.min(allContracts.length, 4); ci++) {
    const c = allContracts[ci]
    const existingSch = await prisma.constructionSchedule.findFirst({ where: { contractId: c.id } })
    if (existingSch) {
      console.log(`⏭️  工期スキップ（既存）: ${c.contractNumber}`)
      continue
    }

    const baseDate = c.startDate ? new Date(c.startDate) : new Date()
    const dayMs = 86400000

    // 組立工程
    const assemblyStart = new Date(baseDate.getTime())
    const assemblyEnd = new Date(baseDate.getTime() + (4 + ci) * dayMs)
    await prisma.constructionSchedule.create({
      data: {
        contractId: c.id,
        workType: "ASSEMBLY",
        plannedStartDate: assemblyStart,
        plannedEndDate: assemblyEnd,
        actualStartDate: ci < 3 ? assemblyStart : null,
        actualEndDate: ci < 2 ? new Date(assemblyEnd.getTime() + dayMs) : null,
        workersCount: 3 + ci,
        notes: ci === 0 ? "天候次第で1日延長の可能性あり" : null,
      },
    })

    // 解体工程（組立終了の2〜4週間後）
    const disassemblyStart = new Date(assemblyEnd.getTime() + (14 + ci * 7) * dayMs)
    const disassemblyEnd = new Date(disassemblyStart.getTime() + (3 + ci) * dayMs)
    await prisma.constructionSchedule.create({
      data: {
        contractId: c.id,
        workType: "DISASSEMBLY",
        plannedStartDate: disassemblyStart,
        plannedEndDate: disassemblyEnd,
        actualStartDate: ci === 1 ? disassemblyStart : null,
        actualEndDate: ci === 1 ? disassemblyEnd : null,
        workersCount: 2 + ci,
      },
    })

    // 手直し工程（一部の契約のみ）
    if (ci === 1 || ci === 3) {
      const reworkStart = new Date(disassemblyEnd.getTime() + 3 * dayMs)
      const reworkEnd = new Date(reworkStart.getTime() + 2 * dayMs)
      await prisma.constructionSchedule.create({
        data: {
          contractId: c.id,
          workType: "REWORK",
          plannedStartDate: reworkStart,
          plannedEndDate: reworkEnd,
          workersCount: 2,
          notes: "部分手直し",
        },
      })
    }

    console.log(`✅ 工期スケジュール作成: ${c.contractNumber}`)
  }

  // ────────────────────────────────────────
  // 13. 請求サンプルデータ
  // ────────────────────────────────────────
  const refreshedContracts = await prisma.contract.findMany({
    include: {
      project: { include: { branch: { include: { company: true } } } },
    },
    orderBy: { contractDate: "asc" },
  })

  const now3 = new Date()
  const invYY = String(now3.getFullYear()).slice(2)
  const invMM = String(now3.getMonth() + 1).padStart(2, "0")
  let invSeq = 1

  // 既存の請求番号のシーケンスを取得
  const latestInv = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: `INV-${invYY}${invMM}-` } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  })
  if (latestInv?.invoiceNumber) {
    const n = parseInt(latestInv.invoiceNumber.slice(`INV-${invYY}${invMM}-`.length), 10)
    if (!isNaN(n)) invSeq = n + 1
  }

  for (let ci = 0; ci < Math.min(refreshedContracts.length, 4); ci++) {
    const c = refreshedContracts[ci]
    const existingInv = await prisma.invoice.findFirst({ where: { contractId: c.id } })
    if (existingInv) {
      console.log(`⏭️  請求スキップ（既存）: ${c.contractNumber}`)
      continue
    }

    const taxRate3 = Number(c.project.branch.company.taxRate)
    const contractAmt = Number(c.contractAmount)
    const invPrefix = `INV-${invYY}${invMM}-`
    const dayMs2 = 86400000

    if (ci === 0) {
      // 一括請求 — 送付済
      const amt = contractAmt
      const tax = Math.floor(amt * taxRate3)
      await prisma.invoice.create({
        data: {
          contractId: c.id,
          invoiceNumber: `${invPrefix}${String(invSeq++).padStart(3, "0")}`,
          invoiceType: "FULL",
          amount: amt,
          taxAmount: tax,
          totalAmount: amt + tax,
          invoiceDate: new Date(now3.getTime() - 7 * dayMs2),
          dueDate: new Date(now3.getTime() + 23 * dayMs2),
          status: "SENT",
        },
      })
    } else if (ci === 1) {
      // 分割請求（組立分＋解体分）— 組立分は入金済、解体分は送付済
      const assemblyAmt = Math.floor(contractAmt * 0.6)
      const assemblyTax = Math.floor(assemblyAmt * taxRate3)
      await prisma.invoice.create({
        data: {
          contractId: c.id,
          invoiceNumber: `${invPrefix}${String(invSeq++).padStart(3, "0")}`,
          invoiceType: "ASSEMBLY",
          amount: assemblyAmt,
          taxAmount: assemblyTax,
          totalAmount: assemblyAmt + assemblyTax,
          invoiceDate: new Date(now3.getTime() - 30 * dayMs2),
          dueDate: new Date(now3.getTime() - 1 * dayMs2),
          status: "PAID",
          paidAt: new Date(now3.getTime() - 3 * dayMs2),
          paidAmount: assemblyAmt + assemblyTax,
        },
      })

      const disassemblyAmt = contractAmt - assemblyAmt
      const disassemblyTax = Math.floor(disassemblyAmt * taxRate3)
      await prisma.invoice.create({
        data: {
          contractId: c.id,
          invoiceNumber: `${invPrefix}${String(invSeq++).padStart(3, "0")}`,
          invoiceType: "DISASSEMBLY",
          amount: disassemblyAmt,
          taxAmount: disassemblyTax,
          totalAmount: disassemblyAmt + disassemblyTax,
          invoiceDate: new Date(now3.getTime() - 5 * dayMs2),
          dueDate: new Date(now3.getTime() + 25 * dayMs2),
          status: "SENT",
        },
      })
    } else if (ci === 2) {
      // 出来高請求 — 3回分（入金済 / 一部入金 / 下書き）
      const progress1Amt = Math.floor(contractAmt * 0.3)
      const progress1Tax = Math.floor(progress1Amt * taxRate3)
      await prisma.invoice.create({
        data: {
          contractId: c.id,
          invoiceNumber: `${invPrefix}${String(invSeq++).padStart(3, "0")}`,
          invoiceType: "PROGRESS",
          amount: progress1Amt,
          taxAmount: progress1Tax,
          totalAmount: progress1Amt + progress1Tax,
          invoiceDate: new Date(now3.getTime() - 60 * dayMs2),
          dueDate: new Date(now3.getTime() - 30 * dayMs2),
          status: "PAID",
          paidAt: new Date(now3.getTime() - 28 * dayMs2),
          paidAmount: progress1Amt + progress1Tax,
          notes: "第1回 出来高",
        },
      })

      const progress2Amt = Math.floor(contractAmt * 0.3)
      const progress2Tax = Math.floor(progress2Amt * taxRate3)
      await prisma.invoice.create({
        data: {
          contractId: c.id,
          invoiceNumber: `${invPrefix}${String(invSeq++).padStart(3, "0")}`,
          invoiceType: "PROGRESS",
          amount: progress2Amt,
          taxAmount: progress2Tax,
          totalAmount: progress2Amt + progress2Tax,
          invoiceDate: new Date(now3.getTime() - 25 * dayMs2),
          dueDate: new Date(now3.getTime() + 5 * dayMs2),
          status: "PARTIAL_PAID",
          paidAmount: Math.floor((progress2Amt + progress2Tax) * 0.5),
          notes: "第2回 出来高（半額入金済）",
        },
      })

      const progress3Amt = Math.floor(contractAmt * 0.4)
      const progress3Tax = Math.floor(progress3Amt * taxRate3)
      await prisma.invoice.create({
        data: {
          contractId: c.id,
          invoiceNumber: `${invPrefix}${String(invSeq++).padStart(3, "0")}`,
          invoiceType: "PROGRESS",
          amount: progress3Amt,
          taxAmount: progress3Tax,
          totalAmount: progress3Amt + progress3Tax,
          invoiceDate: new Date(),
          dueDate: new Date(now3.getTime() + 30 * dayMs2),
          status: "DRAFT",
          notes: "第3回 出来高（最終）",
        },
      })
    } else {
      // 一括請求 — 入金済
      const amt = contractAmt
      const tax = Math.floor(amt * taxRate3)
      await prisma.invoice.create({
        data: {
          contractId: c.id,
          invoiceNumber: `${invPrefix}${String(invSeq++).padStart(3, "0")}`,
          invoiceType: "FULL",
          amount: amt,
          taxAmount: tax,
          totalAmount: amt + tax,
          invoiceDate: new Date(now3.getTime() - 45 * dayMs2),
          dueDate: new Date(now3.getTime() - 15 * dayMs2),
          status: "PAID",
          paidAt: new Date(now3.getTime() - 14 * dayMs2),
          paidAmount: amt + tax,
        },
      })
    }

    console.log(`✅ 請求作成: ${c.contractNumber}`)
  }

  // ────────────────────────────────────────
  // 14. 入金サンプルデータ
  // ────────────────────────────────────────
  const allInvoices = await prisma.invoice.findMany({
    include: { payments: true },
    orderBy: { invoiceDate: "asc" },
  })

  const dayMs3 = 86400000

  for (const inv of allInvoices) {
    if (inv.payments.length > 0) {
      console.log(`⏭️  入金スキップ（既存）: ${inv.invoiceNumber}`)
      continue
    }

    const invoiceTotal = Number(inv.totalAmount)

    if (inv.status === "PAID") {
      // 入金済 → 全額入金（手数料440円を差し引き）
      const fee = 440
      const payAmt = invoiceTotal - fee
      await prisma.payment.create({
        data: {
          invoiceId: inv.id,
          paymentDate: inv.paidAt ?? new Date(inv.invoiceDate.getTime() + 20 * dayMs3),
          paymentAmount: payAmt,
          transferFee: fee,
          discountAmount: 0,
          notes: "振込手数料先方負担",
        },
      })
      console.log(`✅ 入金作成（全額）: ${inv.invoiceNumber}`)
    } else if (inv.status === "PARTIAL_PAID") {
      // 一部入金 → 半額入金
      const fee = 440
      const payAmt = Math.floor(invoiceTotal * 0.5) - fee
      await prisma.payment.create({
        data: {
          invoiceId: inv.id,
          paymentDate: new Date(inv.invoiceDate.getTime() + 15 * dayMs3),
          paymentAmount: payAmt,
          transferFee: fee,
          discountAmount: 0,
          notes: "第1回入金分",
        },
      })
      // 入金済金額を更新
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { paidAmount: payAmt },
      })
      console.log(`✅ 入金作成（一部）: ${inv.invoiceNumber}`)
    } else if (inv.status === "SENT") {
      // 送付済 → 未入金（入金なし）
      console.log(`⏭️  未入金のまま: ${inv.invoiceNumber}`)
    }
  }

  // ────────────────────────────────────────
  // 15. 下請け支払いサンプルデータ
  // ────────────────────────────────────────
  const subcontractWorks = await prisma.contractWork.findMany({
    where: { workType: "SUBCONTRACT", subcontractorId: { not: null } },
    include: {
      contract: true,
      subcontractor: true,
    },
  })

  const dayMs4 = 86400000

  for (const cw of subcontractWorks) {
    if (!cw.subcontractorId) continue

    const existingSP = await prisma.subcontractorPayment.findFirst({
      where: { contractId: cw.contractId, subcontractorId: cw.subcontractorId },
    })
    if (existingSP) {
      console.log(`⏭️  下請け支払いスキップ（既存）: ${cw.contract.contractNumber} / ${cw.subcontractor?.name}`)
      continue
    }

    const orderAmt = Number(cw.orderAmount ?? 0)
    const orderTax = Number(cw.orderTaxAmount ?? 0)
    const orderTotal = Number(cw.orderTotalAmount ?? 0)
    const now4 = new Date()

    const closingDate = new Date(now4.getFullYear(), now4.getMonth(), 0) // 先月末
    const paymentDueDate = new Date(now4.getFullYear(), now4.getMonth() + 1, 0) // 今月末

    const isPaid = cw.orderStatus === "COMPLETED"

    await prisma.subcontractorPayment.create({
      data: {
        contractId: cw.contractId,
        subcontractorId: cw.subcontractorId,
        orderAmount: orderAmt,
        taxAmount: orderTax,
        totalAmount: orderTotal,
        closingDate,
        paymentDueDate,
        paymentDate: isPaid ? new Date(paymentDueDate.getTime() - 2 * dayMs4) : null,
        paymentAmount: isPaid ? orderTotal : null,
        status: isPaid ? "PAID" : cw.orderStatus === "ORDERED" ? "SCHEDULED" : "PENDING",
        notes: isPaid ? "支払済み" : null,
      },
    })
    console.log(`✅ 下請け支払い作成: ${cw.contract.contractNumber} / ${cw.subcontractor?.name}（${isPaid ? "PAID" : "SCHEDULED"}）`)
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
