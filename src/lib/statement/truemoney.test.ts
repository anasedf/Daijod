import { describe, expect, it } from 'vitest'
import type { TextItem } from './kbank'
import { describeTrueMoneyDetail, isTrueMoneyStatement, parseTrueMoney } from './truemoney'

type Cells = { dt?: string; kind?: string; amount?: string; detail?: string; before?: string; after?: string }
function row(y: number, c: Cells): TextItem[] {
  const items: TextItem[] = []
  if (c.dt) items.push({ str: c.dt, x: 20, y, w: 94 })
  if (c.kind) items.push({ str: c.kind, x: 130, y, w: 30 })
  if (c.amount) items.push({ str: c.amount, x: 292 - c.amount.length * 4.3, y, w: c.amount.length * 4.3 })
  if (c.detail) items.push({ str: c.detail, x: 300, y, w: 80 })
  if (c.before) items.push({ str: c.before, x: 515 - c.before.length * 4.3, y, w: c.before.length * 4.3 })
  if (c.after) items.push({ str: c.after, x: 575 - c.after.length * 4.3, y, w: c.after.length * 4.3 })
  return items
}
const page: TextItem[] = [
  { str: 'ใบแสดงรายการ', x: 435, y: 804, w: 60 },
  { str: 'Statement of Account', x: 420, y: 792, w: 95 },
  { str: 'เลขที่บัญชี', x: 360, y: 766, w: 40 },
  { str: '0812345678', x: 460, y: 766, w: 50 },
  { str: 'รอบรายการ', x: 360, y: 726, w: 40 },
  { str: '01/09/2026 - 25/09/2026', x: 460, y: 726, w: 110 },
  { str: 'ประเภท', x: 135, y: 668, w: 30 },
  { str: 'เงินออก/ เงินเข้า', x: 198, y: 668, w: 68 },
  ...row(634, { dt: '02/09/2026 10:18:33', kind: 'เงินเข้า', amount: '1,500.00', detail: 'debit_kbank', before: '78.54', after: '1,578.54' }),
  ...row(609, { dt: '02/09/2026 10:18:43', kind: 'เงินออก', amount: '-1,102.89', detail: 'prepaidcard_master', before: '1,578.54', after: '475.65' }),
  ...row(509, { dt: '07/09/2026 07:53:38', kind: 'เงินออก', amount: '-99.00', detail: 'im_onlinepayment_010000000000', before: '475.65', after: '376.65' }),
  ...row(497, { detail: '278672970' }),
]

describe('parseTrueMoney', () => {
  const st = parseTrueMoney([page])

  it('รู้จักไฟล์', () => {
    expect(isTrueMoneyStatement([page])).toBe(true)
    expect(isTrueMoneyStatement([[{ str: 'KBPDF', x: 0, y: 0, w: 1 }]])).toBe(false)
  })

  it('อ่านหัวและรายการ', () => {
    expect(st.accountNo).toBe('0812345678')
    expect(st.period).toEqual({ from: '2026-09-01', to: '2026-09-25' })
    expect(st.transactions).toHaveLength(3)
    expect(st.transactions[0]).toMatchObject({ date: '2026-09-02', time: '10:18', direction: 'in', amount: 150000, balance: 157854, detail: 'debit_kbank', channel: 'TrueMoney' })
    expect(st.transactions[1]).toMatchObject({ direction: 'out', amount: 110289, balance: 47565 })
    expect(st.transactions[2].detail).toBe('im_onlinepayment_010000000000 278672970')
    expect(st.closingBalance).toBe(37665)
    expect(st.warnings).toEqual([])
    expect(new Set(st.transactions.map((t) => t.key)).size).toBe(3)
  })

  it('เตือนเมื่อยอดไม่ต่อเนื่อง', () => {
    const bad = [...page.filter((i) => i.y !== 609), ...row(609, { dt: '02/09/2026 10:18:43', kind: 'เงินออก', amount: '-1,102.89', detail: 'x', before: '1,578.54', after: '400.00' })]
    expect(parseTrueMoney([bad]).warnings.join(' ')).toContain('ไม่ต่อเนื่อง')
  })
})

describe('describeTrueMoneyDetail', () => {
  it('แปลงรหัสเป็นข้อความ', () => {
    expect(describeTrueMoneyDetail('debit_kbank')).toBe('เติมเงินจาก กสิกร KBANK')
    expect(describeTrueMoneyDetail('debit_xyz')).toBe('เติมเงินจาก XYZ')
    expect(describeTrueMoneyDetail('prepaidcard_master')).toBe('จ่ายผ่านบัตร TrueMoney Mastercard')
    expect(describeTrueMoneyDetail('im_onlinepayment_01 278')).toBe('ชำระออนไลน์')
    expect(describeTrueMoneyDetail('something else')).toBeNull()
  })
})
