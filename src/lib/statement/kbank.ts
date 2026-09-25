// ตัวอ่าน statement ธนาคารกสิกรไทย (PDF จาก K PLUS)
// รับ "ชิ้นข้อความพร้อมพิกัด" ที่ดึงจาก pdf.js แล้วจัดเป็นรายการ
// แยกจาก pdf.js เพื่อให้เทสต์ได้โดยไม่ต้องมีไฟล์จริง

export interface TextItem {
  str: string
  x: number // ซ้าย
  y: number // ล่าง (pdf.js นับจากล่างขึ้นบน)
  w: number // ความกว้าง
}

export interface StatementTx {
  date: string // YYYY-MM-DD
  time: string // HH:MM
  kind: string // เช่น ชำระเงิน, โอนเงิน, รับโอนเงิน
  channel: string // เช่น K PLUS, Online Direct Debit
  detail: string
  amount: number // สตางค์
  direction: 'in' | 'out'
  balance: number // ยอดคงเหลือหลังรายการ (สตางค์)
  key: string // รหัสประจำรายการ ใช้กันนำเข้าซ้ำ
}

export interface StatementSummary {
  count: number
  total: number // สตางค์
}

export interface Statement {
  bank: 'kbank' | 'truemoney'
  accountNo: string
  period?: { from: string; to: string }
  closingBalance?: number
  expectedOut?: StatementSummary
  expectedIn?: StatementSummary
  transactions: StatementTx[]
  warnings: string[]
}

// ขอบซ้ายของแต่ละคอลัมน์ (หน่วย pt ของ PDF ขนาด A4)
const COL = { time: 90, kind: 118, amount: 200, balance: 290, channel: 332, detail: 400 }
// จำนวนเงินฝากถูกจัดชิดขวาเลยจุดนี้ ส่วนถอนอยู่ก่อน (ใช้เมื่อเทียบยอดคงเหลือไม่ได้)
const DEPOSIT_EDGE = 260
const ROW_TOLERANCE = 2
const HEADER_LABEL = /^(เลขที่บัญชีเงินฝาก|รอบระหว่างวันที่|ยอดยกไป|รวมถอนเงิน|รวมฝากเงิน)/

export function toSatang(s: string): number | null {
  if (!/^-?[\d,]+\.\d\d$/.test(s.trim())) return null
  return Math.round(Number(s.replace(/,/g, '')) * 100)
}

/** "01-05-26" -> "2026-05-01" */
function isoFromDash(s: string): string | null {
  const m = /^(\d\d)-(\d\d)-(\d\d)$/.exec(s)
  return m ? `20${m[3]}-${m[2]}-${m[1]}` : null
}

/** "01/05/2026" -> "2026-05-01" */
function isoFromSlash(s: string): string {
  const [d, m, y] = s.split('/')
  return `${y}-${m}-${d}`
}

/** จัดชิ้นข้อความเป็นแถว (บนลงล่าง ซ้ายไปขวา) */
export function groupRows(items: TextItem[]): TextItem[][] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: TextItem[][] = []
  for (const it of sorted) {
    const last = rows.at(-1)
    if (last && Math.abs(last[0].y - it.y) <= ROW_TOLERANCE) last.push(it)
    else rows.push([it])
  }
  for (const r of rows) r.sort((a, b) => a.x - b.x)
  return rows
}

