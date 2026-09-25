// งบประมาณรายเดือนต่อหมวด: ใช้ไปเท่าไหร่ เหลือเท่าไหร่ และควรใช้วันละเท่าไหร่ให้พอถึงสิ้นเดือน
import { inRange, monthRange, type DateRange } from './dates'
import type { Category, Transaction } from './types'

export interface BudgetStatus {
  category: Category
  budget: number // สตางค์
  spent: number
  remaining: number // ติดลบเมื่อเกินงบ
  ratio: number // spent / budget (อาจเกิน 1)
  perDay: number | null // เหลือใช้ได้วันละเท่าไหร่ในวันที่เหลือ (null = เกินงบแล้ว)
}

export interface BudgetSummary {
  items: BudgetStatus[]
  totalBudget: number
  totalSpent: number
  daysLeft: number // นับวันนี้ด้วย
  range: DateRange
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** สรุปงบของเดือนที่ today อยู่ (เฉพาะหมวดรายจ่ายที่ตั้งงบไว้) */
export function budgetSummary(categories: Category[], txs: Transaction[], today: string): BudgetSummary {
  const range = monthRange(parseISO(today))
  const daysLeft = Math.max(1, Math.round((parseISO(range.to).getTime() - parseISO(today).getTime()) / 86_400_000) + 1)

  const spentBy = new Map<string, number>()
  for (const tx of txs) {
    if (tx.type !== 'expense' || !tx.categoryId || !inRange(tx.date, range)) continue
    spentBy.set(tx.categoryId, (spentBy.get(tx.categoryId) ?? 0) + tx.amount)
  }

  const items: BudgetStatus[] = []
  for (const category of categories) {
    if (category.type !== 'expense' || !category.budget) continue
    const budget = category.budget
    const spent = spentBy.get(category.id) ?? 0
    const remaining = budget - spent
    items.push({
      category,
      budget,
      spent,
      remaining,
      ratio: spent / budget,
      perDay: remaining > 0 ? Math.floor(remaining / daysLeft) : null,
    })
  }
  items.sort((a, b) => b.ratio - a.ratio)

  return {
    items,
    totalBudget: items.reduce((s, i) => s + i.budget, 0),
    totalSpent: items.reduce((s, i) => s + i.spent, 0),
    daysLeft,
    range,
  }
}
