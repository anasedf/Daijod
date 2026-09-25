import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types'
import type { StatementTx } from './kbank'
import { findMatchingTransfer } from './match'

function transfer(id: string, from: string, to: string, amount: number, date: string): Transaction {
  return { id, type: 'transfer', amount, date, note: '', sourceWalletId: from, destinationWalletId: to, createdAt: 0, updatedAt: 0 }
}
function row(direction: 'in' | 'out', amount: number, date: string): StatementTx {
  return { date, time: '10:00', kind: '', channel: '', detail: '', amount, direction, balance: 0, key: `${date}-${amount}` }
}

describe('findMatchingTransfer', () => {
  const txs = [
    transfer('a', 'kbank', 'tm', 150000, '2026-09-02'),
    transfer('b', 'kbank', 'tm', 150000, '2026-09-10'),
    transfer('c', 'tm', 'cash', 50000, '2026-09-05'),
    transfer('d', 'kbank', 'cash', 150000, '2026-09-02'), // อีกฝั่งไม่ใช่ tm
  ]

  it('เงินเข้า TrueMoney ตรงกับโอนที่ปลายทางเป็น TrueMoney ยอดเท่ากัน วันใกล้สุด', () => {
    const used = new Set<string>()
    expect(findMatchingTransfer(row('in', 150000, '2026-09-03'), 'tm', txs, used)?.id).toBe('a')
    // ใช้แล้วไม่ถูกใช้ซ้ำ -> รายการถัดไปได้ b
    expect(findMatchingTransfer(row('in', 150000, '2026-09-09'), 'tm', txs, used)?.id).toBe('b')
    expect(findMatchingTransfer(row('in', 150000, '2026-09-09'), 'tm', txs, used)).toBeUndefined()
  })

  it('เงินออกตรงกับโอนที่ต้นทางเป็นกระเป๋านี้', () => {
    expect(findMatchingTransfer(row('out', 50000, '2026-09-05'), 'tm', txs, new Set())?.id).toBe('c')
    expect(findMatchingTransfer(row('in', 50000, '2026-09-05'), 'tm', txs, new Set())).toBeUndefined()
  })

  it('ห่างเกิน 2 วันหรือยอดไม่เท่าไม่จับคู่', () => {
    expect(findMatchingTransfer(row('in', 150000, '2026-09-06'), 'tm', txs, new Set())).toBeUndefined()
    expect(findMatchingTransfer(row('in', 150001, '2026-09-02'), 'tm', txs, new Set())).toBeUndefined()
  })
})
