/**
 * [SEED] 2週間分の人員配置サンプルデータ投入スクリプト
 *
 * 今日(2026-03-14)から2週間先(2026-03-28)まで、
 * 各班に職人・職長・車両を配置するサンプルデータを作成。
 *
 * 実行: npx tsx prisma/seed-assignments-2weeks.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL })
const prisma = new PrismaClient({ adapter })

// ── 定数 ──
const TEAM_IDS = {
  A班: "7364b545-e09a-4b8b-811c-e4e29b98578c",
  テスト: "216a9959-ce25-402f-93b0-02c9e7fa8494",
  西田班: "84fc6e47-2cdb-4756-88e3-36c4e0b029c6",
  佐藤班: "e33a029d-c3d4-4a59-8aeb-9975e6f59f0f",
  田中班: "fe88e70f-1fe6-4cff-a9ca-bf98b0cb1f17",
  山本班: "0af7d33e-71b5-4311-88d0-93f0eb44afb0",
  鈴木班: "670ca922-c683-48d3-a34c-b34f130c703a",
  高橋班: "744d97b7-7326-4080-aaed-50a0551249f8",
}

const WORKER_IDS = {
  佐藤一郎: "980eed44-da88-4132-adc6-787ba715d93b",
  田中二郎: "aa58cbde-6280-490d-af92-0660cfa47620",
  山本三郎: "4bd2a2d8-45ef-4566-8f07-0a807400a0b9",
  鈴木四郎: "0d3f2a2d-41b8-4f7c-93dc-f2078a6a0af6",
  高橋五郎: "fadae2cb-5c00-4bf4-ac52-841897f24bf6",
  長谷川勇: "a4032e0c-b229-4589-a8df-a9afed51573f",
  グエントゥアン: "ef2cc602-35e2-4c11-a358-27996864fe0f",
  チャンタイン: "771928ab-fcf2-4048-8186-13a65e1647ab",
  ファムドゥック: "a14b4fa2-cf2a-452e-a1d0-d757b1296620",
  ホアンティエン: "77e8f2ac-93c4-42bb-9fe3-92db002cc3d5",
  レミン: "0e735f7b-5880-49f6-af76-72cfa34e8007",
  ブイロン: "0f6c2ebe-01f7-4268-90f7-46b22602796e",  // needs verification from actual ID
  中村太一: "0f6c2ebe-01f7-4268-90f7-46b22602796e",
  丸山次郎: "6eb68608-2187-497f-a0db-15fb17e1e7cc",
  丸山三郎: "b6546ea1-2011-4695-9bec-4d391e763933",
  大和健一: "ce154ff3-98cc-4c8a-8c76-0e983a5c5bd0",
  井上直樹: "107a5874-e3a3-482f-bf3f-792843f50afa",
  伊藤大輔: "086f7238-9d78-4bb6-b6d8-324b7c16dc63",
  佐々木亮: "811c290f-d1e1-4cb4-a871-0707f56c5596",
  前田翼: "aafea12b-6edb-4b4d-bce8-804572f3683b",
  吉田和也: "3ff359a9-08fd-4a54-8d06-b2174832c8db",
  小林雄太: "a1d06090-2be8-4da8-931a-435cb53e34a2",
  小林勝庸: "e0463676-2509-4a35-9a20-05c70650cf3f",
  山口拓也: "417ed079-8eb1-449d-bc2b-e6c0515280e5",
  山田太郎: "f59b7ec4-90b4-45b1-b093-8ea0a9df1189",
  岡田良平: "7d100de0-b1cd-4b36-a47a-a6a218b824b1",
  斎藤大地: "bcf4912c-eb72-43c1-8c1d-c9a4de5a65c9",
  木村翔太: "d75abd30-8e87-4d15-86f4-512201d8f161",
  村上健太: "c260ff66-e267-4344-8226-48930178d38c",
  松本健太: "4ac20905-63be-4099-a120-459680ade195",
  林勇気: "d296eb66-1687-4f7c-a958-28909da22ffe",
  清水和人: "306cc99e-7cbe-410d-84a2-1b964ee0a127",
  渡辺健: "1485675a-134e-4373-beed-885ad9b28ef8",
  石川裕也: "de2185d9-618b-4bd8-abfb-71f9f7fba303",
  藤田慎太郎: "c91d7e78-6a17-4b91-bc9c-e94c3e5ca1d9",
  西田健太: "b8c3dfd5-b9c0-47ff-941a-50973aad1b1d",
  近藤誠: "8dc4dfed-7a4e-4145-b91f-6506aeaba670",
  高田誠: "73929228-2ad1-48db-b693-9043d76d02c7",
}

const VEHICLE_IDS = {
  "2tトラック": "dac3795e-2b2c-4e13-ace6-11ae3e5867e1",
  "4tユニック": "570cb8ea-719d-46f3-879e-ff50b0ba527e",
  "3tアルファード": "bc71df88-4b24-4c98-8df4-4c614d4bd92d",
}

const PROJECT_IDS = {
  山田ビル屋上防水: "dc26ab0e-7388-4696-bb5d-25840730c8b8",
  山田ビル別館: "c393a6ce-c5c8-441f-9b4f-2144298e1ed1",
  目黒区マンション: "135ea804-937e-42b0-a994-ef5f3e80b329",
  川崎市商業ビル: "db7f78f6-2b2e-41cf-a983-19fa4e1e2d41",
  田中マンション: "1865af28-4012-467c-b26d-39e5be30261e",
  鈴木レジデンス名古屋: "e2c5b19a-d28e-4185-bbf4-2179328805a8",
  新宿グランドタワー: "25bc3d71-057b-4103-8a12-96f1dabb3558",
  世田谷戸建て: "58a7ca45-44ec-48ac-b90a-c3e40be355d0",
  田中工務店堺市: "9aebbfa0-a6f1-414a-ac47-022b215f796f",
  九州建工博多駅南: "9535ead4-e932-41db-abac-60b246c71cdc",
}

function d(dateStr: string) {
  return new Date(dateStr + "T00:00:00.000Z")
}

async function main() {
  console.log("🌱 2週間分の人員配置サンプルデータを投入します...")
  console.log("   期間: 2026-03-14 〜 2026-03-28\n")

  // ── 1. 新しい車両を追加 ──
  console.log("🚛 車両を追加中...")
  const newVehicles = [
    { id: "seed-vehicle-dump-2t", name: "2tダンプ", licensePlate: "名古屋 400 う 7890", vehicleType: "日野 デュトロ", capacity: "2t" },
    { id: "seed-vehicle-unic-3t", name: "3tユニック", licensePlate: "品川 400 え 3456", vehicleType: "古河ユニック", capacity: "3t" },
    { id: "seed-vehicle-hiace", name: "ハイエース", licensePlate: "横浜 300 お 9012", vehicleType: "トヨタ ハイエース", capacity: "人員輸送" },
    { id: "seed-vehicle-4t-flat", name: "4t平ボディ", licensePlate: "品川 100 か 4567", vehicleType: "いすゞ フォワード", capacity: "4t" },
  ]

  for (const v of newVehicles) {
    const existing = await prisma.vehicle.findUnique({ where: { id: v.id } })
    if (existing) {
      console.log(`  ⏭️  既存: ${v.name}`)
    } else {
      await prisma.vehicle.create({ data: v })
      console.log(`  ✅ ${v.name} (${v.licensePlate})`)
    }
  }

  // ── 2. 新しいスケジュール（工程）を作成 ──
  console.log("\n📅 工程を作成中...")

  interface ScheduleDef {
    id: string
    projectId: string
    projectLabel: string
    workType: string
    name: string
    plannedStart: string
    plannedEnd: string
    actualStart?: string
  }

  const scheduleDefs: ScheduleDef[] = [
    // 佐藤班向け: 山田ビル 屋上防水足場 組立（3/14-3/18, 5日間）
    {
      id: "seed-sch-yamada-roof-asm",
      projectId: PROJECT_IDS.山田ビル屋上防水,
      projectLabel: "山田ビル 屋上防水足場",
      workType: "ASSEMBLY",
      name: "屋上防水 足場組立",
      plannedStart: "2026-03-14",
      plannedEnd: "2026-03-18",
      actualStart: "2026-03-14",
    },
    // 田中班向け: 目黒区マンション 組立（3/16-3/20, 5日間）
    {
      id: "seed-sch-meguro-asm",
      projectId: PROJECT_IDS.目黒区マンション,
      projectLabel: "目黒区マンション大規模修繕",
      workType: "ASSEMBLY",
      name: "北面 足場組立",
      plannedStart: "2026-03-16",
      plannedEnd: "2026-03-20",
    },
    // 山本班向け: 川崎市商業ビル 組立（3/14-3/16, 3日間）
    {
      id: "seed-sch-kawasaki-asm",
      projectId: PROJECT_IDS.川崎市商業ビル,
      projectLabel: "川崎市商業ビル改修",
      workType: "ASSEMBLY",
      name: "東面 足場組立",
      plannedStart: "2026-03-14",
      plannedEnd: "2026-03-16",
      actualStart: "2026-03-14",
    },
    // 山本班向け: 川崎市商業ビル 解体（3/25-3/27, 3日間）
    {
      id: "seed-sch-kawasaki-dis",
      projectId: PROJECT_IDS.川崎市商業ビル,
      projectLabel: "川崎市商業ビル改修",
      workType: "DISASSEMBLY",
      name: "東面 足場解体",
      plannedStart: "2026-03-25",
      plannedEnd: "2026-03-27",
    },
    // 鈴木班向け: 田中マンション 組立（3/17-3/19, 3日間）
    {
      id: "seed-sch-tanaka-mansion-asm",
      projectId: PROJECT_IDS.田中マンション,
      projectLabel: "田中マンション新築工事",
      workType: "ASSEMBLY",
      name: "南面 足場組立",
      plannedStart: "2026-03-17",
      plannedEnd: "2026-03-19",
    },
    // 高橋班向け: 新宿グランドタワー 組立（3/14-3/28, 全期間）
    {
      id: "seed-sch-shinjuku-grand-asm",
      projectId: PROJECT_IDS.新宿グランドタワー,
      projectLabel: "新宿グランドタワー 外壁大規模改修",
      workType: "ASSEMBLY",
      name: "西面1-10F 足場組立",
      plannedStart: "2026-03-14",
      plannedEnd: "2026-03-28",
      actualStart: "2026-03-14",
    },
    // 西田班向け: 山田ビル別館 解体（3/23-3/25, 3日間）
    {
      id: "seed-sch-yamada-annex-dis",
      projectId: PROJECT_IDS.山田ビル別館,
      projectLabel: "山田ビル別館 外壁補修",
      workType: "DISASSEMBLY",
      name: "別館 足場解体",
      plannedStart: "2026-03-23",
      plannedEnd: "2026-03-25",
    },
    // A班向け: 鈴木レジデンス名古屋 その他（3/20-3/21, 2日間）
    {
      id: "seed-sch-suzuki-resi-rework",
      projectId: PROJECT_IDS.鈴木レジデンス名古屋,
      projectLabel: "鈴木レジデンス名古屋 大規模修繕",
      workType: "REWORK",
      name: "手直し・補修作業",
      plannedStart: "2026-03-20",
      plannedEnd: "2026-03-21",
    },
    // 佐藤班向け(2つ目): 田中工務店堺市 組立（3/21-3/24, 4日間）
    {
      id: "seed-sch-sakai-asm",
      projectId: PROJECT_IDS.田中工務店堺市,
      projectLabel: "田中工務店 堺市倉庫塗装",
      workType: "ASSEMBLY",
      name: "倉庫外壁 足場組立",
      plannedStart: "2026-03-21",
      plannedEnd: "2026-03-24",
    },
    // 田中班向け(2つ目): 九州建工 博多駅南 組立（3/23-3/26, 4日間）
    {
      id: "seed-sch-hakata-asm",
      projectId: PROJECT_IDS.九州建工博多駅南,
      projectLabel: "九州建工 博多駅南ホテル新築",
      workType: "ASSEMBLY",
      name: "正面 足場組立",
      plannedStart: "2026-03-23",
      plannedEnd: "2026-03-26",
    },
    // 西田班向け(前半): 世田谷戸建て 組立（3/14-3/17, 4日間）
    {
      id: "seed-sch-setagaya-asm2",
      projectId: PROJECT_IDS.世田谷戸建て,
      projectLabel: "世田谷区戸建て外壁塗装",
      workType: "ASSEMBLY",
      name: "正面 足場組立",
      plannedStart: "2026-03-14",
      plannedEnd: "2026-03-17",
      actualStart: "2026-03-14",
    },
    // 鈴木班向け(2つ目): 目黒区マンション 解体（3/24-3/26）
    {
      id: "seed-sch-meguro-dis",
      projectId: PROJECT_IDS.目黒区マンション,
      projectLabel: "目黒区マンション大規模修繕",
      workType: "DISASSEMBLY",
      name: "北面 足場解体",
      plannedStart: "2026-03-24",
      plannedEnd: "2026-03-26",
    },
  ]

  const scheduleIds: Record<string, string> = {}

  for (const sDef of scheduleDefs) {
    const existing = await prisma.constructionSchedule.findUnique({ where: { id: sDef.id } })
    if (existing) {
      console.log(`  ⏭️  既存: ${sDef.projectLabel} / ${sDef.name}`)
      scheduleIds[sDef.id] = sDef.id
      continue
    }

    // WorkContent を作成
    const workContent = await prisma.workContent.create({
      data: { name: sDef.name, projectId: sDef.projectId },
    })

    await prisma.constructionSchedule.create({
      data: {
        id: sDef.id,
        projectId: sDef.projectId,
        workContentId: workContent.id,
        workType: sDef.workType,
        name: sDef.name,
        plannedStartDate: d(sDef.plannedStart),
        plannedEndDate: d(sDef.plannedEnd),
        actualStartDate: sDef.actualStart ? d(sDef.actualStart) : null,
      },
    })
    scheduleIds[sDef.id] = sDef.id
    console.log(`  ✅ ${sDef.projectLabel} / ${sDef.name} (${sDef.workType} ${sDef.plannedStart}〜${sDef.plannedEnd})`)
  }

  // ── 3. 人員配置（WorkerAssignment）を作成 ──
  console.log("\n👷 人員配置を作成中...")

  interface AssignmentDef {
    scheduleId: string
    teamId: string
    teamLabel: string
    workerId?: string
    workerLabel?: string
    vehicleId?: string
    vehicleLabel?: string
    role: "FOREMAN" | "WORKER"
  }

  const assignmentDefs: AssignmentDef[] = [
    // ── 佐藤班: 山田ビル屋上防水 (3/14-3/18) ──
    { scheduleId: "seed-sch-yamada-roof-asm", teamId: TEAM_IDS.佐藤班, teamLabel: "佐藤班", workerId: WORKER_IDS.佐藤一郎, workerLabel: "佐藤 一郎", role: "FOREMAN" },
    { scheduleId: "seed-sch-yamada-roof-asm", teamId: TEAM_IDS.佐藤班, teamLabel: "佐藤班", workerId: WORKER_IDS.グエントゥアン, workerLabel: "グエン・トゥアン", role: "WORKER" },
    { scheduleId: "seed-sch-yamada-roof-asm", teamId: TEAM_IDS.佐藤班, teamLabel: "佐藤班", workerId: WORKER_IDS.ファムドゥック, workerLabel: "ファム・ドゥック", role: "WORKER" },
    { scheduleId: "seed-sch-yamada-roof-asm", teamId: TEAM_IDS.佐藤班, teamLabel: "佐藤班", workerId: WORKER_IDS.前田翼, workerLabel: "前田 翼", role: "WORKER" },
    { scheduleId: "seed-sch-yamada-roof-asm", teamId: TEAM_IDS.佐藤班, teamLabel: "佐藤班", workerId: WORKER_IDS.小林雄太, workerLabel: "小林 雄太", role: "WORKER" },
    { scheduleId: "seed-sch-yamada-roof-asm", teamId: TEAM_IDS.佐藤班, teamLabel: "佐藤班", vehicleId: VEHICLE_IDS["2tトラック"], vehicleLabel: "2tトラック", role: "WORKER" },
    { scheduleId: "seed-sch-yamada-roof-asm", teamId: TEAM_IDS.佐藤班, teamLabel: "佐藤班", vehicleId: "seed-vehicle-hiace", vehicleLabel: "ハイエース", role: "WORKER" },

    // ── 佐藤班: 田中工務店堺市 (3/21-3/24) ──
    { scheduleId: "seed-sch-sakai-asm", teamId: TEAM_IDS.佐藤班, teamLabel: "佐藤班", workerId: WORKER_IDS.佐藤一郎, workerLabel: "佐藤 一郎", role: "FOREMAN" },
    { scheduleId: "seed-sch-sakai-asm", teamId: TEAM_IDS.佐藤班, teamLabel: "佐藤班", workerId: WORKER_IDS.グエントゥアン, workerLabel: "グエン・トゥアン", role: "WORKER" },
    { scheduleId: "seed-sch-sakai-asm", teamId: TEAM_IDS.佐藤班, teamLabel: "佐藤班", workerId: WORKER_IDS.前田翼, workerLabel: "前田 翼", role: "WORKER" },
    { scheduleId: "seed-sch-sakai-asm", teamId: TEAM_IDS.佐藤班, teamLabel: "佐藤班", vehicleId: VEHICLE_IDS["2tトラック"], vehicleLabel: "2tトラック", role: "WORKER" },

    // ── 田中班: 目黒区マンション (3/16-3/20) ──
    { scheduleId: "seed-sch-meguro-asm", teamId: TEAM_IDS.田中班, teamLabel: "田中班", workerId: WORKER_IDS.田中二郎, workerLabel: "田中 二郎", role: "FOREMAN" },
    { scheduleId: "seed-sch-meguro-asm", teamId: TEAM_IDS.田中班, teamLabel: "田中班", workerId: WORKER_IDS.レミン, workerLabel: "レ・ミン", role: "WORKER" },
    { scheduleId: "seed-sch-meguro-asm", teamId: TEAM_IDS.田中班, teamLabel: "田中班", workerId: WORKER_IDS.ホアンティエン, workerLabel: "ホアン・ティエン", role: "WORKER" },
    { scheduleId: "seed-sch-meguro-asm", teamId: TEAM_IDS.田中班, teamLabel: "田中班", workerId: WORKER_IDS.山田太郎, workerLabel: "山田太郎", role: "WORKER" },
    { scheduleId: "seed-sch-meguro-asm", teamId: TEAM_IDS.田中班, teamLabel: "田中班", workerId: WORKER_IDS.高田誠, workerLabel: "高田 誠", role: "WORKER" },
    { scheduleId: "seed-sch-meguro-asm", teamId: TEAM_IDS.田中班, teamLabel: "田中班", vehicleId: "seed-vehicle-dump-2t", vehicleLabel: "2tダンプ", role: "WORKER" },

    // ── 田中班: 九州建工博多駅南 (3/23-3/26) ──
    { scheduleId: "seed-sch-hakata-asm", teamId: TEAM_IDS.田中班, teamLabel: "田中班", workerId: WORKER_IDS.田中二郎, workerLabel: "田中 二郎", role: "FOREMAN" },
    { scheduleId: "seed-sch-hakata-asm", teamId: TEAM_IDS.田中班, teamLabel: "田中班", workerId: WORKER_IDS.山田太郎, workerLabel: "山田太郎", role: "WORKER" },
    { scheduleId: "seed-sch-hakata-asm", teamId: TEAM_IDS.田中班, teamLabel: "田中班", workerId: WORKER_IDS.高田誠, workerLabel: "高田 誠", role: "WORKER" },
    { scheduleId: "seed-sch-hakata-asm", teamId: TEAM_IDS.田中班, teamLabel: "田中班", workerId: WORKER_IDS.伊藤大輔, workerLabel: "伊藤 大輔", role: "WORKER" },

    // ── 山本班: 川崎商業ビル 組立 (3/14-3/16) ──
    { scheduleId: "seed-sch-kawasaki-asm", teamId: TEAM_IDS.山本班, teamLabel: "山本班", workerId: WORKER_IDS.山本三郎, workerLabel: "山本 三郎", role: "FOREMAN" },
    { scheduleId: "seed-sch-kawasaki-asm", teamId: TEAM_IDS.山本班, teamLabel: "山本班", workerId: WORKER_IDS.岡田良平, workerLabel: "岡田 良平", role: "WORKER" },
    { scheduleId: "seed-sch-kawasaki-asm", teamId: TEAM_IDS.山本班, teamLabel: "山本班", workerId: WORKER_IDS.斎藤大地, workerLabel: "斎藤 大地", role: "WORKER" },
    { scheduleId: "seed-sch-kawasaki-asm", teamId: TEAM_IDS.山本班, teamLabel: "山本班", workerId: WORKER_IDS.松本健太, workerLabel: "松本 健太", role: "WORKER" },
    { scheduleId: "seed-sch-kawasaki-asm", teamId: TEAM_IDS.山本班, teamLabel: "山本班", vehicleId: VEHICLE_IDS["4tユニック"], vehicleLabel: "4tユニック", role: "WORKER" },
    { scheduleId: "seed-sch-kawasaki-asm", teamId: TEAM_IDS.山本班, teamLabel: "山本班", vehicleId: "seed-vehicle-4t-flat", vehicleLabel: "4t平ボディ", role: "WORKER" },

    // ── 山本班: 川崎商業ビル 解体 (3/25-3/27) ──
    { scheduleId: "seed-sch-kawasaki-dis", teamId: TEAM_IDS.山本班, teamLabel: "山本班", workerId: WORKER_IDS.山本三郎, workerLabel: "山本 三郎", role: "FOREMAN" },
    { scheduleId: "seed-sch-kawasaki-dis", teamId: TEAM_IDS.山本班, teamLabel: "山本班", workerId: WORKER_IDS.岡田良平, workerLabel: "岡田 良平", role: "WORKER" },
    { scheduleId: "seed-sch-kawasaki-dis", teamId: TEAM_IDS.山本班, teamLabel: "山本班", workerId: WORKER_IDS.松本健太, workerLabel: "松本 健太", role: "WORKER" },
    { scheduleId: "seed-sch-kawasaki-dis", teamId: TEAM_IDS.山本班, teamLabel: "山本班", vehicleId: VEHICLE_IDS["4tユニック"], vehicleLabel: "4tユニック", role: "WORKER" },

    // ── 鈴木班: 田中マンション (3/17-3/19) ──
    { scheduleId: "seed-sch-tanaka-mansion-asm", teamId: TEAM_IDS.鈴木班, teamLabel: "鈴木班", workerId: WORKER_IDS.鈴木四郎, workerLabel: "鈴木 四郎", role: "FOREMAN" },
    { scheduleId: "seed-sch-tanaka-mansion-asm", teamId: TEAM_IDS.鈴木班, teamLabel: "鈴木班", workerId: WORKER_IDS.丸山次郎, workerLabel: "丸山 次郎", role: "WORKER" },
    { scheduleId: "seed-sch-tanaka-mansion-asm", teamId: TEAM_IDS.鈴木班, teamLabel: "鈴木班", workerId: WORKER_IDS.丸山三郎, workerLabel: "丸山 三郎", role: "WORKER" },
    { scheduleId: "seed-sch-tanaka-mansion-asm", teamId: TEAM_IDS.鈴木班, teamLabel: "鈴木班", workerId: WORKER_IDS.大和健一, workerLabel: "大和 健一", role: "WORKER" },
    { scheduleId: "seed-sch-tanaka-mansion-asm", teamId: TEAM_IDS.鈴木班, teamLabel: "鈴木班", workerId: WORKER_IDS.佐々木亮, workerLabel: "佐々木 亮", role: "WORKER" },
    { scheduleId: "seed-sch-tanaka-mansion-asm", teamId: TEAM_IDS.鈴木班, teamLabel: "鈴木班", vehicleId: "seed-vehicle-unic-3t", vehicleLabel: "3tユニック", role: "WORKER" },

    // ── 鈴木班: 目黒区マンション 解体 (3/24-3/26) ──
    { scheduleId: "seed-sch-meguro-dis", teamId: TEAM_IDS.鈴木班, teamLabel: "鈴木班", workerId: WORKER_IDS.鈴木四郎, workerLabel: "鈴木 四郎", role: "FOREMAN" },
    { scheduleId: "seed-sch-meguro-dis", teamId: TEAM_IDS.鈴木班, teamLabel: "鈴木班", workerId: WORKER_IDS.丸山次郎, workerLabel: "丸山 次郎", role: "WORKER" },
    { scheduleId: "seed-sch-meguro-dis", teamId: TEAM_IDS.鈴木班, teamLabel: "鈴木班", workerId: WORKER_IDS.大和健一, workerLabel: "大和 健一", role: "WORKER" },

    // ── 高橋班: 新宿グランドタワー (3/14-3/28, 全期間) ──
    { scheduleId: "seed-sch-shinjuku-grand-asm", teamId: TEAM_IDS.高橋班, teamLabel: "高橋班", workerId: WORKER_IDS.高橋五郎, workerLabel: "高橋 五郎", role: "FOREMAN" },
    { scheduleId: "seed-sch-shinjuku-grand-asm", teamId: TEAM_IDS.高橋班, teamLabel: "高橋班", workerId: WORKER_IDS.長谷川勇, workerLabel: "長谷川 勇", role: "WORKER" },
    { scheduleId: "seed-sch-shinjuku-grand-asm", teamId: TEAM_IDS.高橋班, teamLabel: "高橋班", workerId: WORKER_IDS.村上健太, workerLabel: "村上 健太", role: "WORKER" },
    { scheduleId: "seed-sch-shinjuku-grand-asm", teamId: TEAM_IDS.高橋班, teamLabel: "高橋班", workerId: WORKER_IDS.林勇気, workerLabel: "林 勇気", role: "WORKER" },
    { scheduleId: "seed-sch-shinjuku-grand-asm", teamId: TEAM_IDS.高橋班, teamLabel: "高橋班", workerId: WORKER_IDS.渡辺健, workerLabel: "渡辺 健", role: "WORKER" },
    { scheduleId: "seed-sch-shinjuku-grand-asm", teamId: TEAM_IDS.高橋班, teamLabel: "高橋班", workerId: WORKER_IDS.石川裕也, workerLabel: "石川 裕也", role: "WORKER" },
    { scheduleId: "seed-sch-shinjuku-grand-asm", teamId: TEAM_IDS.高橋班, teamLabel: "高橋班", vehicleId: VEHICLE_IDS["3tアルファード"], vehicleLabel: "3tアルファード", role: "WORKER" },
    { scheduleId: "seed-sch-shinjuku-grand-asm", teamId: TEAM_IDS.高橋班, teamLabel: "高橋班", vehicleId: "seed-vehicle-dump-2t", vehicleLabel: "2tダンプ", role: "WORKER" },

    // ── 西田班: 世田谷戸建て 組立 (3/14-3/17) ──
    { scheduleId: "seed-sch-setagaya-asm2", teamId: TEAM_IDS.西田班, teamLabel: "西田班", workerId: WORKER_IDS.清水和人, workerLabel: "清水 和人", role: "FOREMAN" },
    { scheduleId: "seed-sch-setagaya-asm2", teamId: TEAM_IDS.西田班, teamLabel: "西田班", workerId: WORKER_IDS.木村翔太, workerLabel: "木村 翔太", role: "WORKER" },
    { scheduleId: "seed-sch-setagaya-asm2", teamId: TEAM_IDS.西田班, teamLabel: "西田班", workerId: WORKER_IDS.井上直樹, workerLabel: "井上 直樹", role: "WORKER" },
    { scheduleId: "seed-sch-setagaya-asm2", teamId: TEAM_IDS.西田班, teamLabel: "西田班", workerId: WORKER_IDS.チャンタイン, workerLabel: "チャン・タイン", role: "WORKER" },
    { scheduleId: "seed-sch-setagaya-asm2", teamId: TEAM_IDS.西田班, teamLabel: "西田班", vehicleId: "seed-vehicle-hiace", vehicleLabel: "ハイエース", role: "WORKER" },

    // ── 西田班: 山田ビル別館 解体 (3/23-3/25) ──
    { scheduleId: "seed-sch-yamada-annex-dis", teamId: TEAM_IDS.西田班, teamLabel: "西田班", workerId: WORKER_IDS.西田健太, workerLabel: "西田 健太", role: "FOREMAN" },
    { scheduleId: "seed-sch-yamada-annex-dis", teamId: TEAM_IDS.西田班, teamLabel: "西田班", workerId: WORKER_IDS.近藤誠, workerLabel: "近藤 誠", role: "WORKER" },
    { scheduleId: "seed-sch-yamada-annex-dis", teamId: TEAM_IDS.西田班, teamLabel: "西田班", workerId: WORKER_IDS.木村翔太, workerLabel: "木村 翔太", role: "WORKER" },
    { scheduleId: "seed-sch-yamada-annex-dis", teamId: TEAM_IDS.西田班, teamLabel: "西田班", workerId: WORKER_IDS.井上直樹, workerLabel: "井上 直樹", role: "WORKER" },
    { scheduleId: "seed-sch-yamada-annex-dis", teamId: TEAM_IDS.西田班, teamLabel: "西田班", vehicleId: "seed-vehicle-unic-3t", vehicleLabel: "3tユニック", role: "WORKER" },

    // ── A班: 鈴木レジデンス 手直し (3/20-3/21) ──
    { scheduleId: "seed-sch-suzuki-resi-rework", teamId: TEAM_IDS.A班, teamLabel: "A班", workerId: WORKER_IDS.小林勝庸, workerLabel: "小林勝庸", role: "FOREMAN" },
    { scheduleId: "seed-sch-suzuki-resi-rework", teamId: TEAM_IDS.A班, teamLabel: "A班", workerId: WORKER_IDS.吉田和也, workerLabel: "吉田 和也", role: "WORKER" },
    { scheduleId: "seed-sch-suzuki-resi-rework", teamId: TEAM_IDS.A班, teamLabel: "A班", workerId: WORKER_IDS.藤田慎太郎, workerLabel: "藤田 慎太郎", role: "WORKER" },
    { scheduleId: "seed-sch-suzuki-resi-rework", teamId: TEAM_IDS.A班, teamLabel: "A班", workerId: WORKER_IDS.山口拓也, workerLabel: "山口 拓也", role: "WORKER" },

    // ── 班分割デモ: 新宿グランドタワーに佐藤班も参加 (3/19-3/22) ──
    { scheduleId: "seed-sch-shinjuku-grand-asm", teamId: TEAM_IDS.佐藤班, teamLabel: "佐藤班(応援)", workerId: WORKER_IDS.ファムドゥック, workerLabel: "ファム・ドゥック", role: "WORKER" },
    { scheduleId: "seed-sch-shinjuku-grand-asm", teamId: TEAM_IDS.佐藤班, teamLabel: "佐藤班(応援)", workerId: WORKER_IDS.小林雄太, workerLabel: "小林 雄太", role: "WORKER" },
  ]

  let createdCount = 0
  let skippedCount = 0

  for (const aDef of assignmentDefs) {
    // 重複チェック
    const whereClause: Record<string, unknown> = {
      scheduleId: aDef.scheduleId,
      teamId: aDef.teamId,
    }
    if (aDef.workerId) whereClause.workerId = aDef.workerId
    if (aDef.vehicleId) whereClause.vehicleId = aDef.vehicleId

    const existing = await prisma.workerAssignment.findFirst({ where: whereClause })
    if (existing) {
      skippedCount++
      continue
    }

    await prisma.workerAssignment.create({
      data: {
        scheduleId: aDef.scheduleId,
        teamId: aDef.teamId,
        workerId: aDef.workerId ?? null,
        vehicleId: aDef.vehicleId ?? null,
        assignedRole: aDef.role,
        sortOrder: createdCount,
      },
    })
    createdCount++
    const label = aDef.workerLabel || aDef.vehicleLabel || "プレースホルダー"
    const roleStr = aDef.role === "FOREMAN" ? "👷‍♂️職長" : "🔧職人"
    console.log(`  ✅ ${aDef.teamLabel} → ${label} (${roleStr})`)
  }

  console.log(`\n  作成: ${createdCount}件, スキップ: ${skippedCount}件`)

  // ── サマリー ──
  console.log("\n" + "=".repeat(60))
  console.log("🎉 サンプルデータ投入完了！")
  console.log("=".repeat(60))
  console.log("\n📊 投入内容サマリー:")
  console.log("")
  console.log("  【車両追加】 4台")
  console.log("    2tダンプ / 3tユニック / ハイエース / 4t平ボディ")
  console.log("")
  console.log("  【工程追加】 12件 (3/14〜3/28)")
  console.log("    佐藤班: 山田ビル屋上防水 組立(3/14-18) → 堺市倉庫 組立(3/21-24)")
  console.log("    田中班: 目黒区マンション 組立(3/16-20) → 博多駅南 組立(3/23-26)")
  console.log("    山本班: 川崎商業ビル 組立(3/14-16) → 解体(3/25-27)")
  console.log("    鈴木班: 田中マンション 組立(3/17-19) → 目黒区マンション 解体(3/24-26)")
  console.log("    高橋班: 新宿グランドタワー 組立(3/14-28) ★全期間")
  console.log("    西田班: 世田谷戸建て 組立(3/14-17) → 山田ビル別館 解体(3/23-25)")
  console.log("    A班:   鈴木レジデンス 手直し(3/20-21)")
  console.log("")
  console.log("  【班分割】")
  console.log("    新宿グランドタワー → 高橋班(メイン) + 佐藤班(応援)")
  console.log("")
  console.log("  【パターン】")
  console.log("    ・組立/解体/手直しの3工種")
  console.log("    ・前半→後半で現場が切り替わる班（佐藤班・田中班・西田班）")
  console.log("    ・全期間通しの大型現場（高橋班: 新宿グランドタワー）")
  console.log("    ・協力会社員（丸山・大和）の配置")
  console.log("    ・車両とセットの配置")
  console.log("    ・1つの現場に2班が参加する班分割")

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("❌ エラー:", e)
  process.exit(1)
})
