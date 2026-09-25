import { describe, expect, it } from 'vitest'
import { filterTransactions, normalizeTransaction } from './ledger'
import type { Transaction } from './types'

const base = { type: 'expense' as const, amount: 100, date: '2026-09-01', note: 'ข้าว', sourceWalletId: 'w' }

describe('memo', () => {
  it('เก็บโน้ตเมื่อมีข้อความ ตัดช่องว่าง และไม่เก็บถ้าว่าง', () => {
    expect(normalizeTransaction({ ...base, memo: '  จ่ายให้เพื่อนด้วย\nรอเก็บเงินคืน  ' }).memo).toBe('จ่ายให้เพื่อนด้วย\nรอเก็บเงินคืน')
    expect('memo' in normalizeTransaction({ ...base, memo: '   ' })).toBe(false)
    expect('memo' in normalizeTransaction({ ...base })).toBe(false)
  })

  it('ค้นหาเจอจากโน้ต', () => {
    const tx: Transaction = { ...base, id: 't1', memo: 'เลี้ยงวันเกิดพี่โอ๋', createdAt: 1, updatedAt: 1 }
    expect(filterTransactions([tx], { search: 'วันเกิด' }, new Map(), new Map())).toHaveLength(1)
    expect(filterTransactions([tx], { search: 'ปีใหม่' }, new Map(), new Map())).toHaveLength(0)
  })
})
