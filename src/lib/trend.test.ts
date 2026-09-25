import { describe, expect, it } from 'vitest'
import { compareMonths, monthLabel, monthlyTotals } from './trend'
import type { Category, Transaction } from './types'

let n = 0
function tx(type: Transaction['type'], amount: number, date: string, categoryId?: string): Transaction {
  n++
  return { id: `t${n}`, type, amount, date, note: '', categoryId, sourceWalletId: 'w', destinationWalletId: 'x', createdAt: n, updatedAt: n }
}
const cats = new Map<string, Category>([
  ['food', { id: 'food', name: 'อาหาร', type: 'expense', icon: '' }],
  ['home', { id: 'home', name: 'บ้าน', type: 'expense', icon: '' }],
  ['lend', { id: 'lend', name: 'ให้ยืม', type: 'expense', icon: '' }],
])
const txs = [
  tx('expense', 100, '2026-09-10', 'food'),
  tx('expense', 900, '2026-09-11', 'home'),
  tx('income', 5000, '2026-09-01'),
  tx('expense', 300, '2026-08-10', 'food'),
  tx('expense', 200, '2026-08-12', 'home'),
  tx('transfer', 999, '2026-09-05'),
  tx('expense', 50, '2026-03-01', 'food'), // เกิน 6 เดือน
  tx('expense', 700, '2026-09-20', 'lend'),
]

describe('monthlyTotals', () => {
  it('คืน 6 เดือนเรียงเก่าไปใหม่ ไม่นับโอน และตัดหมวดที่ระบุ', () => {
    const m = monthlyTotals(txs, '2026-09-25', 6, new Set(['lend']))
    expect(m.map((x) => x.month)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
    expect(m[5]).toEqual({ month: '2026-09', income: 5000, expense: 1000, net: 4000 })
    expect(m[4]).toEqual({ month: '2026-08', income: 0, expense: 500, net: -500 })
  })

  it('ข้ามปีได้', () => {
    expect(monthlyTotals([], '2026-01-15', 3).map((x) => x.month)).toEqual(['2025-11', '2025-12', '2026-01'])
  })
})

describe('compareMonths', () => {
  it('บอกส่วนต่างรายจ่ายและหมวดที่เพิ่ม/ลดมากสุด', () => {
    const c = compareMonths(txs, cats, '2026-09-25', new Set(['lend']))
    expect(c.expenseDiff).toBe(500)
    expect(c.expensePct).toBe(1)
    expect(c.biggestIncrease?.category?.name).toBe('บ้าน')
    expect(c.biggestIncrease?.diff).toBe(700)
    expect(c.biggestDecrease?.category?.name).toBe('อาหาร')
    expect(c.biggestDecrease?.diff).toBe(-200)
  })

  it('เดือนก่อนเป็นศูนย์ให้ pct เป็น null', () => {
    expect(compareMonths([tx('expense', 10, '2026-09-01')], cats, '2026-09-25').expensePct).toBeNull()
  })
})

describe('monthLabel', () => {
  it('ชื่อเดือนไทย', () => {
    expect(monthLabel('2026-09')).toBe('ก.ย.')
    expect(monthLabel('2026-01', true)).toBe('ม.ค. 69')
  })
})
