import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, DEFAULT_CATEGORIES } from '../lib/db'
import { totalBalance, walletBalances } from '../lib/ledger'
import type { Category, Recurring, Transaction, Wallet } from '../lib/types'

export interface AppData {
  wallets: Wallet[]
  transactions: Transaction[]
  categories: Category[]
  recurrings: Recurring[]
  walletMap: Map<string, Wallet>
  categoryMap: Map<string, Category>
  balances: Map<string, number>
  total: number
}

/** อ่านข้อมูลทั้งหมดแบบ live (อัปเดตเองเมื่อข้อมูลเปลี่ยน) คืน undefined ระหว่างโหลด */
export function useData(): AppData | undefined {
  const wallets = useLiveQuery(() => db.wallets.toArray())
  const transactions = useLiveQuery(() => db.transactions.toArray())
  const categories = useLiveQuery(() => db.categories.toArray())
  const recurrings = useLiveQuery(() => db.recurring.toArray())

  return useMemo(() => {
    if (!wallets || !transactions || !categories || !recurrings) return undefined
    const sortedWallets = [...wallets].sort((a, b) => a.createdAt - b.createdAt)
    const sortedCategories = [...categories].sort(compareCategories)
    const balances = walletBalances(sortedWallets, transactions)
    return {
      wallets: sortedWallets,
      transactions,
      categories: sortedCategories,
      recurrings: [...recurrings].sort((a, b) => a.day - b.day || a.name.localeCompare(b.name, 'th')),
      walletMap: new Map(wallets.map((w) => [w.id, w])),
      categoryMap: new Map(categories.map((c) => [c.id, c])),
      balances,
      total: totalBalance(balances),
    }
  }, [wallets, transactions, categories, recurrings])
}

// หมวดเริ่มต้นเรียงตามที่กำหนดไว้ หมวดที่ผู้ใช้เพิ่มเองต่อท้าย เรียงตามชื่อ
const defaultOrder = new Map(DEFAULT_CATEGORIES.map((c, i) => [c.id, i]))
function compareCategories(a: Category, b: Category) {
  const ai = defaultOrder.get(a.id) ?? Infinity
  const bi = defaultOrder.get(b.id) ?? Infinity
  return ai !== bi ? ai - bi : a.name.localeCompare(b.name, 'th')
}
