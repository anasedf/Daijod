import Dexie, { type EntityTable } from 'dexie'
import { newId } from './id'
import { normalizeTransaction, validateTransaction } from './ledger'
import type { Category, Transaction, TransactionInput, Wallet, WalletInput } from './types'

export class DaijodDB extends Dexie {
  wallets!: EntityTable<Wallet, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  categories!: EntityTable<Category, 'id'>

  constructor(name = 'daijod') {
    super(name)
    this.version(1).stores({
      wallets: 'id, name',
      transactions: 'id, date, type, sourceWalletId, destinationWalletId, categoryId',
      categories: 'id, type',
    })
    this.on('populate', (tx) => {
      tx.table('categories').bulkAdd(DEFAULT_CATEGORIES)
    })
  }
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'exp-food', name: 'อาหาร', type: 'expense', icon: '🍜' },
  { id: 'exp-travel', name: 'เดินทาง', type: 'expense', icon: '🚌' },
  { id: 'exp-home', name: 'บ้าน', type: 'expense', icon: '🏠' },
  { id: 'exp-bills', name: 'ค่าน้ำ/ไฟ/เน็ต', type: 'expense', icon: '💡' },
  { id: 'exp-health', name: 'สุขภาพ', type: 'expense', icon: '💊' },
  { id: 'exp-shopping', name: 'ช้อปปิ้ง', type: 'expense', icon: '🛍️' },
  { id: 'exp-fun', name: 'บันเทิง', type: 'expense', icon: '🎬' },
  { id: 'exp-other', name: 'อื่น ๆ', type: 'expense', icon: '📦' },
  { id: 'inc-salary', name: 'เงินเดือน', type: 'income', icon: '💼' },
  { id: 'inc-extra', name: 'รายได้เสริม', type: 'income', icon: '💰' },
  { id: 'inc-gift', name: 'ได้รับ/ของขวัญ', type: 'income', icon: '🎁' },
  { id: 'inc-other', name: 'อื่น ๆ', type: 'income', icon: '📥' },
]

export const db = new DaijodDB()

/** ข้อผิดพลาดที่ตั้งใจแสดงให้ผู้ใช้เห็น */
export class UserError extends Error {}

// ---------- กระเป๋า ----------

function checkWallet(input: WalletInput) {
  if (!input.name.trim()) throw new UserError('กรุณาตั้งชื่อกระเป๋า')
  if (!Number.isSafeInteger(input.openingBalance)) throw new UserError('ยอดตั้งต้นไม่ถูกต้อง')
}

export async function addWallet(input: WalletInput, d: DaijodDB = db): Promise<string> {
  checkWallet(input)
  const now = Date.now()
  const id = newId()
  await d.wallets.add({ ...input, name: input.name.trim(), id, createdAt: now, updatedAt: now })
  return id
}

export async function updateWallet(id: string, input: WalletInput, d: DaijodDB = db) {
  checkWallet(input)
  const n = await d.wallets.update(id, { ...input, name: input.name.trim(), updatedAt: Date.now() })
  if (!n) throw new UserError('ไม่พบกระเป๋านี้แล้ว')
}

/** รายการที่เกี่ยวข้องกับกระเป๋า (ใช้แจ้งผู้ใช้ก่อนลบ) */
export function transactionsOfWallet(walletId: string, d: DaijodDB = db) {
  return d.transactions
    .where('sourceWalletId')
    .equals(walletId)
    .or('destinationWalletId')
    .equals(walletId)
    .toArray()
}

/** ลบกระเป๋าพร้อมรายการที่เกี่ยวข้องทั้งหมด (UI ต้องยืนยันกับผู้ใช้ก่อน) */
export async function deleteWalletWithTransactions(walletId: string, d: DaijodDB = db) {
  await d.transaction('rw', d.wallets, d.transactions, async () => {
    const related = await transactionsOfWallet(walletId, d)
    await d.transactions.bulkDelete(related.map((t) => t.id))
    await d.wallets.delete(walletId)
  })
}

// ---------- รายการ ----------

async function checkTransaction(input: TransactionInput, d: DaijodDB) {
  const ids = new Set((await d.wallets.toCollection().primaryKeys()) as string[])
  const errors = validateTransaction(input, ids)
  if (errors.length) throw new UserError(errors.join('\n'))
}

