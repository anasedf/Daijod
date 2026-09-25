import { describe, expect, it } from 'vitest'
import { backupReminder } from './backup'
import type { Transaction } from './types'

const DAY = 86_400_000
const now = Date.parse('2026-09-25T12:00:00Z')

function txs(count: number, updatedAt: number): Transaction[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `t${i}`,
    type: 'expense',
    amount: 100,
    date: '2026-09-01',
    note: '',
    sourceWalletId: 'w',
    createdAt: updatedAt,
    updatedAt,
  }))
}

describe('backupReminder', () => {
  it('ยังมีรายการน้อย ไม่เตือน', () => {
    expect(backupReminder(txs(5, now), { now, lastBackup: null, snoozedUntil: null })).toBeNull()
  })

  it('ไม่เคยสำรองและมีรายการพอสมควร -> เตือน', () => {
    expect(backupReminder(txs(20, now), { now, lastBackup: null, snoozedUntil: null })).toEqual({ reason: 'never', days: 0 })
  })

  it('สำรองไปไม่นาน ไม่เตือน', () => {
    expect(backupReminder(txs(20, now), { now, lastBackup: now - 3 * DAY, snoozedUntil: null })).toBeNull()
  })

  it('สำรองนานแล้วและมีการแก้ไขหลังจากนั้น -> เตือนพร้อมจำนวนวัน', () => {
    const last = now - 20 * DAY
    expect(backupReminder(txs(20, now), { now, lastBackup: last, snoozedUntil: null })).toEqual({ reason: 'stale', days: 20 })
  })

  it('สำรองนานแล้วแต่ไม่มีอะไรเปลี่ยน ไม่เตือน', () => {
    const last = now - 20 * DAY
    expect(backupReminder(txs(20, last - DAY), { now, lastBackup: last, snoozedUntil: null })).toBeNull()
  })

  it('กด "ไว้ก่อน" แล้วเงียบจนกว่าจะครบกำหนด', () => {
    expect(backupReminder(txs(20, now), { now, lastBackup: null, snoozedUntil: now + DAY })).toBeNull()
    expect(backupReminder(txs(20, now), { now, lastBackup: null, snoozedUntil: now - DAY })).not.toBeNull()
  })
})
