/**
 * [PAGE] 労務・人事システム - 社員詳細
 */
import type { Metadata } from "next"
import { EmployeeDetail } from "@/components/labor/employees/EmployeeDetail"

export const metadata: Metadata = { title: "社員詳細" }

export default async function LaborEmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <EmployeeDetail id={id} />
}
