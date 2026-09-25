import Dexie, { type EntityTable } from 'dexie'
import { newId } from './id'
import { normalizeTransaction, validateTransaction } from './ledger'
import type { Category, Recurring, RecurringInput, Transaction, TransactionInput, Wallet, WalletInput } from './types'

export class DaijodDB extends Dexie {
  wallets!: EntityTable<Wallet, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  categories!: EntityTable<Category, 'id'>
  recurring!: EntityTable<Recurring, 'id'>

  constructor(name = 'daijod') {
    super(name)
    const stores = {
      wallets: 'id, name',
      transactions: 'id, date, type, sourceWalletId, destinationWalletId, categoryId',
      categories: 'id, type',
    }
    this.version(1).stores(stores)
    // v2: หมวดมีไอคอนและสี เติมให้หมวดเริ่มต้นที่ยังไม่มี
    this.version(2)
      .stores(stores)
      .upgrade((tx) =>
        tx.table('categories').toCollection().modify((c: Category) => {
          const d = DEFAULT_CATEGORIES.find((x) => x.id === c.id)
          if (d && !c.iconName) {
            c.iconName = d.iconName
            c.color = d.color
          }
        }),
      )
    // v3: รายการประจำ
    this.version(3).stores({ ...stores, recurring: 'id, active' })
    // v4: หมวดเงินยืม เติมให้ฐานข้อมูลเก่าที่ยังไม่มี
    this.version(4)
      .stores({ ...stores, recurring: 'id, active' })
      .upgrade(async (tx) => {
        const t = tx.table('categories')
        for (const c of DEFAULT_CATEGORIES) if (c.role && !(await t.get(c.id))) await t.add(c)
      })
    this.on('populate', (tx) => {
      tx.table('categories').bulkAdd(DEFAULT_CATEGORIES)
    })
  }
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'exp-food', name: 'อาหาร', type: 'expense', icon: '🍜', iconName: 'Utensils', color: '#c2410c' },
  { id: 'exp-travel', name: 'เดินทาง', type: 'expense', icon: '🚌', iconName: 'Bus', color: '#1d4ed8' },
  { id: 'exp-home', name: 'บ้าน', type: 'expense', icon: '🏠', iconName: 'House', color: '#a16207' },
  { id: 'exp-bills', name: 'ค่าน้ำ/ไฟ/เน็ต', type: 'expense', icon: '💡', iconName: 'Lightbulb', color: '#7e22ce' },
  { id: 'exp-health', name: 'สุขภาพ', type: 'expense', icon: '💊', iconName: 'Pill', color: '#be185d' },
  { id: 'exp-shopping', name: 'ช้อปปิ้ง', type: 'expense', icon: '🛍️', iconName: 'ShoppingBag', color: '#0369a1' },
  { id: 'exp-fun', name: 'บันเทิง', type: 'expense', icon: '🎬', iconName: 'Clapperboard', color: '#6d28d9' },
  { id: 'exp-other', name: 'อื่น ๆ', type: 'expense', icon: '📦', iconName: 'Package', color: '#475569' },
  { id: 'inc-salary', name: 'เงินเดือน', type: 'income', icon: '💼', iconName: 'Briefcase', color: '#0f766e' },
  { id: 'inc-extra', name: 'รายได้เสริม', type: 'income', icon: '💰', iconName: 'Coins', color: '#15803d' },
  { id: 'inc-gift', name: 'ได้รับ/ของขวัญ', type: 'income', icon: '🎁', iconName: 'Gift', color: '#be185d' },
  { id: 'inc-other', name: 'อื่น ๆ', type: 'income', icon: '📥', iconName: 'Inbox', color: '#475569' },
  // หมวดเงินยืม (ไม่นับในสรุปรายรับ/รายจ่าย)
  { id: 'exp-lend', name: 'ให้ยืม', type: 'expense', icon: '🤝', iconName: 'HandCoins', color: '#0369a1', role: 'lend' },
  { id: 'exp-payback', name: 'จ่ายคืน', type: 'expense', icon: '↩️', iconName: 'Banknote', color: '#4d7c0f', role: 'payback' },
  { id: 'inc-repay', name: 'ได้รับคืน', type: 'income', icon: '🤝', iconName: 'PiggyBank', color: '#0369a1', role: 'repay' },
  { id: 'inc-borrow', name: 'ยืมมา', type: 'income', icon: '🏦', iconName: 'Landmark', color: '#4d7c0f', role: 'borrow' },
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

