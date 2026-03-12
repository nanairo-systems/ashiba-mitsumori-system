/**
 * POST /api/accounting/bank/parse
 * 銀行Excel/CSVファイルを解析して入出金明細JSONを返す
 * DBには保存しない（クライアント側でlocalStorageに保存）
 *
 * 対応フォーマット:
 * - Excel (.xlsx/.xls): シート名から銀行判定
 * - CSV (.csv): ファイル名またはヘッダー行から銀行判定、Shift_JIS自動変換
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
  sheetName: string // 元シート名/ファイル名
  raw: string // 元データ（デバッグ用）
}

// ========================================
// ユーティリティ
// ========================================

function toDateStr(val: unknown): string | null {
  if (!val) return null
  if (typeof val === "number") {
    // YYYYMMDD形式の数値（ゆうちょ等: 20260201）
    if (val >= 20000101 && val <= 20991231) {
      const s = String(val)
      const y = parseInt(s.slice(0, 4))
      const m = parseInt(s.slice(4, 6))
      const d = parseInt(s.slice(6, 8))
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      }
    }
    // Excel serial number（2020〜2030年の範囲に限定: 43831〜47484）
    // 残高や金額の誤検知を防ぐため狭い範囲にする
    if (val >= 43831 && val <= 47484) {
      try {
        const parsed = XLSX.SSF.parse_date_code(val)
        if (parsed && parsed.y >= 2020 && parsed.y <= 2030) {
          return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`
        }
      } catch { /* ignore */ }
    }
    return null
  }
  const s = String(val).trim()
  // YYYYMMDD
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  }
  // 科学的記数法 (2.02602E+14 など) → ゆうちょの入出金明細ID、スキップ
  if (/^\d\.\d+[eE]\+\d+$/.test(s)) {
    return null
  }
  // YYYY/M/D or YYYY-M-D or YYYY.M.D
  const m1 = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/)
  if (m1) {
    return `${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`
  }
  // YYYY年M月D日
  const mJp = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (mJp) {
    return `${mJp[1]}-${mJp[2].padStart(2, "0")}-${mJp[3].padStart(2, "0")}`
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
  if (s === "" || s === "########" || s === "-") return 0
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
    let dateStr: string | null = null
    let withdrawal = 0
    let deposit = 0
    let balance: number | null = null
    let category = ""
    let description = ""

    // Try to find date in columns 0-4
    for (let c = 0; c < Math.min(vals.length, 5); c++) {
      const d = toDateStr(vals[c])
      if (d) {
        if (d.match(/^\d{4}-/)) {
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

    // 口座番号をデータ行から取得（あいち銀行CSVの場合、col0に含まれる）
    if (!accountNumber) {
      const col0 = String(vals[0] ?? "")
      const accMatch = col0.match(/(\d{7})/)
      if (accMatch) accountNumber = accMatch[1]
    }

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

    // UFJ CSV: row type "1" = header, "2" = data, "8"/"9" = summary
    const rowType = String(vals[0] ?? "").trim()

    // ヘッダー行から口座番号を取得
    if (rowType === "1" && vals.length >= 7) {
      accountNumber = String(vals[6] ?? "").trim() || accountNumber
      if (!company) company = String(vals[7] ?? "").trim()
      continue
    }

    // データ行以外はスキップ
    if (rowType === "8" || rowType === "9") continue

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
    if (firstVal.includes("口座番号") || firstVal.includes("記号番号") || firstVal.match(/\d{5}-\d/)) {
      const accStr = firstVal.replace(/[^0-9-]/g, "") || String(vals[1] ?? "").replace(/[^0-9-]/g, "")
      if (accStr) accountNumber = accStr
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

    let dateStr: string | null = null
    let withdrawal = 0
    let deposit = 0
    let balance: number | null = null
    let description = ""

    if (bankName === "PayPay銀行") {
      // 年,月,日,時,分,秒,番号,摘要,支払,預り,残高,メモ
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
      // 住信SBI: 日付, 内容, 出金金額(円), 入金金額(円), 残高(円), メモ
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
// 銀行・会社判定
// ========================================

/** 文字列（シート名 or ファイル名）から銀行を判定 */
function detectBank(name: string): string {
  const n = name.toLowerCase()
  if (n.includes("名古屋")) return "名古屋銀行"
  if (n.includes("あいち") || n.includes("aichi")) return "あいち銀行"
  if (n.includes("ufj") || n.includes("三菱")) return "三菱UFJ銀行"
  if (n.includes("百五")) return "百五銀行"
  if (n.includes("ゆうちょ")) return "ゆうちょ銀行"
  if (n.includes("住信") || n.includes("sbi")) return "住信SBIネット銀行"
  if (n.includes("paypay")) return "PayPay銀行"
  if (n.includes("楽天")) return "楽天銀行"
  if (n.includes("中京")) return "中京銀行"
  return ""
}

/** CSVヘッダー行から銀行を推定 */
function detectBankFromHeaders(headerRow: string): string {
  // あいち銀行: 照会口座,番号,勘定日,...
  if (headerRow.includes("照会口座") || headerRow.includes("勘定日")) return "あいち銀行"
  // UFJ: 最初の行がヘッダ行(1,支店番号,...)
  if (/^1,\d+,/.test(headerRow)) return "三菱UFJ銀行"
  // ゆうちょ: お客さま口座情報
  if (headerRow.includes("お客さま") || headerRow.includes("ゆうちょ")) return "ゆうちょ銀行"
  // SBI: 日付,内容,出金金額(円),入金金額(円)
  if (headerRow.includes("出金金額") && headerRow.includes("入金金額") && !headerRow.includes("照会口座")) return "住信SBIネット銀行"
  // PayPay: 操作日(年),操作日(月)
  if (headerRow.includes("操作日")) return "PayPay銀行"
  // 楽天: 取引日
  if (headerRow.includes("取引日") && headerRow.includes("入出金")) return "楽天銀行"
  return ""
}

function detectCompany(fileName: string): string {
  if (fileName.includes("南施工") || fileName.includes("ミナミ")) return "南施工サービス"
  if (fileName.includes("マンション")) return "マンション管理"
  if (fileName.includes("七色") || fileName.includes("ナナイロ")) return "(株)七色"
  return ""
}

function extractYear(rows: Record<string, unknown>[], contextName: string): number {
  // Try to find year from context name
  const match = contextName.match(/(\d{4})年/)
  if (match) return parseInt(match[1])

  for (const r of rows.slice(0, 5)) {
    const text = Object.values(r).join(" ")
    const ym = text.match(/(\d{4})年/)
    if (ym) return parseInt(ym[1])
    // YYYY.M.D or YYYY/M/D pattern
    const yd = text.match(/(\d{4})[./](\d{1,2})[./](\d{1,2})/)
    if (yd) return parseInt(yd[1])
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
// CSV Shift_JIS → UTF-8 変換
// ========================================

function isCSV(fileName: string): boolean {
  return /\.csv$/i.test(fileName)
}

function decodeShiftJIS(buffer: Buffer): string {
  // TextDecoder で Shift_JIS デコード
  try {
    const decoder = new TextDecoder("shift_jis")
    return decoder.decode(buffer)
  } catch {
    // フォールバック: UTF-8
    return buffer.toString("utf-8")
  }
}

// ========================================
// メインルーティング
// ========================================

function routeToParser(
  objRows: Record<string, unknown>[],
  bankName: string,
  accountNumber: string,
  company: string,
  sheetName: string,
  yearHint: number,
): ParsedTransaction[] {
  if (bankName === "三菱UFJ銀行") {
    return parseUFJ(objRows, accountNumber, company, sheetName)
  } else if (bankName === "ゆうちょ銀行") {
    return parseYucho(objRows, company, sheetName)
  } else if (["住信SBIネット銀行", "PayPay銀行", "楽天銀行"].includes(bankName)) {
    return parseSimple(objRows, bankName, company, sheetName)
  } else {
    // 名古屋銀行, あいち銀行, 百五銀行, 中京銀行 etc
    return parseStandard13Col(objRows, bankName, accountNumber, company, sheetName, yearHint)
  }
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
    const company = detectCompany(file.name)
    const allTransactions: ParsedTransaction[] = []

    if (isCSV(file.name)) {
      // ─── CSV処理 ───
      const csvText = decodeShiftJIS(buffer)
      const sheetName = file.name.replace(/\.csv$/i, "")

      // ファイル名から銀行判定、無ければヘッダーから推定
      let bankName = detectBank(file.name)
      if (!bankName) {
        const firstLine = csvText.split(/\r?\n/)[0] ?? ""
        bankName = detectBankFromHeaders(firstLine)
      }
      if (!bankName) bankName = sheetName // フォールバック

      // XLSX でCSVを読み込み（UTF-8文字列として渡す）
      const wb = XLSX.read(csvText, { type: "string", cellDates: false })
      const ws = wb.Sheets[wb.SheetNames[0]]
      if (!ws) {
        return NextResponse.json({ error: "CSVの読み取りに失敗しました" }, { status: 400 })
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1, defval: "" })
      if (rows.length < 2) {
        return NextResponse.json({ error: "データが見つかりません" }, { status: 400 })
      }

      const yearHint = extractYear(rows as unknown as Record<string, unknown>[], sheetName)
      const accountNumber = extractAccount(rows as unknown as Record<string, unknown>[])

      // ヘッダー行をスキップ - データ行の開始を検出
      let dataStartIdx = 0
      for (let i = 0; i < Math.min(rows.length, 15); i++) {
        const vals = Object.values(rows[i])
        const hasDate = vals.some((v) => toDateStr(v) !== null)
        if (hasDate) {
          dataStartIdx = i
          break
        }
      }

      const dataRows = rows.slice(dataStartIdx)
      const objRows = dataRows.map((row) => {
        const obj: Record<string, unknown> = {}
        const vals = Object.values(row)
        vals.forEach((v, idx) => { obj[String(idx)] = v })
        return obj
      })

      const txns = routeToParser(objRows, bankName, accountNumber, company, sheetName, yearHint)
      allTransactions.push(...txns)

    } else {
      // ─── Excel処理（従来通り） ───
      const wb = XLSX.read(buffer, { type: "buffer", cellDates: false })

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName]
        if (!ws) continue

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1, defval: "" })
        if (rows.length < 2) continue

        // シート名から銀行判定、無ければファイル名から
        let bankName = detectBank(sheetName)
        if (!bankName) bankName = detectBank(file.name)
        if (!bankName) bankName = sheetName

        const yearHint = extractYear(rows as unknown as Record<string, unknown>[], sheetName)
        const accountNumber = extractAccount(rows as unknown as Record<string, unknown>[])

        let dataStartIdx = 0
        for (let i = 0; i < Math.min(rows.length, 15); i++) {
          const vals = Object.values(rows[i])
          const hasDate = vals.some((v) => toDateStr(v) !== null)
          if (hasDate) {
            dataStartIdx = i
            break
          }
        }

        const dataRows = rows.slice(dataStartIdx)
        const objRows = dataRows.map((row) => {
          const obj: Record<string, unknown> = {}
          const vals = Object.values(row)
          vals.forEach((v, idx) => { obj[String(idx)] = v })
          return obj
        })

        const txns = routeToParser(objRows, bankName, accountNumber, company, sheetName, yearHint)
        allTransactions.push(...txns)
      }
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
        sheets: isCSV(file.name) ? 1 : 0, // CSVは1シート扱い
        company,
      },
    })
  } catch (err) {
    console.error("Bank parse error:", err)
    return NextResponse.json({ error: "ファイルの解析に失敗しました" }, { status: 500 })
  }
}