function cleanDetail(parts: string[]): string {
  return parts
    .join(' ')
    .replace(/\+\s*\+/g, '++')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isKBankStatement(pages: TextItem[][]): boolean {
  return pages.some((p) => p.some((i) => /KBPDF|ออกโดย K PLUS/.test(i.str)))
}

export function parseKBank(pages: TextItem[][]): Statement {
  const out: Statement = { bank: 'kbank', accountNo: '', transactions: [], warnings: [] }
  const keys = new Set<string>()

  for (const page of pages) {
    let prevBalance: number | null = null
    let current: { tx: StatementTx; channel: string[]; detail: string[] } | null = null
    const flush = () => {
      if (!current) return
      current.tx.channel = cleanDetail(current.channel)
      current.tx.detail = cleanDetail(current.detail)
      out.transactions.push(current.tx)
      current = null
    }

    for (const row of groupRows(page)) {
      const first = row[0]
      const text = row.map((i) => i.str).join(' ')

      // ---- หัวกระดาษ (ป้ายอาจอยู่แถวเดียวกับที่อยู่ของเจ้าของบัญชี จึงหาป้ายในแถวแทนดูชิ้นแรก) ----
      const label = row.find((i) => HEADER_LABEL.test(i.str))
      if (label) {
        const after = row.filter((i) => i.x > label.x)
        const number = after.map((i) => toSatang(i.str)).find((n) => n !== null)
        if (!out.accountNo && label.str.startsWith('เลขที่บัญชีเงินฝาก')) {
          out.accountNo = after[0]?.str ?? ''
        } else if (!out.period && label.str.startsWith('รอบระหว่างวันที่')) {
          const m = /(\d\d\/\d\d\/\d{4}) - (\d\d\/\d\d\/\d{4})/.exec(text)
          if (m) out.period = { from: isoFromSlash(m[1]), to: isoFromSlash(m[2]) }
        } else if (out.closingBalance === undefined && label.str.startsWith('ยอดยกไป')) {
          if (number != null) out.closingBalance = number
        } else if (!out.expectedOut && /^รวมถอนเงิน (\d+) รายการ/.test(label.str)) {
          if (number != null) out.expectedOut = { count: Number(RegExp.$1), total: number }
        } else if (!out.expectedIn && /^รวมฝากเงิน (\d+) รายการ/.test(label.str)) {
          if (number != null) out.expectedIn = { count: Number(RegExp.$1), total: number }
        }
        continue
      }

      const date = first.x < COL.time ? isoFromDash(first.str) : null
      if (!date) {
        // แถวต่อเนื่องของรายการก่อนหน้า (ช่องทางหรือรายละเอียดที่ยาวเกินบรรทัด)
        if (current) {
          for (const i of row) {
            if (i.x >= COL.detail) current.detail.push(i.str)
            else if (i.x >= COL.channel) current.channel.push(i.str)
          }
        }
        continue
      }

      flush()
      const cell = (from: number, to: number) => row.filter((i) => i.x >= from && i.x < to)
      const kind = cell(COL.kind, COL.amount).map((i) => i.str).join(' ')
      const balanceItem = cell(COL.balance, COL.channel).find((i) => toSatang(i.str) !== null)
      const balance = balanceItem ? toSatang(balanceItem.str)! : null

      if (kind === 'ยอดยกมา') {
        prevBalance = balance
        continue
      }

      const time = cell(COL.time, COL.kind)[0]?.str ?? ''
      const amountItem = cell(COL.amount, COL.balance).find((i) => toSatang(i.str) !== null)
      if (!amountItem || balance === null) {
        out.warnings.push(`อ่านรายการวันที่ ${first.str} ${time} ไม่ได้ (${kind || 'ไม่ทราบประเภท'})`)
        continue
      }
      const amount = toSatang(amountItem.str)!

      // ทิศทางดูจากยอดคงเหลือที่เปลี่ยนไป ถ้าเทียบไม่ได้ค่อยดูตำแหน่งตัวเลข
      let direction: 'in' | 'out'
      if (prevBalance !== null && balance - prevBalance === amount) direction = 'in'
      else if (prevBalance !== null && prevBalance - balance === amount) direction = 'out'
      else {
        direction = amountItem.x + amountItem.w > DEPOSIT_EDGE ? 'in' : 'out'
        if (prevBalance !== null) out.warnings.push(`ยอดคงเหลือไม่ต่อเนื่องที่รายการวันที่ ${first.str} ${time}`)
      }
      prevBalance = balance

      let key = `kbank:${out.accountNo}:${date}:${time}:${direction}:${amount}:${balance}`
      for (let n = 2; keys.has(key); n++) key = `${key}#${n}`
      keys.add(key)

      current = {
        tx: { date, time, kind, channel: '', detail: '', amount, direction, balance, key },
        channel: cell(COL.channel, COL.detail).map((i) => i.str),
        detail: cell(COL.detail, Infinity).map((i) => i.str),
      }
    }
    flush()
  }

  const outs = out.transactions.filter((t) => t.direction === 'out')
  const ins = out.transactions.filter((t) => t.direction === 'in')
  const sum = (xs: StatementTx[]) => xs.reduce((s, t) => s + t.amount, 0)
  if (out.expectedOut && (outs.length !== out.expectedOut.count || sum(outs) !== out.expectedOut.total)) {
    out.warnings.push(`ถอนเงินอ่านได้ ${outs.length} รายการ แต่ statement ระบุ ${out.expectedOut.count} รายการ`)
  }
  if (out.expectedIn && (ins.length !== out.expectedIn.count || sum(ins) !== out.expectedIn.total)) {
    out.warnings.push(`ฝากเงินอ่านได้ ${ins.length} รายการ แต่ statement ระบุ ${out.expectedIn.count} รายการ`)
  }
  return out
}
