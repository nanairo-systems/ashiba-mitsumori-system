/**
 * POST /api/accounting/bank/parse
 * 銀行Excelファイルを解析して入出金明細JSONを返す
 * DBには保存しない（クライアント側でlocalStorageに保存）
 */
import { NextResponse } from "next/server"
import * as XLSX from "xlsx"

interface ParsedTransaction {
  id: string // ユニーク識別子
  date: string // YYYY-MM-DD
  type: "deposit" | "withdrawal" // 入金 or 出金
  amount: number
  balance: number | null
  description: string // 摘要・取引先名
  category: string | null // 取引区分
  bankName: string // 銀行名
  accountNumber: string // 口座番号
  company: string // 会社名
  sheetName: string // 元シート名
  raw: string // 元データ（デバッグ用）
}

function toDateStr(val: unknown): string | null {
  if (!val) return null
  if (typeof val === "number") {
    // Excel serial number
    try {
      const parsed = XLSX.SSF.parse_date_code(val)
      if (parsed) {
        return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`
      }
    } catch { /* ignore */ }
    return null
  }
  const s = String(val).trim()
  // YYYYMMDD
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  }
  // YYYY/M/D or YYYY/MM/DD
  const m1 = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (m1) {
    return `${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`
  }
  // M/D (year from context)
  const m2 = s.match(/^(\d{1,2})[/-](\d{1,2})$/)
  if (m2) {
    const now = new Date()
    const year = now.getFullYear()
    return `${year}-${m2[1].padStart(2, "0")}-${m2[2].padStart(2, "0")}`
  }
  return null
}

function toNum(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0
  if (typeof val === "number") return val
  const s = String(val).replace(/[,，\s]/g, "").replace(/^[¥￥]/, "")
  if (s === "" || s === "########") return 0
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function generateId(bank: string, date: string, amount: number, idx: number): string {
  return `${bank}_${date}_${amount}_${idx}`
}

// ========================================
// 各銀行パーサー
// ========================================

/** 名古屋銀行・あいち銀行・百五銀行（共通13列フォーマット） */
function parseStandard13Col(
  rows: Record<string, unknown>[],
  bankName: string,
  accountNumber: string,
  company: string,
  sheetName: string,
  yearHint: number,
): ParsedTransaction[] {
  const txns: ParsedTransaction[] = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const vals = Object.values(r)
    // 勘定日を探す（通常3列目あたり）
    let dateStr: string | null = null
    let withdrawal = 0
    let deposit = 0
    let balance: number | null = null
    let category = ""
    let description = ""

    // Try to find date in columns 2-3 (0-indexed)
    for (let c = 0; c < Math.min(vals.length, 5); c++) {
      const d = toDateStr(vals[c])
      if (d) {
        // M/D only: add year from context
        if (d.startsWith(`${new Date().getFullYear()}-`) || d.match(/^\d{4}-/)) {
          dateStr = d
          break
        }
      }
      // Check for M/D format like "2/3"
      const s = String(vals[c] ?? "").trim()
      const md = s.match(/^(\d{1,2})\/(\d{1,2})$/)
      if (md) {
        dateStr = `${yearHint}-${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`
        break
      }
    }

    if (!dateStr) continue

    // Find amounts - look for 出金 and 入金 columns
    // Standard format: col4=出金, col5=入金, col7=残高, col8=取引区分, col12=摘要
    if (vals.length >= 8) {
      withdrawal = toNum(vals[4])
      deposit = toNum(vals[5])
      balance = vals[7] !== undefined ? toNum(vals[7]) : null
      category = String(vals[8] ?? "")
      // 摘要 is usually the last meaningful column
      const descParts: string[] = []
      for (let c = 9; c < vals.length; c++) {
        const v = String(vals[c] ?? "").trim()
        if (v && v !== "0" && v !== "########") descParts.push(v)
      }
      description = descParts.join(" ").trim()
    }

    if (withdrawal === 0 && deposit === 0) continue

    txns.push({
      id: generateId(bankName, dateStr, deposit || -withdrawal, i),
      date: dateStr,
      type: deposit > 0 ? "deposit" : "withdrawal",
      amount: deposit > 0 ? deposit : withdrawal,
      balance,
      description: description || category,
      category: category || null,
      bankName,
      accountNumber,
      company,
      sheetName,
      raw: JSON.stringify(vals),
    })
  }
  return txns
}

/** UFJ銀行 */
function parseUFJ(
  rows: Record<string, unknown>[],
  accountNumber: string,
  company: string,
  sheetName: string,
): ParsedTransaction[] {
  const txns: ParsedTransaction[] = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const vals = Object.values(r)
    if (vals.length < 6) continue

    const dateStr = toDateStr(vals[1])
    if (!dateStr) continue

    const name = String(vals[3] ?? "").trim()
    const debit = toNum(vals[4])
    const credit = toNum(vals[5])
    const balance = vals.length > 6 ? toNum(vals[6]) : null
    const txType = String(vals[2] ?? "").trim()

    if (debit === 0 && credit === 0) continue

    txns.push({
      id: generateId("三菱UFJ銀行", dateStr, credit || -debit, i),
      date: dateStr,
      type: credit > 0 ? "deposit" : "withdrawal",
      amount: credit > 0 ? credit : debit,
      balance,
      description: name,
      category: txType || null,
      bankName: "三菱UFJ銀行",
      accountNumber,
      company,
      sheetName,
      raw: JSON.stringify(vals),
    })
  }
  return txns
}

/** ゆうちょ銀行 */
function parseYucho(
  rows: Record<string, unknown>[],
  company: string,
  sheetName: string,
): ParsedTransaction[] {
  const txns: ParsedTransaction[] = []
  let accountNumber = ""

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const vals = Object.values(r)

    // Look for account number in metadata rows
    const firstVal = String(vals[0] ?? "")
    if (firstVal.includes("記号番号") || firstVal.match(/\d{5}-\d/)) {
      accountNumber = firstVal.replace(/[^0-9-]/g, "") || String(vals[1] ?? "")
    }

    // Data rows have YYYYMMDD date
    const dateStr = toDateStr(vals[0])
    if (!dateStr) continue

    const deposit = toNum(vals[3]) // 受入金額
    const withdrawal = toNum(vals[5]) // 払出金額
    const desc1 = String(vals[6] ?? "").trim()
    const desc2 = String(vals[7] ?? "").trim()
    const balance = vals[8] !== undefined ? toNum(vals[8]) : null

    if (deposit === 0 && withdrawal === 0) continue

    txns.push({
      id: generateId("ゆうちょ銀行", dateStr, deposit || -withdrawal, i),
      date: dateStr,
      type: deposit > 0 ? "deposit" : "withdrawal",
      amount: deposit > 0 ? deposit : withdrawal,
      balance,
      description: [desc1, desc2].filter(Boolean).join(" "),
      category: null,
      bankName: "ゆうちょ銀行",
      accountNumber,
      company,
      sheetName,
      raw: JSON.stringify(vals),
    })
  }
  return txns
}

/** 住信SBI・PayPay・楽天（シンプル形式） */
function parseSimple(
  rows: Record<string, unknown>[],
  bankName: string,
  company: string,
  sheetName: string,
): ParsedTransaction[] {
  const txns: ParsedTransaction[] = []
  let accountNumber = ""

  // Try to get account number from sheet title
  const titleMatch = sheetName.match(/\d{5,}/)
  if (titleMatch) accountNumber = titleMatch[0]

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const vals = Object.values(r)
    if (vals.length < 4) continue

    // 住信SBI: 日付, 内容, 出金, 入金, 残高, メモ
    // PayPay: 年,月,日,時,分,秒,番号,摘要,支払,預り,残高,メモ
    // 楽天: 取引日, 入出金, 残高, 内容

    let dateStr: string | null = null
    let withdrawal = 0
    let deposit = 0
    let balance: number | null = null
    let description = ""

    if (bankName === "PayPay銀行") {
      // 6 date columns then data
      const year = toNum(vals[0])
      const month = toNum(vals[1])
      const day = toNum(vals[2])
      if (year > 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      }
      description = String(vals[7] ?? "").trim()
      withdrawal = toNum(vals[8])
      deposit = toNum(vals[9])
      balance = toNum(vals[10])
    } else if (bankName === "楽天銀行") {
      dateStr = toDateStr(vals[0])
      const amount = toNum(vals[1])
      if (amount > 0) deposit = amount
      else withdrawal = Math.abs(amount)
      balance = toNum(vals[2])
      description = String(vals[3] ?? "").trim()
    } else {
      // 住信SBI
      dateStr = toDateStr(vals[0])
      description = String(vals[1] ?? "").trim()
      withdrawal = toNum(vals[2])
      deposit = toNum(vals[3])
      balance = vals.length > 4 ? toNum(vals[4]) : null
    }

    if (!dateStr || (withdrawal === 0 && deposit === 0)) continue

    txns.push({
      id: generateId(bankName, dateStr, deposit || -withdrawal, i),
      date: dateStr,
      type: deposit > 0 ? "deposit" : "withdrawal",
      amount: deposit > 0 ? deposit : withdrawal,
      balance,
      description,
      category: null,
      bankName,
      accountNumber,
      company,
      sheetName,
      raw: JSON.stringify(vals),
    })
  }
  return txns
}

// ========================================
// シート名から銀行を判定
// ========================================
function detectBank(sheetName: string): string {
  const n = sheetName.toLowerCase()
  if (n.includes("名古屋")) return "名古屋銀行"
  if (n.includes("あいち") || n.includes("aichi")) return "あいち銀行"
  if (n.includes("ufj") || n.includes("三菱")) return "三菱UFJ銀行"
  if (n.includes("百五")) return "百五銀行"
  if (n.includes("ゆうちょ")) return "ゆうちょ銀行"
  if (n.includes("住信") || n.includes("sbi")) return "住信SBIネット銀行"
  if (n.includes("paypay")) return "PayPay銀行"
  if (n.includes("楽天")) return "楽天銀行"
  if (n.includes("中京")) return "中京銀行"
  return sheetName
}

function detectCompany(fileName: string): string {
  if (fileName.includes("南施工") || fileName.includes("ミナミ")) return "南施工サービス"
  if (fileName.includes("七色") || fileName.includes("ナナイロ")) return "(株)七色"
  return ""
}

function extractYear(rows: Record<string, unknown>[], sheetName: string): number {
  // Try to find year from title row or sheet name
  const match = sheetName.match(/(\d{4})年/)
  if (match) return parseInt(match[1])

  for (const r of rows.slice(0, 3)) {
    const text = Object.values(r).join(" ")
    const ym = text.match(/(\d{4})年/)
    if (ym) return parseInt(ym[1])
  }
  return new Date().getFullYear()
}

function extractAccount(rows: Record<string, unknown>[]): string {
  for (const r of rows.slice(0, 5)) {
    const text = Object.values(r).join(" ")
    const m = text.match(/(\d{5,})/)
    if (m) return m[1]
  }
  return ""
}

// ========================================
// メイン
// ========================================
export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "ファイルが必要です" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: false })

    const company = detectCompany(file.name)
    const allTransactions: ParsedTransaction[] = []

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName]
      if (!ws) continue

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1, defval: "" })
      if (rows.length < 2) continue

      const bankName = detectBank(sheetName)
      const yearHint = extractYear(rows as unknown as Record<string, unknown>[], sheetName)
      const accountNumber = extractAccount(rows as unknown as Record<string, unknown>[])

      // Skip header/title rows - find where data starts
      let dataStartIdx = 0
      for (let i = 0; i < Math.min(rows.length, 15); i++) {
        const vals = Object.values(rows[i])
        const hasDate = vals.some((v) => {
          const d = toDateStr(v)
          return d !== null
        })
        if (hasDate) {
          dataStartIdx = i
          break
        }
      }

      const dataRows = rows.slice(dataStartIdx)
      // Convert array rows to object format
      const objRows = dataRows.map((row) => {
        const obj: Record<string, unknown> = {}
        const vals = Object.values(row)
        vals.forEach((v, idx) => { obj[String(idx)] = v })
        return obj
      })

      let txns: ParsedTransaction[] = []

      if (bankName === "三菱UFJ銀行") {
        txns = parseUFJ(objRows, accountNumber, company, sheetName)
      } else if (bankName === "ゆうちょ銀行") {
        txns = parseYucho(objRows, company, sheetName)
      } else if (["住信SBIネット銀行", "PayPay銀行", "楽天銀行"].includes(bankName)) {
        txns = parseSimple(objRows, bankName, company, sheetName)
      } else {
        // 名古屋銀行, あいち銀行, 百五銀行, 中京銀行 etc
        txns = parseStandard13Col(objRows, bankName, accountNumber, company, sheetName, yearHint)
      }

      allTransactions.push(...txns)
    }

    // Sort by date desc
    allTransactions.sort((a, b) => b.date.localeCompare(a.date))

    return NextResponse.json({
      transactions: allTransactions,
      summary: {
        total: allTransactions.length,
        deposits: allTransactions.filter((t) => t.type === "deposit").length,
        withdrawals: allTransactions.filter((t) => t.type === "withdrawal").length,
        totalDeposit: allTransactions.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0),
        totalWithdrawal: allTransactions.filter((t) => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0),
        sheets: wb.SheetNames.length,
        company,
      },
    })
  } catch (err) {
    console.error("Bank parse error:", err)
    return NextResponse.json({ error: "ファイルの解析に失敗しました" }, { status: 500 })
  }
}
