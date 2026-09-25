// เงินยืม: รวมยอดตามชื่อคน (จากช่องรายละเอียด) ว่าใครติดใครเท่าไหร่
import type { Category, Transaction } from './types'

export function loanCategoryIds(categories: Category[]): Set<string> {
  return new Set(categories.filter((c) => c.role).map((c) => c.id))
}

export interface LoanBalance {
  name: string
  /** เขาติดเรา (ให้ยืม − ได้รับคืน) */
  owedToMe: number
  /** เราติดเขา (ยืมมา − จ่ายคืน) */
  iOwe: number
  lastDate: string
  count: number
}

/** ยอดคงค้างต่อคน (เฉพาะที่ยังไม่เป็นศูนย์) เรียงจากยอดมากไปน้อย */
export function loanBalances(txs: Transaction[], categories: Category[]): LoanBalance[] {
  const roles = new Map(categories.filter((c) => c.role).map((c) => [c.id, c.role!]))
  const byName = new Map<string, LoanBalance>()
  for (const tx of txs) {
    const role = tx.categoryId && roles.get(tx.categoryId)
    if (!role) continue
    const name = tx.note.trim() || 'ไม่ระบุชื่อ'
    const key = name.toLowerCase()
    let b = byName.get(key)
    if (!b) byName.set(key, (b = { name, owedToMe: 0, iOwe: 0, lastDate: tx.date, count: 0 }))
    if (role === 'lend') b.owedToMe += tx.amount
    else if (role === 'repay') b.owedToMe -= tx.amount
    else if (role === 'borrow') b.iOwe += tx.amount
    else b.iOwe -= tx.amount
    b.count++
    if (tx.date > b.lastDate) b.lastDate = tx.date
  }
  return [...byName.values()]
    .filter((b) => b.owedToMe !== 0 || b.iOwe !== 0)
    .sort((a, b) => Math.abs(b.owedToMe) + Math.abs(b.iOwe) - (Math.abs(a.owedToMe) + Math.abs(a.iOwe)))
}
