import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // 単位マスター（初期セット）
  const units = [
    { name: "一式", sortOrder: 1 },
    { name: "式", sortOrder: 2 },
    { name: "m", sortOrder: 3 },
    { name: "㎡", sortOrder: 4 },
    { name: "箇所", sortOrder: 5 },
    { name: "枚", sortOrder: 6 },
    { name: "セット", sortOrder: 7 },
    { name: "日", sortOrder: 8 },
  ]

  for (const unit of units) {
    await prisma.unit.upsert({
      where: { name: unit.name },
      update: {},
      create: unit,
    })
  }

  console.log("✅ 単位マスターを初期化しました")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