export async function addTransaction(input: TransactionInput, d: DaijodDB = db): Promise<string> {
  const clean = normalizeTransaction(input)
  const id = newId()
  const now = Date.now()
  await d.transaction('rw', d.wallets, d.transactions, async () => {
    await checkTransaction(clean, d)
    await d.transactions.add({ ...clean, id, createdAt: now, updatedAt: now })
  })
  return id
}

export async function updateTransaction(id: string, input: TransactionInput, d: DaijodDB = db) {
  const clean = normalizeTransaction(input)
  await d.transaction('rw', d.wallets, d.transactions, async () => {
    await checkTransaction(clean, d)
    const old = await d.transactions.get(id)
    if (!old) throw new UserError('ไม่พบรายการนี้แล้ว')
    // ใช้ put แทน update เพื่อให้ช่องที่ไม่ใช้แล้ว (เช่นเปลี่ยนจากโอนเป็นรายจ่าย) ถูกล้างออก
    await d.transactions.put({ ...clean, id, createdAt: old.createdAt, updatedAt: Date.now() })
  })
}

export async function deleteTransaction(id: string, d: DaijodDB = db) {
  await d.transactions.delete(id)
}

// ---------- หมวดหมู่ ----------

export async function addCategory(input: Omit<Category, 'id'>, d: DaijodDB = db) {
  if (!input.name.trim()) throw new UserError('กรุณาตั้งชื่อหมวด')
  const id = newId()
  await d.categories.add({ ...input, name: input.name.trim(), id })
  return id
}

export async function updateCategory(id: string, input: Pick<Category, 'name' | 'icon'>, d: DaijodDB = db) {
  if (!input.name.trim()) throw new UserError('กรุณาตั้งชื่อหมวด')
  await d.categories.update(id, { name: input.name.trim(), icon: input.icon })
}

/** ลบหมวดได้เฉพาะเมื่อไม่มีรายการใช้อยู่ เพื่อไม่ให้รายการเสียข้อมูลเงียบ ๆ */
export async function deleteCategory(id: string, d: DaijodDB = db) {
  await d.transaction('rw', d.categories, d.transactions, async () => {
    const used = await d.transactions.where('categoryId').equals(id).count()
    if (used > 0) throw new UserError(`หมวดนี้ถูกใช้อยู่ใน ${used} รายการ ลบไม่ได้ (แก้ชื่อแทนได้)`)
    await d.categories.delete(id)
  })
}

// ---------- สำรอง / นำเข้า ----------

export interface Backup {
  app: 'daijod'
  version: 1
  exportedAt: string
  wallets: Wallet[]
  transactions: Transaction[]
  categories: Category[]
}

export async function exportBackup(d: DaijodDB = db): Promise<Backup> {
  const [wallets, transactions, categories] = await Promise.all([
    d.wallets.toArray(),
    d.transactions.toArray(),
    d.categories.toArray(),
  ])
  return { app: 'daijod', version: 1, exportedAt: new Date().toISOString(), wallets, transactions, categories }
}

/** ตรวจไฟล์สำรองก่อนนำเข้า แล้วแทนที่ข้อมูลทั้งหมด */
export async function importBackup(data: unknown, d: DaijodDB = db) {
  const b = data as Partial<Backup>
  if (
    !b ||
    b.app !== 'daijod' ||
    b.version !== 1 ||
    !Array.isArray(b.wallets) ||
    !Array.isArray(b.transactions) ||
    !Array.isArray(b.categories)
  ) {
    throw new UserError('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ ได้จด')
  }
  const walletIds = new Set(b.wallets.map((w) => w.id))
  for (const w of b.wallets) {
    if (typeof w.id !== 'string' || typeof w.name !== 'string' || !Number.isSafeInteger(w.openingBalance)) {
      throw new UserError('ข้อมูลกระเป๋าในไฟล์ไม่ถูกต้อง')
    }
  }
  for (const t of b.transactions) {
    if (typeof t.id !== 'string' || validateTransaction(t, walletIds).length) {
      throw new UserError('ข้อมูลรายการในไฟล์ไม่ถูกต้อง')
    }
  }
  await d.transaction('rw', d.wallets, d.transactions, d.categories, async () => {
    await Promise.all([d.wallets.clear(), d.transactions.clear(), d.categories.clear()])
    await d.wallets.bulkAdd(b.wallets!)
    await d.transactions.bulkAdd(b.transactions!)
    await d.categories.bulkAdd(b.categories!)
  })
}
