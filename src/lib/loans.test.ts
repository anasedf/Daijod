import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from './db'
import { expenseByCategory, summarize } from './ledger'
import { loanBalances, loanCategoryIds } from './loans'
import type { Transaction } from './types'

let n = 0
function tx(categoryId: string, amount: number, note: string, date = '2026-09-10'): Transaction {
  n++
  const type = categoryId.startsWith('inc') ? 'income' : 'expense'
  return { id: `t${n}`, type, amount, date, note, categoryId, sourceWalletId: 'w', destinationWalletId: 'w', createdAt: n, updatedAt: n }
}

describe('loans', () => {
  const txs = [
    tx('exp-lend', 50000, 'สมชาย', '2026-09-01'),
    tx('inc-repay', 20000, 'สมชาย ', '2026-09-05'), // ช่องว่างท้ายชื่อไม่เป็นไร
    tx('exp-lend', 10000, 'สมหญิง'),
    tx('inc-repay', 10000, 'สมหญิง'), // คืนครบ ไม่แสดง
    tx('inc-borrow', 300000, 'แม่', '2026-08-01'),
    tx('exp-payback', 100000, 'แม่', '2026-09-20'),
    tx('exp-food', 8000, 'ข้าว'),
  ]

  it('รวมยอดคงค้างต่อคน', () => {
    const b = loanBalances(txs, DEFAULT_CATEGORIES)
    expect(b.map((x) => [x.name, x.owedToMe, x.iOwe, x.lastDate])).toEqual([
      ['แม่', 0, 200000, '2026-09-20'],
      ['สมชาย', 30000, 0, '2026-09-05'],
    ])
  })

  it('สรุปรายรับ/รายจ่ายไม่นับหมวดเงินยืม', () => {
    const ex = loanCategoryIds(DEFAULT_CATEGORIES)
    expect(ex.size).toBe(4)
    expect(summarize(txs, undefined, ex)).toEqual({ income: 0, expense: 8000, net: -8000 })
    expect(expenseByCategory(txs, undefined, ex)).toEqual([{ categoryId: 'exp-food', amount: 8000 }])
    // ไม่ส่ง exclude ก็ยังนับเหมือนเดิม
    expect(summarize(txs).expense).toBe(168000)
  })
})
