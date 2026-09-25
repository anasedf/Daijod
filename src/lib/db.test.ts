import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addCategory,
  addTransaction,
  addWallet,
  DaijodDB,
  deleteCategory,
  deleteTransaction,
  deleteWalletWithTransactions,
  exportBackup,
  importBackup,
  updateTransaction,
} from './db'
import { totalBalance, walletBalances } from './ledger'

let d: DaijodDB
let n = 0

beforeEach(async () => {
  d = new DaijodDB(`test-${++n}`)
  await d.open()
})
afterEach(async () => {
  await d.delete()
})

async function balances() {
  return walletBalances(await d.wallets.toArray(), await d.transactions.toArray())
}

const base = { date: '2026-09-25', note: '' }

describe('ฐานข้อมูล', () => {
  it('มีหมวดเริ่มต้น', async () => {
    expect(await d.categories.where('type').equals('expense').count()).toBeGreaterThan(3)
    expect(await d.categories.where('type').equals('income').count()).toBeGreaterThan(1)
  })

  it('แก้ไขและลบรายการแล้วยอดคำนวณใหม่ถูกต้อง', async () => {
    const cash = await addWallet({ name: 'เงินสด', type: 'cash', openingBalance: 1000_00, color: '#0a0' }, d)
    const bank = await addWallet({ name: 'กสิกร', type: 'bank', openingBalance: 0, color: '#0a0' }, d)
    const id = await addTransaction({ ...base, type: 'expense', amount: 100_00, sourceWalletId: cash }, d)
    expect((await balances()).get(cash)).toBe(900_00)

    await updateTransaction(id, { ...base, type: 'expense', amount: 250_00, sourceWalletId: cash }, d)
    expect((await balances()).get(cash)).toBe(750_00)

    // เปลี่ยนเป็นโอน แล้วช่องหมวดต้องหายไป
    await updateTransaction(
      id,
      { ...base, type: 'transfer', amount: 400_00, sourceWalletId: cash, destinationWalletId: bank, categoryId: 'exp-food' },
      d,
    )
    const b = await balances()
    expect(b.get(cash)).toBe(600_00)
    expect(b.get(bank)).toBe(400_00)
    expect(totalBalance(b)).toBe(1000_00)
    expect((await d.transactions.get(id))!.categoryId).toBeUndefined()

    await deleteTransaction(id, d)
    expect((await balances()).get(cash)).toBe(1000_00)
  })

  it('ไม่บันทึกรายการที่ไม่ถูกต้อง', async () => {
    const cash = await addWallet({ name: 'เงินสด', type: 'cash', openingBalance: 0, color: '#0a0' }, d)
    await expect(addTransaction({ ...base, type: 'expense', amount: -5, sourceWalletId: cash }, d)).rejects.toThrow(
      'มากกว่า 0',
    )
    await expect(
      addTransaction({ ...base, type: 'transfer', amount: 5, sourceWalletId: cash, destinationWalletId: cash }, d),
    ).rejects.toThrow('คนละกระเป๋า')
    expect(await d.transactions.count()).toBe(0)
  })

  it('ลบกระเป๋าพร้อมรายการที่เกี่ยวข้อง แต่ไม่แตะกระเป๋าอื่น', async () => {
    const a = await addWallet({ name: 'A', type: 'cash', openingBalance: 100_00, color: '#000' }, d)
    const b = await addWallet({ name: 'B', type: 'cash', openingBalance: 100_00, color: '#000' }, d)
    const c = await addWallet({ name: 'C', type: 'cash', openingBalance: 100_00, color: '#000' }, d)
    await addTransaction({ ...base, type: 'transfer', amount: 10_00, sourceWalletId: a, destinationWalletId: b }, d)
    await addTransaction({ ...base, type: 'expense', amount: 5_00, sourceWalletId: a }, d)
    await addTransaction({ ...base, type: 'income', amount: 7_00, destinationWalletId: c }, d)

    await deleteWalletWithTransactions(a, d)
    expect(await d.transactions.count()).toBe(1)
    const bal = await balances()
    expect(bal.get(b)).toBe(100_00)
    expect(bal.get(c)).toBe(107_00)
  })

  it('ลบหมวดที่มีรายการใช้อยู่ไม่ได้', async () => {
    const w = await addWallet({ name: 'A', type: 'cash', openingBalance: 0, color: '#000' }, d)
    const cat = await addCategory({ name: 'กาแฟ', type: 'expense', icon: '☕' }, d)
    await addTransaction({ ...base, type: 'expense', amount: 60_00, sourceWalletId: w, categoryId: cat }, d)
    await expect(deleteCategory(cat, d)).rejects.toThrow('ลบไม่ได้')
  })

  it('สำรองแล้วนำเข้าได้ข้อมูลเดิม', async () => {
    const w = await addWallet({ name: 'A', type: 'cash', openingBalance: 50_00, color: '#000' }, d)
    await addTransaction({ ...base, type: 'income', amount: 10_00, destinationWalletId: w }, d)
    const backup = JSON.parse(JSON.stringify(await exportBackup(d)))

    await deleteWalletWithTransactions(w, d)
    await importBackup(backup, d)
    expect((await balances()).get(w)).toBe(60_00)

    await expect(importBackup({ hello: 1 }, d)).rejects.toThrow('ไม่ใช่ไฟล์สำรอง')
    expect(await d.wallets.count()).toBe(1)
  })
})