export async function deleteTransactions(ids: string[], d: DaijodDB = db) {
  await d.transactions.bulkDelete(ids)
}

/** ลบทุกอย่างแล้วกลับไปเป็นแอปเปล่า ๆ (เหลือหมวดเริ่มต้น) UI ต้องยืนยันกับผู้ใช้ก่อน */
export async function resetAllData(d: DaijodDB = db) {
  await d.transaction('rw', d.wallets, d.transactions, d.categories, d.recurring, async () => {
    await Promise.all([d.wallets.clear(), d.transactions.clear(), d.categories.clear(), d.recurring.clear()])
    await d.categories.bulkAdd(DEFAULT_CATEGORIES)
  })
}

/** เพิ่มหลายรายการในครั้งเดียว (จาก statement) ถ้ามีรายการใดผิดหรือซ้ำ จะไม่บันทึกเลยสักรายการ */
export async function importTransactions(inputs: TransactionInput[], d: DaijodDB = db): Promise<number> {
  const cleans = inputs.map(normalizeTransaction)
  const now = Date.now()
  await d.transaction('rw', d.wallets, d.transactions, async () => {
    const ids = new Set((await d.wallets.toCollection().primaryKeys()) as string[])
    for (const c of cleans) {
      const errors = validateTransaction(c, ids)
      if (errors.length) throw new UserError(errors.join('\n'))
    }
    const keys = new Set(cleans.map((c) => c.importKey).filter((k): k is string => !!k))
    if (keys.size) {
      const dup = await d.transactions.filter((t) => !!t.importKey && keys.has(t.importKey)).count()
      if (dup) throw new UserError(`มี ${dup} รายการที่นำเข้าไปแล้ว กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง`)
    }
    // ใช้ createdAt ไล่ตามลำดับใน statement เพื่อให้รายการวันเดียวกันเรียงถูก
    await d.transactions.bulkAdd(
      cleans.map((c, i) => ({ ...c, id: newId(), createdAt: now + i, updatedAt: now + i })),
    )
  })
  return cleans.length
}

// ---------- รายการประจำ ----------

function checkRecurring(input: RecurringInput, walletIds: Set<string>) {
  if (!input.name.trim()) throw new UserError('กรุณาตั้งชื่อรายการประจำ')
  if (!Number.isInteger(input.day) || input.day < 1 || input.day > 31) throw new UserError('วันที่ต้องอยู่ระหว่าง 1–31')
  const errors = validateTransaction({ ...input, date: '2000-01-01' }, walletIds)
  if (errors.length) throw new UserError(errors.join('\n'))
}

function cleanRecurring(input: RecurringInput): RecurringInput {
  const t = normalizeTransaction({ ...input, date: '2000-01-01' })
  return {
    name: input.name.trim(),
    type: t.type,
    amount: t.amount,
    day: input.day,
    note: t.note,
    categoryId: t.categoryId,
    sourceWalletId: t.sourceWalletId,
    destinationWalletId: t.destinationWalletId,
    active: input.active,
  }
}

export async function addRecurring(input: RecurringInput, d: DaijodDB = db): Promise<string> {
  const ids = new Set((await d.wallets.toCollection().primaryKeys()) as string[])
  checkRecurring(input, ids)
  const now = Date.now()
  const id = newId()
  await d.recurring.add({ ...cleanRecurring(input), id, createdAt: now, updatedAt: now })
  return id
}

export async function updateRecurring(id: string, input: RecurringInput, d: DaijodDB = db) {
  const ids = new Set((await d.wallets.toCollection().primaryKeys()) as string[])
  checkRecurring(input, ids)
  const old = await d.recurring.get(id)
  if (!old) throw new UserError('ไม่พบรายการประจำนี้แล้ว')
  await d.recurring.put({ ...cleanRecurring(input), id, lastMonth: old.lastMonth, createdAt: old.createdAt, updatedAt: Date.now() })
}

export async function deleteRecurring(id: string, d: DaijodDB = db) {
  await d.recurring.delete(id)
}

/** บันทึกรายการประจำเป็นรายการจริงของวันที่กำหนด แล้วจำว่าเดือนนี้ทำแล้ว */
export async function postRecurring(rec: Recurring, date: string, d: DaijodDB = db): Promise<string> {
  const id = await addTransaction(
    {
      type: rec.type,
      amount: rec.amount,
      date,
      note: rec.note || rec.name,
      categoryId: rec.categoryId,
      sourceWalletId: rec.sourceWalletId,
      destinationWalletId: rec.destinationWalletId,
    },
    d,
  )
  await d.recurring.update(rec.id, { lastMonth: date.slice(0, 7), updatedAt: Date.now() })
  return id
}

