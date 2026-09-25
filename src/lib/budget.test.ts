import { describe, expect, it } from 'vitest'
import { budgetSummary } from './budget'
import type { Category, Transaction } from './types'

const cats: Category[] = [
  { id: 'food', name: 'อาหาร', type: 'expense', icon: '', budget: 600000 },
  { id: 'fun', name: 'บันเทิง', type: 'expense', icon: '', budget: 100000 },
  { id: 'travel', name: 'เดินทาง', type: 'expense', icon: '' }, // ไม่ตั้งงบ
  { id: 'salary', name: 'เงินเดือน', type: 'income', icon: '', budget: 1 }, // รายรับไม่นับ
]
let n = 0
function tx(categoryId: string, amount: number, date: string, type: Transaction['type'] = 'expense'): Transaction {
  n++
  return { id: `t${n}`, type, amount, date, note: '', categoryId, sourceWalletId: 'w', createdAt: n, updatedAt: n }
}

describe('budgetSummary', () => {
  it('รวมรายจ่ายของเดือนนี้ต่อหมวด และคำนวณที่เหลือต่อวัน', () => {
    const s = budgetSummary(
      cats,
      [
        tx('food', 150000, '2026-09-05'),
        tx('food', 150000, '2026-09-20'),
        tx('food', 999900, '2026-08-31'), // เดือนก่อน ไม่นับ
        tx('fun', 120000, '2026-09-10'), // เกินงบ
        tx('travel', 5000, '2026-09-10'),
        tx('food', 100, '2026-09-10', 'income'), // ไม่ใช่รายจ่าย
      ],
      '2026-09-21',
    )
    expect(s.daysLeft).toBe(10) // 21–30 ก.ย.
    expect(s.range).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(s.items.map((i) => i.category.id)).toEqual(['fun', 'food']) // เรียงจากใช้ไปมากสุด (สัดส่วน)

    const food = s.items[1]
    expect(food).toMatchObject({ spent: 300000, remaining: 300000, ratio: 0.5, perDay: 30000 })
    const fun = s.items[0]
    expect(fun).toMatchObject({ spent: 120000, remaining: -20000, ratio: 1.2, perDay: null })

    expect(s.totalBudget).toBe(700000)
    expect(s.totalSpent).toBe(420000)
  })

  it('วันสุดท้ายของเดือนเหลือ 1 วัน และไม่มีหมวดที่ตั้งงบก็คืนรายการว่าง', () => {
    expect(budgetSummary(cats, [], '2026-09-30').daysLeft).toBe(1)
    expect(budgetSummary([cats[2]], [], '2026-09-30').items).toEqual([])
  })
})
