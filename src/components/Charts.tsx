import { useState } from 'react'
import type { AppData } from '../hooks/useData'
import { formatDateShort, toISODate, type DateRange } from '../lib/dates'
import type { CategoryTotal } from '../lib/ledger'
import { formatBaht } from '../lib/money'
import type { Transaction } from '../lib/types'
import { CategoryIcon } from './ui'

function parseISO(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** รายการวันที่ทุกวันในช่วง (รวมหัวท้าย) */
function eachDay(range: DateRange): string[] {
  const out: string[] = []
  const d = parseISO(range.from)
  const end = parseISO(range.to)
  while (d <= end && out.length < 400) {
    out.push(toISODate(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

/** เพดานแกนที่อ่านง่าย เช่น 1,000 / 2,500 / 5,000 */
function niceMax(v: number): number {
  if (v <= 0) return 100_00
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= v) return m * exp
  return 10 * exp
}

function compactBaht(satang: number): string {
  const baht = satang / 100
  if (baht >= 1_000_000) return `${+(baht / 1_000_000).toFixed(1)}M`
  if (baht >= 1_000) return `${+(baht / 1_000).toFixed(1)}k`
  return String(Math.round(baht))
}

/** กราฟแท่งรายจ่ายรายวัน (ชุดเดียว สีเดียว) */
export function DailyExpenseChart({ transactions, range }: { transactions: Transaction[]; range: DateRange }) {
  const [hover, setHover] = useState<number | null>(null)
  const days = eachDay(range)
  const totals = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.type === 'expense') totals.set(tx.date, (totals.get(tx.date) ?? 0) + tx.amount)
  }
  const values = days.map((d) => totals.get(d) ?? 0)
  const max = niceMax(Math.max(...values))
  const ticks = [max, max / 2, 0]
  const labelEvery = days.length > 20 ? 7 : days.length > 10 ? 3 : 1
  const h = hover !== null ? { date: days[hover], value: values[hover], left: ((hover + 0.5) / days.length) * 100 } : null

  return (
    <figure className="m-0">
      <div className="flex gap-2">
        {/* แกน Y */}
        <div className="num flex h-40 flex-col justify-between py-0 text-right text-[0.7rem] text-muted" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
              {compactBaht(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {/* เส้นกริด */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-40 flex-col justify-between" aria-hidden>
            <div className="border-t border-dashed border-line" />
            <div className="border-t border-dashed border-line" />
            <div className="border-t border-line" />
          </div>
          {/* แท่ง */}
          <div className="relative flex h-40 items-end" onMouseLeave={() => setHover(null)}>
            {values.map((v, i) => (
              <div
                key={days[i]}
                className="flex h-full flex-1 items-end justify-center px-[1px]"
                onMouseEnter={() => setHover(i)}
                onClick={() => setHover(i)}
              >
                <div
                  className={`w-full max-w-7 rounded-t-[4px] transition-opacity ${
                    hover !== null && hover !== i ? 'opacity-45' : ''
                  } ${v > 0 ? 'bg-chart' : ''}`}
                  style={{ height: v > 0 ? `max(3px, ${(v / max) * 100}%)` : 0 }}
                />
              </div>
            ))}
            {h && (
              <div
                className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-canvas shadow-lg"
                style={{ left: `clamp(3.5rem, ${h.left}%, calc(100% - 3.5rem))` }}
                role="status"
              >
                <div className="opacity-70">{formatDateShort(h.date)}</div>
                <div className="num font-semibold">{formatBaht(h.value)}</div>
              </div>
            )}
          </div>
          {/* แกน X */}
          <div className="mt-1.5 flex text-[0.7rem] text-muted" aria-hidden>
            {days.map((d, i) => (
              <span key={d} className="num flex-1 text-center">
                {i % labelEvery === 0 ? parseISO(d).getDate() : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="sr-only">
        รายจ่ายรายวัน {formatDateShort(range.from)} ถึง {formatDateShort(range.to)}:{' '}
        {days
          .map((d, i) => (values[i] ? `${formatDateShort(d)} ${formatBaht(values[i])}` : ''))
          .filter(Boolean)
          .join(', ') || 'ไม่มีรายจ่าย'}
      </figcaption>
    </figure>
  )
}

/** รายจ่ายตามหมวด: แท่งแนวนอนสีเดียว เรียงมากไปน้อย เกิน 6 หมวดรวมเป็น "อื่น ๆ" */
export function CategoryBars({ totals, total, data }: { totals: CategoryTotal[]; total: number; data: AppData }) {
  const LIMIT = 6
  const rows = totals.slice(0, LIMIT).map((c) => {
    const cat = c.categoryId ? data.categoryMap.get(c.categoryId) : undefined
    return { key: c.categoryId ?? 'none', cat, icon: '❔', name: cat?.name ?? 'ไม่ระบุหมวด', amount: c.amount }
  })
  const rest = totals.slice(LIMIT).reduce((s, c) => s + c.amount, 0)
  if (rest > 0) rows.push({ key: 'rest', cat: undefined, icon: '⋯', name: `หมวดอื่น (${totals.length - LIMIT})`, amount: rest })
  const max = rows[0]?.amount ?? 0

  return (
    <ul className="space-y-3.5">
      {rows.map((r) => {
        const pct = total ? Math.round((r.amount / total) * 100) : 0
        return (
          <li key={r.key} title={`${r.name}: ${formatBaht(r.amount)} (${pct}%)`}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <CategoryIcon category={r.cat} size="sm" fallback={r.icon} />
                <span className="truncate">{r.name}</span>
              </span>
              <span className="num shrink-0 font-medium">
                {formatBaht(r.amount)} <span className="font-normal text-muted">{pct}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-chart-track" aria-hidden>
              <div
                className="h-2 rounded-full bg-chart"
                style={{ width: `${Math.max(1.5, (r.amount / max) * 100)}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
