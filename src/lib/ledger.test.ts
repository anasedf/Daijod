import { describe, expect, it } from 'vitest'
import {
  expenseByCategory,
  filterTransactions,
  normalizeTransaction,
  sortNewestFirst,
  summarize,
  totalBalance,
  validateTransaction,
  walletBalances,
} from './ledger'
import type { Transaction, Wallet } from './types'

const wallet = (id: string, openingBalance: number): Wallet => ({
  id,
  name: id,
  type: 'bank',
  openingBalance,
  color: '#000',
  createdAt: 0,
  updatedAt: 0,
})

let seq = 0
const tx = (t: Partial<Transaction> & Pick<Transaction, 'type' | 'amount'>): Transaction => ({
  id: `t${++seq}`,
  date: '2026-09-10',
  note: '',
  createdAt: seq,
  updatedAt: seq,
  ...t,
})

const wallets = [wallet('cash', 1000_00), wallet('bank', 5000_00)]

describe('walletBalances', () => {
  it('รายรับเพิ่มยอดกระเป๋าที่เลือก', () => {
    const b = walletBalances(wallets, [tx({ type: 'income', amount: 300_00, destinationWalletId: 'bank' })])
    expect(b.get('bank')).toBe(5300_00)
    expect(b.get('cash')).toBe(1000_00)
  })

  it('รายจ่ายลดยอดกระเป๋าที่เลือก', () => {
    const b = walletBalances(wallets, [tx({ type: 'expense', amount: 45_50, sourceWalletId: 'cash' })])
    expect(b.get('cash')).toBe(954_50)
  })

  it('โอนเงิน: ต้นทางลด ปลายทางเพิ่ม ยอดรวมไม่เปลี่ยน', () => {
    const before = totalBalance(walletBalances(wallets, []))
    const b = walletBalances(wallets, [
      tx({ type: 'transfer', amount: 200_00, sourceWalletId: 'bank', destinationWalletId: 'cash' }),
    ])
    expect(b.get('bank')).toBe(4800_00)
    expect(b.get('cash')).toBe(1200_00)
    expect(totalBalance(b)).toBe(before)
  })

  it('ช่องที่ไม่เกี่ยวกับประเภทไม่มีผลต่อยอด', () => {
    const b = walletBalances(wallets, [
      tx({ type: 'income', amount: 100_00, destinationWalletId: 'cash', sourceWalletId: 'bank' }),
    ])
    expect(b.get('bank')).toBe(5000_00)
    expect(b.get('cash')).toBe(1100_00)
  })
})

describe('validateTransaction', () => {
  const ids = new Set(['cash', 'bank'])
  it('จำนวนเงินต้องมากกว่า 0', () => {
    expect(
      validateTransaction({ type: 'expense', amount: 0, date: '2026-09-10', note: '', sourceWalletId: 'cash' }, ids),
    ).toContain('จำนวนเงินต้องมากกว่า 0')
  })
  it('โอนต้องเป็นคนละกระเป๋า', () => {
    expect(
      validateTransaction(
        { type: 'transfer', amount: 1, date: '2026-09-10', note: '', sourceWalletId: 'cash', destinationWalletId: 'cash' },
        ids,
      ),
    ).toContain('กระเป๋าต้นทางและปลายทางต้องเป็นคนละกระเป๋า')
  })
  it('ต้องเลือกกระเป๋าที่มีอยู่จริง', () => {
    expect(
      validateTransaction({ type: 'income', amount: 1, date: '2026-09-10', note: '', destinationWalletId: 'x' }, ids),
    ).toHaveLength(1)
  })
  it('รายการที่ถูกต้องผ่าน', () => {
    expect(
      validateTransaction({ type: 'income', amount: 1, date: '2026-09-10', note: '', destinationWalletId: 'bank' }, ids),
    ).toEqual([])
  })
})

describe('normalizeTransaction', () => {
  it('ล้างช่องที่ไม่ใช้ และตัดช่องว่างของรายละเอียด', () => {
    expect(
      normalizeTransaction({
        type: 'transfer',
        amount: 1,
        date: '2026-09-10',
        note: '  ย้ายเงิน ',
        categoryId: 'exp-food',
        sourceWalletId: 'a',
        destinationWalletId: 'b',
      }),
    ).toEqual({ type: 'transfer', amount: 1, date: '2026-09-10', note: 'ย้ายเงิน', sourceWalletId: 'a', destinationWalletId: 'b' })
  })
})

describe('summaries', () => {
  const txs = [
    tx({ type: 'income', amount: 20000_00, date: '2026-09-01', destinationWalletId: 'bank', categoryId: 'salary' }),
    tx({ type: 'expense', amount: 100_00, date: '2026-09-05', sourceWalletId: 'cash', categoryId: 'food' }),
    tx({ type: 'expense', amount: 300_00, date: '2026-09-20', sourceWalletId: 'cash', categoryId: 'travel' }),
    tx({ type: 'expense', amount: 50_00, date: '2026-09-20', sourceWalletId: 'bank', categoryId: 'food' }),
    tx({ type: 'expense', amount: 999_00, date: '2026-08-31', sourceWalletId: 'bank', categoryId: 'food' }),
    tx({ type: 'transfer', amount: 500_00, date: '2026-09-06', sourceWalletId: 'bank', destinationWalletId: 'cash' }),
  ]

  it('สรุปตามช่วงวันที่ โดยไม่นับการโอน', () => {
    expect(summarize(txs, { from: '2026-09-01', to: '2026-09-30' })).toEqual({
      income: 20000_00,
      expense: 450_00,
      net: 19550_00,
    })
    expect(summarize(txs, { from: '2026-09-20', to: '2026-09-20' }).expense).toBe(350_00)
  })

  it('รายจ่ายตามหมวดเรียงมากไปน้อย และตรงกับยอดรวม', () => {
    const range = { from: '2026-09-01', to: '2026-09-30' }
    const byCat = expenseByCategory(txs, range)
    expect(byCat).toEqual([
      { categoryId: 'travel', amount: 300_00 },
      { categoryId: 'food', amount: 150_00 },
    ])
    expect(byCat.reduce((s, c) => s + c.amount, 0)).toBe(summarize(txs, range).expense)
  })

  it('เรียงรายการล่าสุดก่อน', () => {
    const sorted = sortNewestFirst(txs)
    expect(sorted[0].date).toBe('2026-09-20')
    expect(sorted[0].createdAt).toBeGreaterThan(sorted[1].createdAt)
    expect(sorted.at(-1)!.date).toBe('2026-08-31')
  })

  it('กรองตามกระเป๋า ประเภท และค้นหา', () => {
    const cats = new Map([['food', { id: 'food', name: 'อาหาร', type: 'expense' as const, icon: '' }]])
    const ws = new Map(wallets.map((w) => [w.id, w]))
    expect(filterTransactions(txs, { walletId: 'cash' }, cats, ws)).toHaveLength(3)
    expect(filterTransactions(txs, { type: 'expense', walletId: 'bank' }, cats, ws)).toHaveLength(2)
    expect(filterTransactions(txs, { search: 'อาหาร' }, cats, ws)).toHaveLength(3)
  })
})
