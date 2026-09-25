import type { AppData } from '../hooks/useData'
import { dayHeading } from '../lib/dates'
import { TX_META } from '../lib/labels'
import { formatBaht } from '../lib/money'
import type { Transaction } from '../lib/types'

function TransactionRow({ tx, data, onOpen }: { tx: Transaction; data: AppData; onOpen: (t: Transaction) => void }) {
  const meta = TX_META[tx.type]
  const cat = tx.categoryId ? data.categoryMap.get(tx.categoryId) : undefined
  const src = tx.sourceWalletId ? data.walletMap.get(tx.sourceWalletId)?.name : undefined
  const dst = tx.destinationWalletId ? data.walletMap.get(tx.destinationWalletId)?.name : undefined

  const title = tx.type === 'transfer' ? 'โอนเงิน' : cat?.name ?? meta.label
  const walletText = tx.type === 'transfer' ? `${src} → ${dst}` : tx.type === 'income' ? dst : src

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(tx)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${meta.bg}`}
          aria-hidden
        >
          {tx.type === 'transfer' ? meta.icon : cat?.icon ?? meta.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{title}</span>
          <span className="block truncate text-xs text-slate-500">
            {walletText}
            {tx.note && ` · ${tx.note}`}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className={`block font-semibold tabular-nums ${meta.text}`}>
            {meta.sign}
            {formatBaht(tx.amount)}
          </span>
          <span className={`block text-xs ${meta.text}`}>
            {meta.icon} {meta.label}
          </span>
        </span>
      </button>
    </li>
  )
}

/** รายการจัดกลุ่มตามวัน (ต้องส่งรายการที่เรียงแล้วมา) */
export function TransactionList({
  transactions,
  data,
  onOpen,
}: {
  transactions: Transaction[]
  data: AppData
  onOpen: (t: Transaction) => void
}) {
  const groups: { date: string; items: Transaction[] }[] = []
  for (const tx of transactions) {
    const last = groups.at(-1)
    if (last?.date === tx.date) last.items.push(tx)
    else groups.push({ date: tx.date, items: [tx] })
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        let net = 0
        for (const t of g.items) net += t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0
        return (
          <section key={g.date} className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <h3 className="flex justify-between border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
              <span>{dayHeading(g.date)}</span>
              {net !== 0 && <span className="tabular-nums">{formatBaht(net, { sign: true })}</span>}
            </h3>
            <ul className="divide-y divide-slate-100">
              {g.items.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} data={data} onOpen={onOpen} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
