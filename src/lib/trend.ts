// เทียบเดือนต่อเดือน: ยอดรับ/จ่ายรายเดือนย้อนหลัง และเดือนนี้ต่างจากเดือนก่อนอย่างไร
import type { Category, Transaction } from './types'

export interface MonthTotal {
  month: string // YYYY-MM
  income: number
  expense: number
  net: number
}

function monthOf(date: string) {
  return date.slice(0, 7)
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** ยอดรายเดือน `count` เดือนล่าสุด (เก่า -> ใหม่) รวมเดือนของ today */
export function monthlyTotals(
  txs: Transaction[],
  today: string,
  count = 6,
  exclude: Set<string> = new Set(),
): MonthTotal[] {
  const current = monthOf(today)
  const months: MonthTotal[] = []
  for (let i = count - 1; i >= 0; i--) months.push({ month: shiftMonth(current, -i), income: 0, expense: 0, net: 0 })
  const byMonth = new Map(months.map((m) => [m.month, m]))
  for (const tx of txs) {
    if (tx.type === 'transfer' || (tx.categoryId && exclude.has(tx.categoryId))) continue
    const m = byMonth.get(monthOf(tx.date))
    if (!m) continue
    if (tx.type === 'income') m.income += tx.amount
    else m.expense += tx.amount
  }
  for (const m of months) m.net = m.income - m.expense
  return months
}

export interface CategoryChange {
  category?: Category
  categoryId: string | null
  current: number
  previous: number
  diff: number
}

export interface MonthComparison {
  current: MonthTotal
  previous: MonthTotal
  expenseDiff: number
  expensePct: number | null // null เมื่อเดือนก่อนเป็น 0
  biggestIncrease?: CategoryChange
  biggestDecrease?: CategoryChange
}

/** เดือนนี้เทียบเดือนก่อน: รายจ่ายต่างกันเท่าไหร่ หมวดไหนเพิ่ม/ลดมากสุด */
export function compareMonths(
  txs: Transaction[],
  categories: Map<string, Category>,
  today: string,
  exclude: Set<string> = new Set(),
): MonthComparison {
  const [previous, current] = monthlyTotals(txs, today, 2, exclude)
  const byCat = new Map<string | null, { current: number; previous: number }>()
  for (const tx of txs) {
    if (tx.type !== 'expense' || (tx.categoryId && exclude.has(tx.categoryId))) continue
    const m = monthOf(tx.date)
    if (m !== current.month && m !== previous.month) continue
    const key = tx.categoryId ?? null
    const e = byCat.get(key) ?? { current: 0, previous: 0 }
    if (m === current.month) e.current += tx.amount
    else e.previous += tx.amount
    byCat.set(key, e)
  }
  const changes: CategoryChange[] = [...byCat.entries()].map(([categoryId, e]) => ({
    categoryId,
    category: categoryId ? categories.get(categoryId) : undefined,
    ...e,
    diff: e.current - e.previous,
  }))
  const up = changes.filter((c) => c.diff > 0).sort((a, b) => b.diff - a.diff)[0]
  const down = changes.filter((c) => c.diff < 0).sort((a, b) => a.diff - b.diff)[0]
  return {
    current,
    previous,
    expenseDiff: current.expense - previous.expense,
    expensePct: previous.expense ? (current.expense - previous.expense) / previous.expense : null,
    biggestIncrease: up,
    biggestDecrease: down,
  }
}

const MONTH_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** "2026-09" -> "ก.ย." (ใส่ปี พ.ศ. สองหลักเมื่อ withYear) */
export function monthLabel(month: string, withYear = false): string {
  const [y, m] = month.split('-').map(Number)
  return withYear ? `${MONTH_TH[m - 1]} ${String(y + 543).slice(-2)}` : MONTH_TH[m - 1]
}
