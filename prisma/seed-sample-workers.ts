/**
 * [SEED] 職人サンプルデータ追加スクリプト
 *
 * 各種タイプの職人を追加（既存データは残す）:
 * - 自社社員（EMPLOYEE）: ベトナム人実習生 6名（カタカナ名）
 * - 一人親方（INDEPENDENT）: 3名
 * - 協力会社（SUBCONTRACTOR）: 3名
 * - 各種免許タイプ付き
 *
 * 実行: npx tsx prisma/seed-sample-workers.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 職人サンプルデータの追加を開始します...")

  // ── 協力会社（Subcontractor）を作成 ──
  const subcontractor = await prisma.subcontractor.upsert({
    where: { id: "sample-subcontractor-01" },
    update: {},
    create: {
      id: "sample-subcontractor-01",
      name: "丸山建設",
      furigana: "マルヤマケンセツ",
      representative: "丸山太郎",
      phone: "03-1234-5678",
      address: "東京都足立区千住1-2-3",
    },
  })
  console.log(`  ✅ 協力会社: ${subcontractor.name}`)

  const subcontractor2 = await prisma.subcontractor.upsert({
    where: { id: "sample-subcontractor-02" },
    update: {},
    create: {
      id: "sample-subcontractor-02",
      name: "大和足場工業",
      furigana: "ヤマトアシバコウギョウ",
      representative: "大和一郎",
      phone: "045-9876-5432",
      address: "神奈川県横浜市鶴見区下末吉4-5-6",
    },
  })
  console.log(`  ✅ 協力会社: ${subcontractor2.name}`)

  // ── 職人データ定義 ──
  const workerDefs: {
    name: string
    furigana: string
    workerType: "EMPLOYEE" | "INDEPENDENT" | "SUBCONTRACTOR"
    driverLicenseType: "NONE" | "SMALL" | "MEDIUM" | "SEMI_LARGE" | "LARGE"
    defaultRole: "FOREMAN" | "WORKER"
    subcontractorId?: string
    phone?: string
  }[] = [
    // === ベトナム人実習生（自社社員・EMPLOYEE）===
    {
      name: "グエン・トゥアン",
      furigana: "グエン トゥアン",
      workerType: "EMPLOYEE",
      driverLicenseType: "NONE",
      defaultRole: "WORKER",
      phone: "090-1111-0001",
    },
    {
      name: "ファム・ドゥック",
      furigana: "ファム ドゥック",
      workerType: "EMPLOYEE",
      driverLicenseType: "SMALL",
      defaultRole: "WORKER",
      phone: "090-1111-0002",
    },
    {
      name: "チャン・タイン",
      furigana: "チャン タイン",
      workerType: "EMPLOYEE",
      driverLicenseType: "NONE",
      defaultRole: "WORKER",
      phone: "090-1111-0003",
    },
    {
      name: "レ・ミン",
      furigana: "レ ミン",
      workerType: "EMPLOYEE",
      driverLicenseType: "SMALL",
      defaultRole: "WORKER",
      phone: "090-1111-0004",
    },
    {
      name: "ホアン・ティエン",
      furigana: "ホアン ティエン",
      workerType: "EMPLOYEE",
      driverLicenseType: "NONE",
      defaultRole: "WORKER",
      phone: "090-1111-0005",
    },
    {
      name: "ブイ・ロン",
      furigana: "ブイ ロン",
      workerType: "EMPLOYEE",
      driverLicenseType: "MEDIUM",
      defaultRole: "WORKER",
      phone: "090-1111-0006",
    },

    // === 一人親方（INDEPENDENT）===
    {
      name: "長谷川 勇",
      furigana: "ハセガワ イサム",
      workerType: "INDEPENDENT",
      driverLicenseType: "LARGE",
      defaultRole: "FOREMAN",
      phone: "090-2222-0001",
    },
    {
      name: "村上 健太",
      furigana: "ムラカミ ケンタ",
      workerType: "INDEPENDENT",
      driverLicenseType: "SEMI_LARGE",
      defaultRole: "WORKER",
      phone: "090-2222-0002",
    },
    {
      name: "近藤 誠",
      furigana: "コンドウ マコト",
      workerType: "INDEPENDENT",
      driverLicenseType: "MEDIUM",
      defaultRole: "WORKER",
      phone: "090-2222-0003",
    },

    // === 協力会社（SUBCONTRACTOR）===
    {
      name: "丸山 次郎",
      furigana: "マルヤマ ジロウ",
      workerType: "SUBCONTRACTOR",
      driverLicenseType: "LARGE",
      defaultRole: "FOREMAN",
      subcontractorId: subcontractor.id,
      phone: "090-3333-0001",
    },
    {
      name: "丸山 三郎",
      furigana: "マルヤマ サブロウ",
      workerType: "SUBCONTRACTOR",
      driverLicenseType: "SEMI_LARGE",
      defaultRole: "WORKER",
      subcontractorId: subcontractor.id,
      phone: "090-3333-0002",
    },
    {
      name: "大和 健一",
      furigana: "ヤマト ケンイチ",
      workerType: "SUBCONTRACTOR",
      driverLicenseType: "MEDIUM",
      defaultRole: "WORKER",
      subcontractorId: subcontractor2.id,
      phone: "090-3333-0003",
    },
  ]

  // ── 職人を作成 ──
  const workers = []
  for (const wd of workerDefs) {
    // 既存チェック（名前で重複防止）
    const existing = await prisma.worker.findFirst({ where: { name: wd.name } })
    if (existing) {
      console.log(`  ⏭️  既存スキップ: ${wd.name}`)
      workers.push(existing)
      continue
    }

    const worker = await prisma.worker.create({
      data: {
        name: wd.name,
        furigana: wd.furigana,
        phone: wd.phone ?? null,
        workerType: wd.workerType,
        driverLicenseType: wd.driverLicenseType,
        defaultRole: wd.defaultRole,
        subcontractorId: wd.subcontractorId ?? null,
      },
    })
    workers.push(worker)

    const typeLabel = { EMPLOYEE: "社員", INDEPENDENT: "一人親方", SUBCONTRACTOR: "協力会社" }[wd.workerType]
    const licenseLabel = { NONE: "-", SMALL: "2t", MEDIUM: "4t", SEMI_LARGE: "6t", LARGE: "MAX" }[wd.driverLicenseType]
    console.log(`  ✅ ${wd.name} (${typeLabel}, 免許:${licenseLabel}, ${wd.defaultRole})`)
  }

  // ── 既存の班・スケジュールを取得して配置を追加 ──
  const teams = await prisma.team.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } })
  const schedules = await prisma.constructionSchedule.findMany({
    where: {
      plannedStartDate: { gte: new Date("2026-03-08") },
      plannedEndDate: { lte: new Date("2026-03-22") },
    },
    include: { contract: { include: { project: true } } },
    orderBy: { plannedStartDate: "asc" },
  })

  if (teams.length > 0 && schedules.length > 0) {
    console.log("\n  📋 職人を現場に配置中...")

    // ベトナム人実習生を西田班の新宿タワー東面に追加
    const nishidaTeam = teams.find((t) => t.name.includes("西田"))
    const shinjukuEastSchedule = schedules.find((s) => s.name?.includes("東面1-5F"))

    if (nishidaTeam && shinjukuEastSchedule) {
      const vnWorkers = workers.filter((w) => ["グエン・トゥアン", "ファム・ドゥック", "チャン・タイン"].includes(w.name))
      for (const w of vnWorkers) {
        const exists = await prisma.workerAssignment.findFirst({
          where: { scheduleId: shinjukuEastSchedule.id, teamId: nishidaTeam.id, workerId: w.id },
        })
        if (!exists) {
          await prisma.workerAssignment.create({
            data: {
              scheduleId: shinjukuEastSchedule.id,
              teamId: nishidaTeam.id,
              workerId: w.id,
              assignedRole: "WORKER",
            },
          })
          console.log(`    ✅ ${w.name} → ${nishidaTeam.name} / ${shinjukuEastSchedule.name}`)
        }
      }
    }

    // 残りのベトナム人実習生を佐藤班の渋谷ビルに配置
    const satoTeam = teams.find((t) => t.name.includes("佐藤"))
    const shibuyaSchedule = schedules.find((s) => s.name?.includes("渋谷ビル 南面"))

    if (satoTeam && shibuyaSchedule) {
      const vnWorkers2 = workers.filter((w) => ["レ・ミン", "ホアン・ティエン", "ブイ・ロン"].includes(w.name))
      for (const w of vnWorkers2) {
        const exists = await prisma.workerAssignment.findFirst({
          where: { scheduleId: shibuyaSchedule.id, teamId: satoTeam.id, workerId: w.id },
        })
        if (!exists) {
          await prisma.workerAssignment.create({
            data: {
              scheduleId: shibuyaSchedule.id,
              teamId: satoTeam.id,
              workerId: w.id,
              assignedRole: "WORKER",
            },
          })
          console.log(`    ✅ ${w.name} → ${satoTeam.name} / ${shibuyaSchedule.name}`)
        }
      }
    }

    // 一人親方を田中班の中央建設に配置
    const tanakaTeam = teams.find((t) => t.name.includes("田中"))
    const chuoSchedule = schedules.find((s) => s.name?.includes("札幌") || s.name?.includes("中央"))

    if (tanakaTeam) {
      const targetSchedule = chuoSchedule ?? schedules.find((s) => s.name?.includes("品川"))
      if (targetSchedule) {
        const indWorkers = workers.filter((w) => ["長谷川 勇", "村上 健太"].includes(w.name))
        for (const w of indWorkers) {
          const exists = await prisma.workerAssignment.findFirst({
            where: { scheduleId: targetSchedule.id, teamId: tanakaTeam.id, workerId: w.id },
          })
          if (!exists) {
            await prisma.workerAssignment.create({
              data: {
                scheduleId: targetSchedule.id,
                teamId: tanakaTeam.id,
                workerId: w.id,
                assignedRole: w.name === "長谷川 勇" ? "FOREMAN" : "WORKER",
              },
            })
            console.log(`    ✅ ${w.name} → ${tanakaTeam.name} / ${targetSchedule.name}`)
          }
        }
      }
    }

    // 協力会社を鈴木班の港南台中学校に配置
    const suzukiTeam = teams.find((t) => t.name.includes("鈴木"))
    const konandaiSchedule = schedules.find((s) => s.name?.includes("体育館 正面"))

    if (suzukiTeam && konandaiSchedule) {
      const subWorkers = workers.filter((w) => ["丸山 次郎", "丸山 三郎", "大和 健一"].includes(w.name))
      for (const w of subWorkers) {
        const exists = await prisma.workerAssignment.findFirst({
          where: { scheduleId: konandaiSchedule.id, teamId: suzukiTeam.id, workerId: w.id },
        })
        if (!exists) {
          await prisma.workerAssignment.create({
            data: {
              scheduleId: konandaiSchedule.id,
              teamId: suzukiTeam.id,
              workerId: w.id,
              assignedRole: w.name === "丸山 次郎" ? "FOREMAN" : "WORKER",
            },
          })
          console.log(`    ✅ ${w.name} → ${suzukiTeam.name} / ${konandaiSchedule.name}`)
        }
      }
    }

    // 近藤（一人親方）を鈴木班にも配置
    const kondoWorker = workers.find((w) => w.name === "近藤 誠")
    const konandaiBack = schedules.find((s) => s.name?.includes("体育館 裏面"))
    if (suzukiTeam && konandaiBack && kondoWorker) {
      const exists = await prisma.workerAssignment.findFirst({
        where: { scheduleId: konandaiBack.id, teamId: suzukiTeam.id, workerId: kondoWorker.id },
      })
      if (!exists) {
        await prisma.workerAssignment.create({
          data: {
            scheduleId: konandaiBack.id,
            teamId: suzukiTeam.id,
            workerId: kondoWorker.id,
            assignedRole: "WORKER",
          },
        })
        console.log(`    ✅ ${kondoWorker.name} → ${suzukiTeam.name} / ${konandaiBack.name}`)
      }
    }

    // ── 班分割デモ: 新宿タワー東面を西田班＋佐藤班にまたがらせる ──
    console.log("\n  🔀 班分割デモデータを追加中...")
    if (satoTeam && shinjukuEastSchedule) {
      // 佐藤班にも新宿タワー東面のプレースホルダーを追加（既にアサインがなければ）
      const existingSatoShinjuku = await prisma.workerAssignment.findFirst({
        where: { scheduleId: shinjukuEastSchedule.id, teamId: satoTeam.id },
      })
      if (!existingSatoShinjuku) {
        // プレースホルダー作成
        await prisma.workerAssignment.create({
          data: {
            scheduleId: shinjukuEastSchedule.id,
            teamId: satoTeam.id,
            assignedRole: "WORKER",
          },
        })
        console.log(`    ✅ 班分割: ${shinjukuEastSchedule.name} → ${satoTeam.name}（プレースホルダー）`)

        // 佐藤班に残りの職人を新宿タワー東面に配置
        const satoWorkers = workers.filter((w) =>
          ["レ・ミン", "ホアン・ティエン", "ブイ・ロン"].includes(w.name)
        )
        for (const w of satoWorkers) {
          const exists = await prisma.workerAssignment.findFirst({
            where: { scheduleId: shinjukuEastSchedule.id, teamId: satoTeam.id, workerId: w.id },
          })
          if (!exists) {
            await prisma.workerAssignment.create({
              data: {
                scheduleId: shinjukuEastSchedule.id,
                teamId: satoTeam.id,
                workerId: w.id,
                assignedRole: "WORKER",
              },
            })
            console.log(`    ✅ ${w.name} → ${satoTeam.name} / ${shinjukuEastSchedule.name}（分割②）`)
          }
        }

        // 長谷川を佐藤班の職長に
        const hasegawaWorker = workers.find((w) => w.name === "長谷川 勇")
        if (hasegawaWorker) {
          const exists = await prisma.workerAssignment.findFirst({
            where: { scheduleId: shinjukuEastSchedule.id, teamId: satoTeam.id, workerId: hasegawaWorker.id },
          })
          if (!exists) {
            await prisma.workerAssignment.create({
              data: {
                scheduleId: shinjukuEastSchedule.id,
                teamId: satoTeam.id,
                workerId: hasegawaWorker.id,
                assignedRole: "FOREMAN",
              },
            })
            console.log(`    ✅ ${hasegawaWorker.name}（職長）→ ${satoTeam.name} / ${shinjukuEastSchedule.name}（分割②）`)
          }
        }
      } else {
        console.log(`    ⏭️  班分割: 既に存在 ${shinjukuEastSchedule.name} → ${satoTeam.name}`)
      }
    }
  }

  console.log("")
  console.log("🎉 職人サンプルデータ追加完了！")
  console.log("")
  console.log("追加内容:")
  console.log("  ベトナム人実習生（社員）: 6名")
  console.log("    グエン・トゥアン, ファム・ドゥック, チャン・タイン,")
  console.log("    レ・ミン, ホアン・ティエン, ブイ・ロン")
  console.log("  一人親方: 3名")
  console.log("    長谷川 勇(MAX), 村上 健太(6t), 近藤 誠(4t)")
  console.log("  協力会社: 3名")
  console.log("    丸山 次郎(MAX), 丸山 三郎(6t), 大和 健一(4t)")
  console.log("")
  console.log("班分割デモ:")
  console.log("  新宿タワー東面 → 西田班①（3名）+ 佐藤班②（4名）")
  console.log("  ※ 同じ現場が複数班にまたがり、①②サフィックスと視覚リンクを確認可能")

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("❌ エラー:", e)
  process.exit(1)
})
