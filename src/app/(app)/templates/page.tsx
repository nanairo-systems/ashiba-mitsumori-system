/**
 * [PAGE] テンプレート管理ページ (/templates)
 *
 * 見積作成時に使うテンプレートの一覧・作成・編集を行う。
 * テンプレートは「大項目 > 中項目 > 明細」の3階層構造。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { TemplateList } from "@/components/templates/TemplateList"

export default async function TemplatesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const templates = await prisma.template.findMany({
    where: { isArchived: false },
    include: {
      templateTags: { include: { tag: true } },
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          groups: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
                include: { unit: true },
              },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  return <TemplateList templates={templates} />
}
