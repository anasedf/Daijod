// ตัวอ่าน statement TrueMoney Wallet (PDF "ใบแสดงรายการ / Statement of Account")
// คอลัมน์: วันที่ เวลา | ประเภท | เงินออก/เงินเข้า (ติดลบ = ออก) | รายละเอียด | ยอดก่อนหน้า | ยอดคงเหลือ
import { groupRows, toSatang, type Statement, type StatementTx, type TextItem } from './kbank'

const COL = { type: 120, amount: 180, detail: 295, before: 470, after: 520 }

export function isTrueMoneyStatement(pages: TextItem[][]): boolean {
  const text = pages[0]?.map((i) => i.str).join(' ') ?? ''
  return /Statement of Account/.test(text) && /เงินออก\/\s*เงินเข้า/.test(text)
}

/** "02/09/2026 10:18:33" -> ["2026-09-02", "10:18"] */
function splitDateTime(s: string): [string, string] | null {
  const m = /^(\d\d)\/(\d\d)\/(\d{4}) (\d\d):(\d\d)/.exec(s)
  return m ? [`${m[3]}-${m[2]}-${m[1]}`, `${m[4]}:${m[5]}`] : null
}

export function parseTrueMoney(pages: TextItem[][]): Statement {
  const out: Statement = { bank: 'truemoney', accountNo: '', transactions: [], warnings: [] }
  const keys = new Set<string>()
  let current: { tx: StatementTx; detail: string[] } | null = null
  const flush = () => {
    if (!current) return
    current.tx.detail = current.detail.join(' ').replace(/\s+/g, ' ').trim()
    out.transactions.push(current.tx)
    current = null
  }

  for (const page of pages) {
    for (const row of groupRows(page)) {
      const first = row[0]
      const text = row.map((i) => i.str).join(' ')

      // ป้ายหัวกระดาษอาจอยู่แถวเดียวกับป้ายอื่น (เช่น ชื่อบัญชี กับ เลขที่บัญชี) จึงหาป้ายในแถว
      const acctLabel = !out.accountNo && row.find((i) => i.str === 'เลขที่บัญชี')
      if (acctLabel) {
        out.accountNo = row.find((i) => i.x > acctLabel.x && /^\d{6,}$/.test(i.str))?.str ?? ''
        continue
      }
      if (!out.period && row.some((i) => i.str === 'รอบรายการ')) {
        const m = /(\d\d)\/(\d\d)\/(\d{4}) - (\d\d)\/(\d\d)\/(\d{4})/.exec(text)
        if (m) out.period = { from: `${m[3]}-${m[2]}-${m[1]}`, to: `${m[6]}-${m[5]}-${m[4]}` }
        continue
      }

      const dt = first.x < COL.type ? splitDateTime(first.str) : null
      if (!dt) {
        // บรรทัดต่อของรายละเอียด (เช่น เลขอ้างอิงที่ยาวเกินคอลัมน์)
        if (current && first.x >= COL.detail && first.x < COL.before) current.detail.push(text)
        continue
      }

      flush()
      const cell = (from: number, to: number) => row.filter((i) => i.x >= from && i.x < to)
      const kind = cell(COL.type, COL.amount).map((i) => i.str).join(' ')
      const amountStr = cell(COL.amount, COL.detail)[0]?.str ?? ''
      const amountAbs = toSatang(amountStr.replace(/^-/, ''))
      const before = toSatang(cell(COL.before, COL.after)[0]?.str ?? '')
      const after = toSatang(cell(COL.after, Infinity)[0]?.str ?? '')
      if (amountAbs === null || after === null) {
        out.warnings.push(`อ่านรายการวันที่ ${first.str} ไม่ได้ (${kind || 'ไม่ทราบประเภท'})`)
        continue
      }

      let direction: 'in' | 'out' = amountStr.startsWith('-') || kind === 'เงินออก' ? 'out' : 'in'
      if (before !== null) {
        if (after - before === amountAbs) direction = 'in'
        else if (before - after === amountAbs) direction = 'out'
        else out.warnings.push(`ยอดคงเหลือไม่ต่อเนื่องที่รายการวันที่ ${first.str}`)
      }

      let key = `truemoney:${out.accountNo}:${dt[0]}:${dt[1]}:${direction}:${amountAbs}:${after}`
      for (let n = 2; keys.has(key); n++) key = `${key}#${n}`
      keys.add(key)

      current = {
        tx: { date: dt[0], time: dt[1], kind, channel: 'TrueMoney', detail: '', amount: amountAbs, direction, balance: after, key },
        detail: cell(COL.detail, COL.before).map((i) => i.str),
      }
    }
    flush()
  }

  out.closingBalance = out.transactions.at(-1)?.balance
  return out
}

/** แปลงรหัสรายละเอียดของ TrueMoney เป็นข้อความอ่านรู้เรื่อง (ใส่ทั้งชื่อไทยและรหัสธนาคารเพื่อให้จับคู่กระเป๋าได้) */
export function describeTrueMoneyDetail(detail: string): string | null {
  const BANKS: Record<string, string> = {
    kbank: 'กสิกร KBANK',
    scb: 'ไทยพาณิชย์ SCB',
    ktb: 'กรุงไทย KTB',
    bbl: 'กรุงเทพ BBL',
    bay: 'กรุงศรี BAY',
    ttb: 'ทีทีบี TTB',
    tmb: 'ทีเอ็มบี TMB',
    gsb: 'ออมสิน GSB',
    uob: 'UOB',
    cimb: 'CIMB',
  }
  const d = detail.toLowerCase()
  const bank = /^(?:debit|topup|bank)_([a-z]+)/.exec(d)?.[1]
  if (bank) return `เติมเงินจาก ${BANKS[bank] ?? bank.toUpperCase()}`
  if (d.startsWith('prepaidcard_master')) return 'จ่ายผ่านบัตร TrueMoney Mastercard'
  if (d.startsWith('im_onlinepayment')) return 'ชำระออนไลน์'
  if (d.startsWith('transfer_')) return 'โอนเงิน'
  if (d.startsWith('withdraw')) return 'ถอนเงิน'
  return null
}
