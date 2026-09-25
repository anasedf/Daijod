// ปุ่มลัด: หารายการที่จดซ้ำ ๆ (ประเภท+หมวด+รายละเอียด+กระเป๋าเดียวกัน) ในช่วงหลัง ๆ
// แล้วเสนอให้จดใหม่ได้ในแตะเดียว ด้วยจำนวนเงินที่ใช้บ่อยที่สุด
import type { Transaction } from './types'

export interface QuickAdd {
  key: string
  type: 'expense' | 'income'
  categoryId?: string
  note: string
  walletId: string
  amount: number // สตางค์ (จำนวนที่พบบ่อยที่สุด)
  count: number
  lastDate: string
}

export function suggestQuickAdds(
  txs: Transaction[],
  opts: { today: string; days?: number; limit?: number; minCount?: number },
): QuickAdd[] {
  const { today, days = 90, limit = 6, minCount = 2 } = opts
  const since = new Date(today)
  since.setDate(since.getDate() - days)
  const sinceISO = since.toISOString().slice(0, 10)

  const groups = new Map<string, { txs: Transaction[]; amounts: Map<number, number> }>()
  for (const tx of txs) {
    if (tx.type === 'transfer' || tx.date < sinceISO || tx.date > today) continue
    const note = tx.note.trim()
    if (!note && !tx.categoryId) continue // ไม่มีอะไรให้เรียกชื่อ
    const walletId = tx.type === 'income' ? tx.destinationWalletId : tx.sourceWalletId
    if (!walletId) continue
    const key = [tx.type, tx.categoryId ?? '', note.toLowerCase(), walletId].join('|')
    let g = groups.get(key)
    if (!g) groups.set(key, (g = { txs: [], amounts: new Map() }))
    g.txs.push(tx)
    g.amounts.set(tx.amount, (g.amounts.get(tx.amount) ?? 0) + 1)
  }

  const out: QuickAdd[] = []
  for (const [key, g] of groups) {
    if (g.txs.length < minCount) continue
    const latest = g.txs.reduce((a, b) => (b.date > a.date || (b.date === a.date && b.createdAt > a.createdAt) ? b : a))
    // จำนวนที่พบบ่อยสุด ถ้าเท่ากันใช้จำนวนของรายการล่าสุด
    let amount = latest.amount
    let best = g.amounts.get(amount) ?? 0
    for (const [a, n] of g.amounts) if (n > best) (amount = a), (best = n)
    out.push({
      key,
      type: latest.type as 'expense' | 'income',
      categoryId: latest.categoryId,
      note: latest.note.trim(),
      walletId: (latest.type === 'income' ? latest.destinationWalletId : latest.sourceWalletId)!,
      amount,
      count: g.txs.length,
      lastDate: latest.date,
    })
  }
  return out.sort((a, b) => b.count - a.count || (b.lastDate > a.lastDate ? 1 : -1)).slice(0, limit)
}
