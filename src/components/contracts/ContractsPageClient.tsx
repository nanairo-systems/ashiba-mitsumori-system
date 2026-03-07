"use client"

import { useIsMobile } from "@/hooks/use-mobile"
import { ContractSummary } from "@/components/contracts/ContractSummary"
import { ContractList } from "@/components/contracts/ContractList"
import type { ContractStatus } from "@prisma/client"
import type { WorkTypeMaster } from "@/components/schedules/schedule-types"

interface SummaryContract {
  id: string
  contractDate: string
  contractAmount: number
  taxAmount: number
  totalAmount: number
  startDate: string | null
  endDate: string | null
  name: string | null
  projectName: string | null
  companyId: string
  companyName: string
}

interface ListContract {
  id: string
  contractNumber: string | null
  name: string | null
  status: ContractStatus
  contractAmount: number
  taxAmount: number
  totalAmount: number
  contractDate: Date
  startDate: Date | null
  endDate: Date | null
  paymentTerms: string | null
  note: string | null
  createdAt: Date
  project: {
    id: string
    name: string
    address: string | null
    branch: { name: string; company: { id: string; name: string } }
    contact: { name: string } | null
  }
  estimate: {
    id: string
    estimateNumber: string | null
    title: string | null
    user: { id: string; name: string }
  }
  estimateCount: number
  gate: {
    scheduleCount: number
    hasActualStart: boolean
    allActualEnd: boolean
    invoiceCount: number
    allInvoicesPaid: boolean
  }
}

interface Props {
  userRole: "ADMIN" | "STAFF" | "DEVELOPER"
  currentUser: { id: string; name: string }
  summaryContracts: SummaryContract[]
  listContracts: ListContract[] | null
  workTypes: WorkTypeMaster[]
}

export function ContractsPageClient({
  userRole,
  currentUser,
  summaryContracts,
  listContracts,
  workTypes,
}: Props) {
  const isMobile = useIsMobile()

  // DEVELOPER + PC → 元の ContractList
  // それ以外（STAFF/ADMIN、またはモバイル） → ContractSummary
  if (userRole === "DEVELOPER" && !isMobile && listContracts) {
    return <ContractList contracts={listContracts} currentUser={currentUser} workTypes={workTypes} />
  }

  return <ContractSummary contracts={summaryContracts} />
}
