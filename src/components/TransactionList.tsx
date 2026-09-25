import type { AppData } from '../hooks/useData'
import { dayHeading } from '../lib/dates'
import { TX_META } from '../lib/labels'
import { formatBaht } from '../lib/money'
import type { Transaction } from '../lib/types'

export function TxIcon({ tx, data }: { tx: Transaction; data: AppData }) {
  const meta = TX_META[tx.type]
  const cat = tx.categoryId ? data.categoryMap.get(tx.categoryId) : undefined
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${meta.soft}`} aria-hidden>
      {tx.type !== 'transfer' && cat ? cat.icon : <meta.Icon size={18} className={meta.text} strokeWidth={2.2} />}
    </span>
  )
}

function TransactionRow({ tx, data, onOpen }: { tx: Transaction; data: AppData; onOpen: (t: Transaction) => void }) {
  const meta = TX_META[tx.type]
  const cat = tx.categoryId ? data.categoryMap.get(tx.categoryId) : undefined
  const src = tx.sourceWalletId ? data.walletMap.get(tx.sourceWalletId) : undefined
  const dst = tx.destinationWalletId ? data.walletMap.get(tx.destinationWalletId) : undefined

  const title = tx.type === 'transfer' ? 'โอนเงิน' : cat?.name ?? meta.label
  const walletText = tx.type === 'transfer' ? `${src?.name} → ${dst?.name}` : (tx.type === 'income' ? dst : src)?.name
  const walletColor = (tx.type === 'income' ? dst : src)?.color

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(tx)}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sunken/60 md:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)_auto] md:px-5"
      >
        <TxIcon tx={tx} data={data} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{title}</span>
          <span className="block truncate text-sm text-muted">
            <span className="md:hidden">
              {walletText}
              {tx.note && ' · '}
            </span>
            {tx.note || <span className="hidden md:inline">—</span>}
          </span>
        </span>
        <span className="hidden min-w-0 items-center gap-2 text-sm text-ink-2 md:flex">
          {tx.type !== 'transfer' && (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: walletColor }} aria-hidden />
          )}
          <span className="truncate">{walletText}</span>
        </span>
        <span className="text-right">
          <span className={`num block font-semibold ${tx.type === 'transfer' ? 'text-ink-2' : meta.text}`}>
            {meta.sign}
            {formatBaht(tx.amount)}
          </span>
          <span className="block text-xs text-muted">{meta.label}</span>
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
  flat = false,
}: {
  transactions: Transaction[]
  data: AppData
  onOpen: (t: Transaction) => void
  /** ไม่ใส่กรอบการ์ด (ใช้ภายในการ์ดอื่น) */
  flat?: boolean
}) {
  const groups: { date: string; items: Transaction[] }[] = []
  for (const tx of transactions) {
    const last = groups.at(-1)
    if (last?.date === tx.date) last.items.push(tx)
    else groups.push({ date: tx.date, items: [tx] })
  }

  return (
    <div className={flat ? '' : 'space-y-4'}>
      {groups.map((g) => {
        let net = 0
        for (const t of g.items) net += t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0
        return (
          <section key={g.date} className={flat ? '' : 'card overflow-hidden'}>
            <h3 className="flex justify-between bg-sunken/50 px-4 py-2 text-xs font-semibold text-muted md:px-5">
              <span>{dayHeading(g.date)}</span>
              {net !== 0 && <span className="num">{formatBaht(net, { sign: true })}</span>}
            </h3>
            <ul className="divide-y divide-line/70">
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
