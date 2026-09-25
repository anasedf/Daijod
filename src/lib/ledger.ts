import { inRange, type DateRange } from './dates'
import type { Category, Transaction, TransactionInput, TransactionType, Wallet } from './types'

/** ตรวจความถูกต้องของรายการ คืนรายการข้อความผิดพลาด (ว่าง = ใช้ได้) */
export function validateTransaction(input: TransactionInput, walletIds: Set<string>): string[] {
  const errors: string[] = []
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    errors.push('จำนวนเงินต้องมากกว่า 0')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) errors.push('กรุณาเลือกวันที่')

  const needSource = input.type === 'expense' || input.type === 'transfer'
  const needDest = input.type === 'income' || input.type === 'transfer'
  if (needSource && (!input.sourceWalletId || !walletIds.has(input.sourceWalletId))) {
    errors.push(input.type === 'transfer' ? 'กรุณาเลือกกระเป๋าต้นทาง' : 'กรุณาเลือกกระเป๋า')
  }
  if (needDest && (!input.destinationWalletId || !walletIds.has(input.destinationWalletId))) {
    errors.push(input.type === 'transfer' ? 'กรุณาเลือกกระเป๋าปลายทาง' : 'กรุณาเลือกกระเป๋า')
  }
  if (
    input.type === 'transfer' &&
    input.sourceWalletId &&
    input.sourceWalletId === input.destinationWalletId
  ) {
    errors.push('กระเป๋าต้นทางและปลายทางต้องเป็นคนละกระเป๋า')
  }
  return errors
}

/** ล้างช่องที่ไม่เกี่ยวกับประเภทรายการ เช่น รายรับไม่ควรมีกระเป๋าต้นทาง */
export function normalizeTransaction(input: TransactionInput): TransactionInput {
  const out: TransactionInput = {
    type: input.type,
    amount: input.amount,
    date: input.date,
    note: input.note.trim(),
  }
  if (input.type !== 'transfer' && input.categoryId) out.categoryId = input.categoryId
  if (input.type !== 'income') out.sourceWalletId = input.sourceWalletId
  if (input.type !== 'expense') out.destinationWalletId = input.destinationWalletId
  return out
}

/** ผลกระทบของรายการต่อกระเป๋าหนึ่ง (+ เพิ่ม, - ลด) */
export function effectOn(tx: Transaction, walletId: string): number {
  let delta = 0
  if (tx.destinationWalletId === walletId && tx.type !== 'expense') delta += tx.amount
  if (tx.sourceWalletId === walletId && tx.type !== 'income') delta -= tx.amount
  return delta
}

/** ยอดคงเหลือปัจจุบันของทุกกระเป๋า = ยอดตั้งต้น + ผลของทุกรายการ */
export function walletBalances(wallets: Wallet[], txs: Transaction[]): Map<string, number> {
  const balances = new Map<string, number>()
  for (const w of wallets) balances.set(w.id, w.openingBalance)
  for (const tx of txs) {
    for (const id of [tx.sourceWalletId, tx.destinationWalletId]) {
      if (id && balances.has(id)) balances.set(id, balances.get(id)! + effectOn(tx, id))
    }
  }
  return balances
}

export function totalBalance(balances: Map<string, number>): number {
  let sum = 0
  for (const v of balances.values()) sum += v
  return sum
}

export interface PeriodSummary {
  income: number
  expense: number
  net: number
}

/** สรุปรายรับ/รายจ่ายในช่วงวันที่ (การโอนไม่นับ เพราะเป็นการย้ายเงินของตัวเอง) */
export function summarize(txs: Transaction[], range?: Partial<DateRange>): PeriodSummary {
  let income = 0
  let expense = 0
  for (const tx of txs) {
    if (!inRange(tx.date, range)) continue
    if (tx.type === 'income') income += tx.amount
    else if (tx.type === 'expense') expense += tx.amount
  }
  return { income, expense, net: income - expense }
}

export interface CategoryTotal {
  categoryId: string | null
  amount: number
}

/** รวมรายจ่ายตามหมวด เรียงจากมากไปน้อย */
export function expenseByCategory(txs: Transaction[], range?: Partial<DateRange>): CategoryTotal[] {
  const totals = new Map<string | null, number>()
  for (const tx of txs) {
    if (tx.type !== 'expense' || !inRange(tx.date, range)) continue
    const key = tx.categoryId ?? null
    totals.set(key, (totals.get(key) ?? 0) + tx.amount)
  }
  return [...totals.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount)
}

/** เรียงรายการล่าสุดก่อน (ตามวันที่ แล้วตามเวลาที่บันทึก) */
export function sortNewestFirst(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) =>
    a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
  )
}

export interface TransactionFilter {
  range?: Partial<DateRange>
  type?: TransactionType | ''
  walletId?: string
  categoryId?: string
  search?: string
}

export function filterTransactions(
  txs: Transaction[],
  filter: TransactionFilter,
  categories: Map<string, Category>,
  wallets: Map<string, Wallet>,
): Transaction[] {
  const q = filter.search?.trim().toLowerCase()
  return txs.filter((tx) => {
    if (!inRange(tx.date, filter.range)) return false
    if (filter.type && tx.type !== filter.type) return false
    if (
      filter.walletId &&
      tx.sourceWalletId !== filter.walletId &&
      tx.destinationWalletId !== filter.walletId
    )
      return false
    if (filter.categoryId && tx.categoryId !== filter.categoryId) return false
    if (q) {
      const haystack = [
        tx.note,
        tx.categoryId ? categories.get(tx.categoryId)?.name : '',
        tx.sourceWalletId ? wallets.get(tx.sourceWalletId)?.name : '',
        tx.destinationWalletId ? wallets.get(tx.destinationWalletId)?.name : '',
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}
