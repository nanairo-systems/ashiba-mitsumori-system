/**
 * [API] 労務システム - 社員詳細取得・更新
 */
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function mapDetailRow(r: any) {
  const toDate = (v: any) => v ? String(v).split("T")[0] : null
  return {
    id: r.id,
    name: r.name,
    nameKana: r.nameKana ?? null,
    gender: r.gender ?? null,
    birthDate: toDate(r.birthDate),
    address: r.address ?? null,
    emergencyContact: r.emergencyContact ?? null,
    emergencyPhone: r.emergencyPhone ?? null,
    myNumber: r.myNumber ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    note: r.note ?? null,
    isActive: r.isActive,
    // 雇用情報
    employeeNumber: r.employeeNumber ?? null,
    hireDate: toDate(r.hireDate),
    employmentType: r.employmentType ?? "FULL_TIME",
    position: r.position ?? null,
    departmentId: r.departmentId ?? null,
    storeId: r.storeId ?? null,
    contractStart: toDate(r.contractStart),
    contractEnd: toDate(r.contractEnd),
    department: r.dept_id
      ? { id: r.dept_id, name: r.dept_name, company: { id: r.company_id, name: r.company_name, colorCode: r.company_color } }
      : null,
    store: r.store_id ? { id: r.store_id, name: r.store_name } : null,
    // 給与・税務
    baseSalary: r.baseSalary != null ? Number(r.baseSalary) : null,
    bankName: r.bankName ?? null,
    bankBranch: r.bankBranch ?? null,
    bankAccountType: r.bankAccountType ?? null,
    bankAccountNumber: r.bankAccountNumber ?? null,
    hasDependents: r.hasDependents ?? false,
    dependentCount: r.dependentCount != null ? Number(r.dependentCount) : 0,
    // 社会保険
    healthInsuranceNumber: r.healthInsuranceNumber ?? null,
    pensionNumber: r.pensionNumber ?? null,
    employmentInsuranceNumber: r.employmentInsuranceNumber ?? null,
    workersCompCategory: r.workersCompCategory ?? null,
    // 勤務条件
    scheduledWorkHours: r.scheduledWorkHours != null ? Number(r.scheduledWorkHours) : null,
    contractSignDate: toDate(r.contractSignDate),
    paidLeaveRemaining: r.paidLeaveRemaining != null ? Number(r.paidLeaveRemaining) : 0,
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const rows = await prisma.$queryRaw<any[]>`
      SELECT e.*,
        d.id AS dept_id, d.name AS dept_name,
        c.id AS company_id, c.name AS company_name, c."colorCode" AS company_color,
        s.id AS store_id, s.name AS store_name
      FROM "Employee" e
      LEFT JOIN "Department" d ON e."departmentId" = d.id
      LEFT JOIN "AccountingCompany" c ON d."companyId" = c.id
      LEFT JOIN "Store" s ON e."storeId" = s.id
      WHERE e.id = ${id}
    `
    if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(mapDetailRow(rows[0]))
  } catch (e: any) {
    console.error("[labor/employees GET detail]", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

const updateSchema = z.object({
  // 基本情報
  name: z.string().min(1).optional(),
  nameKana: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  emergencyPhone: z.string().optional().nullable(),
  myNumber: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  // 雇用情報
  employeeNumber: z.string().optional().nullable(),
  hireDate: z.string().optional().nullable(),
  employmentType: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  storeId: z.string().optional().nullable(),
  contractStart: z.string().optional().nullable(),
  contractEnd: z.string().optional().nullable(),
  // 給与・税務
  baseSalary: z.number().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankBranch: z.string().optional().nullable(),
  bankAccountType: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  hasDependents: z.boolean().optional().nullable(),
  dependentCount: z.number().optional().nullable(),
  // 社会保険
  healthInsuranceNumber: z.string().optional().nullable(),
  pensionNumber: z.string().optional().nullable(),
  employmentInsuranceNumber: z.string().optional().nullable(),
  workersCompCategory: z.string().optional().nullable(),
  // 勤務条件
  scheduledWorkHours: z.number().optional().nullable(),
  contractSignDate: z.string().optional().nullable(),
  paidLeaveRemaining: z.number().optional().nullable(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    // 現在値を取得してマージ
    const cur = await prisma.$queryRaw<any[]>`SELECT * FROM "Employee" WHERE id = ${id}`
    if (!cur[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const c = cur[0]
    const d = parsed.data
    const now = new Date().toISOString()

    const toDate = (v: string | null | undefined) => v || null
    const val = <T>(newVal: T | undefined, curVal: T) => newVal !== undefined ? newVal : curVal

    await prisma.$executeRaw`
      UPDATE "Employee" SET
        name                        = ${val(d.name, c.name)},
        "nameKana"                  = ${val(d.nameKana, c.nameKana)},
        gender                      = ${val(d.gender, c.gender)},
        "birthDate"                 = ${toDate(val(d.birthDate, c.birthDate))}::date,
        address                     = ${val(d.address, c.address)},
        "emergencyContact"          = ${val(d.emergencyContact, c.emergencyContact)},
        "emergencyPhone"            = ${val(d.emergencyPhone, c.emergencyPhone)},
        "myNumber"                  = ${val(d.myNumber, c.myNumber)},
        phone                       = ${val(d.phone, c.phone)},
        email                       = ${val(d.email, c.email)},
        note                        = ${val(d.note, c.note)},
        "isActive"                  = ${val(d.isActive, c.isActive)},
        "employeeNumber"            = ${val(d.employeeNumber, c.employeeNumber)},
        "hireDate"                  = ${toDate(val(d.hireDate, c.hireDate))}::date,
        "employmentType"            = ${val(d.employmentType, c.employmentType) ?? 'FULL_TIME'},
        position                    = ${val(d.position, c.position)},
        "departmentId"              = ${val(d.departmentId, c.departmentId)},
        "storeId"                   = ${val(d.storeId, c.storeId)},
        "contractStart"             = ${toDate(val(d.contractStart, c.contractStart))}::date,
        "contractEnd"               = ${toDate(val(d.contractEnd, c.contractEnd))}::date,
        "baseSalary"                = ${val(d.baseSalary, c.baseSalary)},
        "bankName"                  = ${val(d.bankName, c.bankName)},
        "bankBranch"                = ${val(d.bankBranch, c.bankBranch)},
        "bankAccountType"           = ${val(d.bankAccountType, c.bankAccountType)},
        "bankAccountNumber"         = ${val(d.bankAccountNumber, c.bankAccountNumber)},
        "hasDependents"             = ${val(d.hasDependents, c.hasDependents) ?? false},
        "dependentCount"            = ${val(d.dependentCount, c.dependentCount) ?? 0},
        "healthInsuranceNumber"     = ${val(d.healthInsuranceNumber, c.healthInsuranceNumber)},
        "pensionNumber"             = ${val(d.pensionNumber, c.pensionNumber)},
        "employmentInsuranceNumber" = ${val(d.employmentInsuranceNumber, c.employmentInsuranceNumber)},
        "workersCompCategory"       = ${val(d.workersCompCategory, c.workersCompCategory)},
        "scheduledWorkHours"        = ${val(d.scheduledWorkHours, c.scheduledWorkHours)},
        "contractSignDate"          = ${toDate(val(d.contractSignDate, c.contractSignDate))}::date,
        "paidLeaveRemaining"        = ${val(d.paidLeaveRemaining, c.paidLeaveRemaining) ?? 0},
        "updatedAt"                 = ${now}::timestamp
      WHERE id = ${id}
    `

    const updated = await prisma.$queryRaw<any[]>`
      SELECT e.*,
        d.id AS dept_id, d.name AS dept_name,
        c.id AS company_id, c.name AS company_name, c."colorCode" AS company_color,
        s.id AS store_id, s.name AS store_name
      FROM "Employee" e
      LEFT JOIN "Department" d ON e."departmentId" = d.id
      LEFT JOIN "AccountingCompany" c ON d."companyId" = c.id
      LEFT JOIN "Store" s ON e."storeId" = s.id
      WHERE e.id = ${id}
    `
    return NextResponse.json(mapDetailRow(updated[0]))
  } catch (e: any) {
    console.error("[labor/employees PATCH]", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