/** ข้ามเดือนนี้ (ไม่บันทึก แต่ไม่ถามอีกจนกว่าจะถึงเดือนหน้า) */
export async function skipRecurring(id: string, month: string, d: DaijodDB = db) {
  await d.recurring.update(id, { lastMonth: month, updatedAt: Date.now() })
}

// ---------- หมวดหมู่ ----------

export async function addCategory(input: Omit<Category, 'id'>, d: DaijodDB = db) {
  if (!input.name.trim()) throw new UserError('กรุณาตั้งชื่อหมวด')
  const id = newId()
  await d.categories.add({ ...input, name: input.name.trim(), id })
  return id
}

export async function updateCategory(
  id: string,
  input: Pick<Category, 'name' | 'icon' | 'iconName' | 'color' | 'budget'>,
  d: DaijodDB = db,
) {
  if (!input.name.trim()) throw new UserError('กรุณาตั้งชื่อหมวด')
  if (input.budget !== undefined && (!Number.isSafeInteger(input.budget) || input.budget < 0)) {
    throw new UserError('งบประมาณต้องเป็นตัวเลขไม่ติดลบ')
  }
  await d.categories.update(id, {
    name: input.name.trim(),
    icon: input.icon,
    iconName: input.iconName,
    color: input.color,
    budget: input.budget || undefined,
  })
}

/** จำนวนรายการที่ใช้หมวดนี้ */
export function countCategoryUse(id: string, d: DaijodDB = db) {
  return d.transactions.where('categoryId').equals(id).count()
}

/**
 * ลบหมวด ถ้ามีรายการใช้อยู่ต้องบอกว่าจะย้ายไปหมวดไหน (moveTo = null คือ "ไม่ระบุหมวด")
 * ไม่ส่ง moveTo มา = ลบได้เฉพาะหมวดที่ไม่มีใครใช้ เพื่อไม่ให้รายการเสียข้อมูลเงียบ ๆ
 */
export async function deleteCategory(id: string, moveTo?: string | null, d: DaijodDB = db) {
  await d.transaction('rw', d.categories, d.transactions, async () => {
    const used = await countCategoryUse(id, d)
    if (used > 0) {
      if (moveTo === undefined) throw new UserError(`หมวดนี้ถูกใช้อยู่ใน ${used} รายการ ต้องเลือกว่าจะย้ายไปหมวดไหนก่อน`)
      if (moveTo) {
        const from = await d.categories.get(id)
        const to = await d.categories.get(moveTo)
        if (!to || !from || to.type !== from.type) throw new UserError('หมวดปลายทางไม่ถูกต้อง')
      }
      await d.transactions
        .where('categoryId')
        .equals(id)
        .modify((t) => {
          if (moveTo) t.categoryId = moveTo
          else delete t.categoryId
        })
    }
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
  recurrings?: Recurring[] // เพิ่มทีหลัง ไฟล์เก่าไม่มีก็นำเข้าได้
}

export async function exportBackup(d: DaijodDB = db): Promise<Backup> {
  const [wallets, transactions, categories, recurrings] = await Promise.all([
    d.wallets.toArray(),
    d.transactions.toArray(),
    d.categories.toArray(),
    d.recurring.toArray(),
  ])
  return { app: 'daijod', version: 1, exportedAt: new Date().toISOString(), wallets, transactions, categories, recurrings }
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
  const recurrings = Array.isArray(b.recurrings) ? b.recurrings : []
  for (const r of recurrings) {
    if (typeof r.id !== 'string' || typeof r.name !== 'string' || !Number.isSafeInteger(r.amount)) {
      throw new UserError('ข้อมูลรายการประจำในไฟล์ไม่ถูกต้อง')
    }
  }
  await d.transaction('rw', d.wallets, d.transactions, d.categories, d.recurring, async () => {
    await Promise.all([d.wallets.clear(), d.transactions.clear(), d.categories.clear(), d.recurring.clear()])
    await d.wallets.bulkAdd(b.wallets!)
    await d.transactions.bulkAdd(b.transactions!)
    await d.categories.bulkAdd(b.categories!)
    await d.recurring.bulkAdd(recurrings)
  })
}
