import { describe, expect, it } from 'vitest'
import { daysInMonth, dueDateFor, dueRecurrings, upcomingRecurrings } from './recurring'
import type { Recurring } from './types'

function rec(over: Partial<Recurring>): Recurring {
  return {
    id: over.name ?? 'r',
    name: 'ค่าห้อง',
    type: 'expense',
    amount: 850000,
    day: 1,
    note: '',
    sourceWalletId: 'w',
    active: true,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }
}

describe('dueDateFor', () => {
  it('ใช้วันสุดท้ายเมื่อเดือนสั้นกว่า', () => {
    expect(daysInMonth('2026-02')).toBe(28)
    expect(dueDateFor({ day: 31 }, '2026-02')).toBe('2026-02-28')
    expect(dueDateFor({ day: 31 }, '2026-03')).toBe('2026-03-31')
    expect(dueDateFor({ day: 5 }, '2026-09')).toBe('2026-09-05')
  })
})

describe('dueRecurrings', () => {
  const list = [
    rec({ name: 'ค่าห้อง', day: 1 }),
    rec({ name: 'ค่าเน็ต', day: 20 }),
    rec({ name: 'เงินเดือน', day: 25, type: 'income', sourceWalletId: undefined, destinationWalletId: 'w' }),
    rec({ name: 'ทำแล้ว', day: 1, lastMonth: '2026-09' }),
    rec({ name: 'ปิดอยู่', day: 1, active: false }),
  ]

  it('คืนเฉพาะที่ถึงกำหนดและยังไม่ทำในเดือนนี้ เรียงตามวัน', () => {
    const due = dueRecurrings(list, '2026-09-21')
    expect(due.map((d) => [d.rec.name, d.date])).toEqual([
      ['ค่าห้อง', '2026-09-01'],
      ['ค่าเน็ต', '2026-09-20'],
    ])
  })

  it('เดือนใหม่ถามอีกครั้ง', () => {
    expect(dueRecurrings(list, '2026-10-01').map((d) => d.rec.name)).toEqual(['ค่าห้อง', 'ทำแล้ว'])
  })

  it('upcoming: เดือนนี้ถ้ายังไม่ถึง ไม่งั้นเดือนหน้า', () => {
    const up = upcomingRecurrings(list, '2026-09-21')
    expect(up.map((d) => [d.rec.name, d.date])).toEqual([
      ['เงินเดือน', '2026-09-25'],
      ['ค่าห้อง', '2026-10-01'],
      ['ทำแล้ว', '2026-10-01'],
      ['ค่าเน็ต', '2026-10-20'],
    ])
    expect(upcomingRecurrings([rec({ day: 15 })], '2026-12-20')[0].date).toBe('2027-01-15')
  })
})
