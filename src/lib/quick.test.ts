import { describe, expect, it } from 'vitest'
import { suggestQuickAdds } from './quick'
import type { Transaction } from './types'

let n = 0
function tx(over: Partial<Transaction>): Transaction {
  n++
  return {
    id: `t${n}`,
    type: 'expense',
    amount: 6500,
    date: '2026-09-20',
    note: 'กาแฟ',
    categoryId: 'exp-food',
    sourceWalletId: 'cash',
    createdAt: n,
    updatedAt: n,
    ...over,
  }
}

describe('suggestQuickAdds', () => {
  const today = '2026-09-25'

  it('รวมรายการที่เหมือนกันและใช้จำนวนที่พบบ่อยสุด', () => {
    const list = suggestQuickAdds(
      [tx({}), tx({ amount: 7000 }), tx({ amount: 6500, date: '2026-09-22' }), tx({ note: 'BTS', categoryId: 'exp-travel', amount: 4200 })],
      { today },
    )
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ note: 'กาแฟ', amount: 6500, count: 3, walletId: 'cash', type: 'expense' })
  })

  it('เรียงตามความถี่ ไม่นับโอน ไม่นับของเก่าเกินช่วง', () => {
    const list = suggestQuickAdds(
      [
        tx({ note: 'BTS', categoryId: 'exp-travel', amount: 4200 }),
        tx({ note: 'BTS', categoryId: 'exp-travel', amount: 4200 }),
        tx({ note: 'BTS', categoryId: 'exp-travel', amount: 4200 }),
        tx({}),
        tx({}),
        tx({ note: 'เก่า', date: '2026-01-01' }),
        tx({ note: 'เก่า', date: '2026-01-02' }),
        tx({ type: 'transfer', note: 'ถอน', sourceWalletId: 'bank', destinationWalletId: 'cash' }),
        tx({ type: 'transfer', note: 'ถอน', sourceWalletId: 'bank', destinationWalletId: 'cash' }),
      ],
      { today },
    )
    expect(list.map((q) => q.note)).toEqual(['BTS', 'กาแฟ'])
  })

  it('รายการเดียวไม่ถือว่าจดบ่อย และรายการที่ไม่มีทั้งชื่อและหมวดถูกข้าม', () => {
    expect(suggestQuickAdds([tx({})], { today })).toEqual([])
    expect(suggestQuickAdds([tx({ note: '', categoryId: undefined }), tx({ note: '', categoryId: undefined })], { today })).toEqual([])
  })

  it('รายรับใช้กระเป๋าปลายทาง', () => {
    const list = suggestQuickAdds(
      [
        tx({ type: 'income', note: 'เงินเดือน', categoryId: 'inc-salary', amount: 3500000, sourceWalletId: undefined, destinationWalletId: 'bank', date: '2026-08-25' }),
        tx({ type: 'income', note: 'เงินเดือน', categoryId: 'inc-salary', amount: 3500000, sourceWalletId: undefined, destinationWalletId: 'bank', date: '2026-07-25' }),
      ],
      { today },
    )
    expect(list[0]).toMatchObject({ type: 'income', walletId: 'bank', amount: 3500000 })
  })
})
