/**
 * [API] 労務システム - 社員一覧・新規作成
 */
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1),
  nameKana: z.string().optional().nullable(),
  employeeNumber: z.string().optional().nullable(),
  hireDate: z.string().optional().nullable(),
  employmentType: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  storeId: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})

function mapListRow(r: any) {
  return {
    id: r.id,
    name: r.name,
    nameKana: r.nameKana ?? null,
    employeeNumber: r.employeeNumber ?? null,
    hireDate: r.hireDate ? String(r.hireDate).split("T")[0] : null,
    employmentType: r.employmentType ?? null,
    isActive: r.isActive,
    position: r.position ?? null,
    departmentId: r.departmentId ?? null,
    department: r.dept_id
      ? { id: r.dept_id, name: r.dept_name, company: { id: r.company_id, name: r.company_name, colorCode: r.company_color } }
      : null,
    store: r.store_id ? { id: r.store_id, name: r.store_name } : null,
  }
}

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT e.*,
        d.id AS dept_id, d.name AS dept_name,
        c.id AS company_id, c.name AS company_name, c."colorCode" AS company_color,
        s.id AS store_id, s.name AS store_name
      FROM "Employee" e
      LEFT JOIN "Department" d ON e."departmentId" = d.id
      LEFT JOIN "AccountingCompany" c ON d."companyId" = c.id
      LEFT JOIN "Store" s ON e."storeId" = s.id
      ORDER BY COALESCE(e."employeeNumber", 'zzz'), e.name ASC
    `
    return NextResponse.json(rows.map(mapListRow))
  } catch (e: any) {
    console.error("[labor/employees GET]", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const d = parsed.data
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const hireDate = d.hireDate ? `${d.hireDate}` : null

    await prisma.$executeRaw`
      INSERT INTO "Employee" (
        id, name, "nameKana", "employeeNumber", "hireDate", "employmentType",
        "departmentId", "storeId", position, phone, email, note,
        "isActive", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${d.name}, ${d.nameKana ?? null}, ${d.employeeNumber ?? null},
        ${hireDate}::date, ${d.employmentType ?? 'FULL_TIME'},
        ${d.departmentId ?? null}, ${d.storeId ?? null},
        ${d.position ?? null}, ${d.phone ?? null}, ${d.email ?? null}, ${d.note ?? null},
        true, ${now}::timestamp, ${now}::timestamp
      )
    `

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
    return NextResponse.json(mapListRow(rows[0]), { status: 201 })
  } catch (e: any) {
    console.error("[labor/employees POST]", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
