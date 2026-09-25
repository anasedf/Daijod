import { describe, expect, it } from 'vitest'
import { groupRows, isKBankStatement, parseKBank, toSatang, type TextItem } from './kbank'

// สร้างแถวตามตำแหน่งคอลัมน์จริงของ statement กสิกร
type Cells = {
  date?: string
  time?: string
  kind?: string
  out?: string
  in?: string
  balance?: string
  channel?: string
  detail?: string
}
function row(y: number, c: Cells): TextItem[] {
  const items: TextItem[] = []
  if (c.date) items.push({ str: c.date, x: 67.9, y, w: 24 })
  if (c.time) items.push({ str: c.time, x: 101.2, y, w: 14 })
  if (c.kind) items.push({ str: c.kind, x: 123, y, w: 20 })
  if (c.out) items.push({ str: c.out, x: 252 - c.out.length * 3, y, w: c.out.length * 3 })
  if (c.in) items.push({ str: c.in, x: 267 - c.in.length * 3, y, w: c.in.length * 3 })
  if (c.balance) items.push({ str: c.balance, x: 329 - c.balance.length * 3, y, w: c.balance.length * 3 })
  if (c.channel) items.push({ str: c.channel, x: 333, y, w: 30 })
  if (c.detail) items.push({ str: c.detail, x: 404, y, w: 100 })
  return items
}
function header(): TextItem[] {
  const h = (y: number, label: string, value: string, vx = 393) => [
    { str: label, x: 345, y, w: 40 },
    { str: value, x: vx, y, w: 40 },
  ]
  return [
    ...h(750, 'เลขที่บัญชีเงินฝาก', '123-4-56789-0'),
    ...h(737, 'รอบระหว่างวันที่', '01/05/2026 - 31/05/2026'),
    ...h(711, 'ยอดยกไป', '1,100.00', 507),
    ...h(698, 'รวมถอนเงิน 2 รายการ', '400.00', 503),
    ...h(685, 'รวมฝากเงิน 1 รายการ', '500.00', 503),
    { str: 'KBPDF (FM702-CA_SA-V.1)', x: 66, y: 30, w: 80 },
  ]
}

const page1: TextItem[] = [
  ...header(),
  ...row(641, { date: '01-05-26', kind: 'ยอดยกมา', balance: '1,000.00' }),
  ...row(629, { date: '01-05-26', time: '07:07', kind: 'ชำระเงิน', out: '100.00', balance: '900.00', channel: 'K PLUS', detail: 'เพื่อชำระ Ref X5921 ร้านกาแฟ (WHITE' }),
  ...row(618, { detail: 'BALANCE)' }),
  ...row(606, { date: '02-05-26', time: '12:51', kind: 'รับโอนเงิน', in: '500.00', balance: '1,400.00', channel: 'ตู้เติมเงิน / โมบาย แอปพลิ', detail: 'จาก X2131 บจก. ตัวอย่าง (++' }),
  ...row(595, { channel: 'เคชัน /เงินโอน' }),
  ...row(583, { date: '03-05-26', time: '09:00', kind: 'โอนเงิน', out: '300.00', balance: '1,100.00', channel: 'K PLUS', detail: 'โอนไป พร้อมเพย์ X1111 นาย ก++' }),
]

describe('toSatang', () => {
  it('แปลงตัวเลขมีจุลภาค', () => {
    expect(toSatang('1,250.50')).toBe(125050)
    expect(toSatang('15.00')).toBe(1500)
    expect(toSatang('K PLUS')).toBeNull()
    expect(toSatang('07:07')).toBeNull()
  })
})

describe('groupRows', () => {
  it('จัดชิ้นข้อความเป็นแถวจากบนลงล่าง ซ้ายไปขวา', () => {
    const rows = groupRows([
      { str: 'b', x: 200, y: 100, w: 1 },
      { str: 'c', x: 50, y: 80, w: 1 },
      { str: 'a', x: 100, y: 101, w: 1 },
    ])
    expect(rows.map((r) => r.map((i) => i.str).join(''))).toEqual(['ab', 'c'])
  })
})

describe('parseKBank', () => {
  const st = parseKBank([page1])

  it('รู้จักไฟล์กสิกร', () => {
    expect(isKBankStatement([page1])).toBe(true)
    expect(isKBankStatement([[{ str: 'hello', x: 0, y: 0, w: 1 }]])).toBe(false)
  })

  it('อ่านหัวกระดาษ', () => {
    expect(st.accountNo).toBe('123-4-56789-0')
    expect(st.period).toEqual({ from: '2026-05-01', to: '2026-05-31' })
    expect(st.closingBalance).toBe(110000)
    expect(st.expectedOut).toEqual({ count: 2, total: 40000 })
    expect(st.expectedIn).toEqual({ count: 1, total: 50000 })
  })

  it('อ่านรายการ ทิศทาง และรวมบรรทัดต่อเนื่อง', () => {
    expect(st.transactions).toHaveLength(3)
    const [a, b, c] = st.transactions
    expect(a).toMatchObject({ date: '2026-05-01', time: '07:07', kind: 'ชำระเงิน', amount: 10000, direction: 'out', balance: 90000 })
    expect(a.detail).toBe('เพื่อชำระ Ref X5921 ร้านกาแฟ (WHITE BALANCE)')
    expect(b).toMatchObject({ direction: 'in', amount: 50000, channel: 'ตู้เติมเงิน / โมบาย แอปพลิ เคชัน /เงินโอน' })
    expect(c).toMatchObject({ direction: 'out', amount: 30000, detail: 'โอนไป พร้อมเพย์ X1111 นาย ก++' })
    expect(st.warnings).toEqual([])
  })

  it('รหัสรายการไม่ซ้ำกันและคงที่', () => {
    const keys = st.transactions.map((t) => t.key)
    expect(new Set(keys).size).toBe(3)
    expect(parseKBank([page1]).transactions.map((t) => t.key)).toEqual(keys)
  })

  it('เตือนเมื่อจำนวนไม่ตรงกับสรุปในหัวกระดาษ', () => {
    const short = page1.filter((i) => !(i.y >= 580 && i.y <= 586))
    const s = parseKBank([short])
    expect(s.transactions).toHaveLength(2)
    expect(s.warnings.join(' ')).toContain('ถอนเงินอ่านได้ 1 รายการ')
  })

  it('ใช้ตำแหน่งตัวเลขเมื่อไม่มียอดยกมาให้เทียบ', () => {
    const noOpening = page1.filter((i) => i.y !== 641)
    const s = parseKBank([noOpening])
    expect(s.transactions.map((t) => t.direction)).toEqual(['out', 'in', 'out'])
  })

  it('ยอดยกมาของแต่ละหน้าใช้แยกกัน', () => {
    const page2 = [
      ...row(641, { date: '03-05-26', kind: 'ยอดยกมา', balance: '1,100.00' }),
      ...row(629, { date: '04-05-26', time: '10:00', kind: 'หักบัญชี', out: '50.00', balance: '1,050.00', channel: 'Online Direct Debit', detail: 'โอนไป X2131 บจก. ตัวอย่าง (++ Ref X9000' }),
    ]
    const s = parseKBank([page1, page2])
    expect(s.transactions).toHaveLength(4)
    expect(s.transactions[3]).toMatchObject({ direction: 'out', amount: 5000 })
  })
})
