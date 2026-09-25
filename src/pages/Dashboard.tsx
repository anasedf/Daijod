import { useMemo, useState } from 'react'
import { defaultRange, RangePicker, resolveRange } from '../components/RangePicker'
import { TransactionList } from '../components/TransactionList'
import type { AppData } from '../hooks/useData'
import { formatDateShort } from '../lib/dates'
import { WALLET_TYPES } from '../lib/labels'
import { expenseByCategory, filterTransactions, sortNewestFirst, summarize } from '../lib/ledger'
import { formatBaht } from '../lib/money'
import type { Transaction } from '../lib/types'

function Stat({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-slate-600">
        <span aria-hidden>{icon}</span> {label}
      </div>
      <div className={`mt-1 text-lg font-bold break-all tabular-nums ${tone}`}>{formatBaht(value)}</div>
    </div>
  )
}

export function DashboardPage({
  data,
  onOpen,
  onAddWallet,
  onSeeAll,
}: {
  data: AppData
  onOpen: (t: Transaction) => void
  onAddWallet: () => void
  onSeeAll: () => void
}) {
  const [rangeValue, setRangeValue] = useState(defaultRange('month'))
  const range = resolveRange(rangeValue)

  const { sum, byCat, recent } = useMemo(() => {
    const inRange = filterTransactions(
      data.transactions,
      { range: resolveRange(rangeValue) },
      data.categoryMap,
      data.walletMap,
    )
    return {
      sum: summarize(inRange),
      byCat: expenseByCategory(inRange),
      recent: sortNewestFirst(inRange).slice(0, 5),
    }
  }, [data, rangeValue])

  if (data.wallets.length === 0) {
    return (
      <div className="card space-y-3 py-8 text-center">
        <div className="text-5xl" aria-hidden>
          👛
        </div>
        <h2 className="text-lg font-semibold">ยินดีต้อนรับสู่ ได้จด</h2>
        <p className="text-slate-600">เริ่มจากเพิ่มกระเป๋าแรก เช่น เงินสด หรือบัญชีธนาคาร พร้อมยอดเงินที่มีตอนนี้</p>
        <button className="btn-primary" onClick={onAddWallet}>
          + เพิ่มกระเป๋าแรก
        </button>
      </div>
    )
  }

  const maxCat = byCat[0]?.amount ?? 0
  const rangeLabel =
    range && range.from && range.to
      ? range.from === range.to
        ? formatDateShort(range.from)
        : `${formatDateShort(range.from)} – ${formatDateShort(range.to)}`
      : ''

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-teal-700 p-4 text-white shadow-sm">
        <div className="text-sm opacity-90">ยอดคงเหลือรวม</div>
        <div className="mt-1 text-3xl font-bold tabular-nums">{formatBaht(data.total)}</div>
        <ul className="mt-3 space-y-1 text-sm">
          {data.wallets.map((w) => (
            <li key={w.id} className="flex justify-between gap-2">
              <span className="truncate">
                <span aria-hidden>{WALLET_TYPES[w.type].icon}</span> {w.name}
              </span>
              <span className="tabular-nums">{formatBaht(data.balances.get(w.id) ?? 0)}</span>
            </li>
          ))}
        </ul>
      </section>

      <RangePicker value={rangeValue} onChange={setRangeValue} />
      {rangeLabel && <p className="-mt-2 px-1 text-xs text-slate-500">ช่วง {rangeLabel}</p>}

      <div className="grid grid-cols-2 gap-2">
        <Stat label="รายรับ" value={sum.income} tone="text-emerald-700" icon="↓" />
        <Stat label="รายจ่าย" value={sum.expense} tone="text-red-700" icon="↑" />
        <div className="card col-span-2 flex items-baseline justify-between p-3">
          <span className="text-sm text-slate-600">
            {sum.net < 0 ? 'สุทธิ (จ่ายมากกว่ารับ)' : 'สุทธิ (รับ − จ่าย)'}
          </span>
          <span className={`text-lg font-bold tabular-nums ${sum.net < 0 ? 'text-red-700' : 'text-slate-900'}`}>
            {formatBaht(sum.net, { sign: true })}
          </span>
        </div>
      </div>

      <section className="card">
        <h2 className="mb-3 font-semibold">รายจ่ายตามหมวด</h2>
        {byCat.length === 0 ? (
          <p className="text-sm text-slate-500">ไม่มีรายจ่ายในช่วงนี้</p>
        ) : (
          <ul className="space-y-3">
            {byCat.map((c) => {
              const cat = c.categoryId ? data.categoryMap.get(c.categoryId) : undefined
              const pct = sum.expense ? Math.round((c.amount / sum.expense) * 100) : 0
              return (
                <li key={c.categoryId ?? 'none'}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate">
                      <span aria-hidden>{cat?.icon ?? '❔'}</span> {cat?.name ?? 'ไม่ระบุหมวด'}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatBaht(c.amount)} <span className="text-slate-500">({pct}%)</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-slate-100" aria-hidden>
                    <div
                      className="h-2 rounded bg-rose-500"
                      style={{ width: `${Math.max(2, (c.amount / maxCat) * 100)}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="font-semibold">รายการล่าสุดในช่วงนี้</h2>
          <button className="text-sm font-medium text-teal-700" onClick={onSeeAll}>
            ดูทั้งหมด →
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="card text-center text-slate-500">ยังไม่มีรายการในช่วงนี้ กดปุ่ม + เพื่อจด</p>
        ) : (
          <TransactionList transactions={recent} data={data} onOpen={onOpen} />
        )}
      </section>
    </div>
  )
}
