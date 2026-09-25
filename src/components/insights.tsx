// การ์ดวิเคราะห์ที่ใช้ร่วมกันระหว่างหน้าสถิติและหน้าแรก
import { useMemo, type ReactNode } from 'react'
import type { Tab } from '../App'
import type { AppData } from '../hooks/useData'
import { budgetSummary } from '../lib/budget'
import { formatDateShort, todayISO, toISODate, type DateRange } from '../lib/dates'
import type { CategoryTotal } from '../lib/ledger'
import { loanBalances, loanCategoryIds, type LoanBalance } from '../lib/loans'
import { formatBaht } from '../lib/money'
import { compareMonths, monthLabel, monthlyTotals } from '../lib/trend'
import { MonthlyChart } from './Charts'
import { CategoryIcon } from './ui'

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div>
        <h2 className="card-title">{title}</h2>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatTile({
  label,
  value,
  icon,
  tone,
  hint,
}: {
  label: string
  value: ReactNode
  icon: ReactNode
  tone: string
  hint?: string
}) {
  return (
    <div className="card h-full p-5">
      <div className="flex items-center gap-2 text-sm text-ink-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`} aria-hidden>
          {icon}
        </span>
        {label}
      </div>
      <div className="num mt-3 text-2xl font-semibold tracking-tight break-all xl:text-[1.7rem]">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  )
}

/** ช่วงของกราฟรายวัน: ใช้ช่วงที่เลือกถ้าอยู่ระหว่าง 2–62 วัน ไม่งั้นแสดง 30 วันล่าสุด */
export function chartRange(range: Partial<DateRange> | undefined): DateRange {
  if (range?.from && range.to && range.from !== range.to) {
    const days = (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000
    if (days <= 62) return { from: range.from, to: range.to }
  }
  const from = new Date()
  from.setDate(from.getDate() - 29)
  return { from: toISODate(from), to: todayISO() }
}

// ---------- รายจ่ายตามหมวด (วงแหวนบนการ์ดเข้ม) ----------

const RING_LIMIT = 5
const OTHER_COLOR = '#9a9aa6'

export function categorySlices(byCat: CategoryTotal[], data: AppData, limit = RING_LIMIT) {
  const top = byCat.slice(0, limit).map((c) => {
    const cat = c.categoryId ? data.categoryMap.get(c.categoryId) : undefined
    return { key: c.categoryId ?? 'none', cat, name: cat?.name ?? 'ไม่ระบุหมวด', color: cat?.color ?? OTHER_COLOR, amount: c.amount }
  })
  const rest = byCat.slice(limit).reduce((s, c) => s + c.amount, 0)
  if (rest > 0) top.push({ key: 'rest', cat: undefined, name: `หมวดอื่น (${byCat.length - limit})`, color: OTHER_COLOR, amount: rest })
  return top
}

function ringGradient(slices: { color: string; amount: number }[]) {
  const total = slices.reduce((s, x) => s + x.amount, 0)
  let cursor = 0
  const stops = slices
    .filter((s) => s.amount > 0)
    .map((s) => {
      const start = cursor
      cursor += (s.amount / total) * 100
      return `${s.color} ${start}% ${cursor}%`
    })
  return `conic-gradient(${stops.join(', ')})`
}

export function CategoryRingCard({ byCat, total, data, subtitle, className = '' }: { byCat: CategoryTotal[]; total: number; data: AppData; subtitle?: string; className?: string }) {
  const slices = categorySlices(byCat, data)
  return (
    <section className={`deep-card card ${className}`}>
      <CardHeader title="รายจ่ายตามหมวด" subtitle={subtitle} />
      {byCat.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-muted">ไม่มีรายจ่ายในช่วงนี้</p>
      ) : (
        <div className="flex flex-col items-center gap-6 px-5 pt-2 pb-6 sm:flex-row">
          <div
            className="grid h-44 w-44 shrink-0 place-items-center rounded-full"
            role="img"
            aria-label={`รายจ่ายรวม ${formatBaht(total)}`}
            style={{ background: ringGradient(slices) }}
          >
            <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-deep">
              <span className="text-xs text-muted">รายจ่ายรวม</span>
              <span className="num mt-1 text-lg font-semibold">{formatBaht(total)}</span>
            </div>
          </div>
          <ul className="grid w-full min-w-0 grid-cols-2 gap-x-4 gap-y-3.5">
            {slices.map((s) => (
              <li key={s.key} className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                  <span className="truncate">{s.name}</span>
                </div>
                <div className="num mt-0.5 text-sm font-medium">
                  {formatBaht(s.amount)}
                  <span className="ml-1 text-xs font-normal text-muted">{Math.round((s.amount / total) * 100)}%</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// ---------- 6 เดือนย้อนหลัง ----------

export function TrendCard({ data, className = '' }: { data: AppData; className?: string }) {
  const { months, cmp } = useMemo(() => {
    const today = todayISO()
    const ex = loanCategoryIds(data.categories)
    return {
      months: monthlyTotals(data.transactions, today, 6, ex),
      cmp: compareMonths(data.transactions, data.categoryMap, today, ex),
    }
  }, [data])
  if (months.every((m) => m.income === 0 && m.expense === 0)) return null

  const up = cmp.expenseDiff > 0
  const pct = cmp.expensePct !== null ? `${Math.abs(Math.round(cmp.expensePct * 100))}%` : null
  const name = (c: typeof cmp.biggestIncrease) => c?.category?.name ?? 'ไม่ระบุหมวด'

  return (
    <section className={`card ${className}`}>
      <CardHeader title="6 เดือนย้อนหลัง" subtitle={`${monthLabel(months[0].month, true)} – ${monthLabel(months.at(-1)!.month, true)}`} />
      <div className="px-5 pt-3 pb-5">
        <MonthlyChart months={months} />
        <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
          <p>
            เดือนนี้จ่าย{' '}
            {cmp.expenseDiff === 0 ? (
              'เท่ากับเดือนก่อน'
            ) : (
              <>
                <b className={up ? 'text-expense' : 'text-income'}>
                  {up ? 'มากกว่า' : 'น้อยกว่า'}เดือนก่อน {formatBaht(Math.abs(cmp.expenseDiff))}
                </b>
                {pct && <span className="text-muted"> ({pct})</span>}
              </>
            )}
          </p>
          {(cmp.biggestIncrease || cmp.biggestDecrease) && (
            <p className="text-ink-2">
              {cmp.biggestIncrease && (
                <>
                  เพิ่มมากสุด <b className="text-ink">{name(cmp.biggestIncrease)}</b>{' '}
                  <span className="num text-expense">+{formatBaht(cmp.biggestIncrease.diff)}</span>
                </>
              )}
              {cmp.biggestIncrease && cmp.biggestDecrease && <span className="text-muted"> · </span>}
              {cmp.biggestDecrease && (
                <>
                  ลดมากสุด <b className="text-ink">{name(cmp.biggestDecrease)}</b>{' '}
                  <span className="num text-income">−{formatBaht(-cmp.biggestDecrease.diff)}</span>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

// ---------- งบประมาณ ----------

export function BudgetBar({ ratio }: { ratio: number }) {
  const tone = ratio >= 1 ? 'bg-expense' : ratio >= 0.8 ? 'bg-sun' : 'bg-chart'
  return (
    <div className="mt-1.5 h-2 rounded-full bg-chart-track" aria-hidden>
      <div className={`h-2 rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(1.5, ratio * 100))}%` }} />
    </div>
  )
}

export function BudgetCard({ data, onNavigate, className = '' }: { data: AppData; onNavigate: (tab: Tab) => void; className?: string }) {
  const summary = useMemo(() => budgetSummary(data.categories, data.transactions, todayISO()), [data])
  const hasExpenseCats = data.categories.some((c) => c.type === 'expense')
  if (summary.items.length === 0) {
    if (!hasExpenseCats) return null
    return (
      <section className={`card flex flex-col ${className}`}>
        <CardHeader title="งบประมาณเดือนนี้" />
        <div className="px-5 pb-5 text-sm text-ink-2">
          ยังไม่ได้ตั้งงบ ไปที่ตั้งค่า → แตะหมวดรายจ่าย → ใส่ “งบต่อเดือน” แล้วที่นี่จะบอกว่าใช้ไปเท่าไหร่ เหลือใช้ได้วันละเท่าไหร่
          <div className="mt-3">
            <button className="btn-secondary min-h-9 px-3 text-sm" onClick={() => onNavigate('settings')}>
              ตั้งงบประมาณ
            </button>
          </div>
        </div>
      </section>
    )
  }

  const totalRatio = summary.totalBudget ? summary.totalSpent / summary.totalBudget : 0
  const totalLeft = summary.totalBudget - summary.totalSpent
  return (
    <section className={`card ${className}`}>
      <CardHeader
        title="งบประมาณเดือนนี้"
        subtitle={`เหลืออีก ${summary.daysLeft} วัน · ${totalLeft >= 0 ? `เหลือ ${formatBaht(totalLeft)}` : `เกินงบ ${formatBaht(-totalLeft)}`}`}
      />
      <div className="px-5 pb-5">
        <div className="mb-4">
          <div className="flex justify-between text-sm">
            <span className="font-medium">รวมทุกหมวด</span>
            <span className="num">
              {formatBaht(summary.totalSpent)} <span className="text-muted">/ {formatBaht(summary.totalBudget)}</span>
            </span>
          </div>
          <BudgetBar ratio={totalRatio} />
        </div>
        <ul className="space-y-3.5">
          {summary.items.map((b) => (
            <li key={b.category.id}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <CategoryIcon category={b.category} size="sm" />
                  <span className="truncate">{b.category.name}</span>
                </span>
                <span className={`num shrink-0 ${b.remaining < 0 ? 'font-semibold text-expense' : ''}`}>
                  {b.remaining < 0 ? `เกิน ${formatBaht(-b.remaining)}` : `เหลือ ${formatBaht(b.remaining)}`}
                </span>
              </div>
              <BudgetBar ratio={b.ratio} />
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span className="num">
                  {formatBaht(b.spent)} / {formatBaht(b.budget)} ({Math.round(b.ratio * 100)}%)
                </span>
                {b.perDay !== null && <span className="num">ใช้ได้วันละ {formatBaht(b.perDay)}</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ---------- เงินยืม ----------

/** ใครติดเรา เราติดใคร (จากหมวดให้ยืม/ได้รับคืน/ยืมมา/จ่ายคืน ชื่อคนอยู่ในรายละเอียด) แสดงเฉพาะเมื่อมียอดค้าง */
export function LoanCard({ data, className = '' }: { data: AppData; className?: string }) {
  const balances = useMemo(() => loanBalances(data.transactions, data.categories), [data])
  if (balances.length === 0) return null
  const owedToMe = balances.filter((b) => b.owedToMe > 0)
  const iOwe = balances.filter((b) => b.iOwe > 0)
  const totalIn = owedToMe.reduce((s, b) => s + b.owedToMe, 0)
  const totalOut = iOwe.reduce((s, b) => s + b.iOwe, 0)
  const subtitle = [totalIn > 0 && `เขาติดเรา ${formatBaht(totalIn)}`, totalOut > 0 && `เราติดเขา ${formatBaht(totalOut)}`]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className={`card ${className}`}>
      <CardHeader title="เงินยืม" subtitle={subtitle} />
      <div className="grid gap-5 px-5 pb-5 sm:grid-cols-2">
        {owedToMe.length > 0 && <LoanList title="เขาติดเรา" items={owedToMe} pick={(b) => b.owedToMe} tone="text-income" />}
        {iOwe.length > 0 && <LoanList title="เราติดเขา" items={iOwe} pick={(b) => b.iOwe} tone="text-expense" />}
      </div>
    </section>
  )
}

function LoanList({ title, items, pick, tone }: { title: string; items: LoanBalance[]; pick: (b: LoanBalance) => number; tone: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs font-semibold text-muted">
        <span>{title}</span>
        <span className={`num ${tone}`}>{formatBaht(items.reduce((s, b) => s + pick(b), 0))}</span>
      </div>
      <ul className="divide-y divide-line/70">
        {items.map((b) => (
          <li key={b.name} className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium">{b.name}</span>
              <span className="block text-xs text-muted">
                {b.count} รายการ · ล่าสุด {formatDateShort(b.lastDate)}
              </span>
            </span>
            <span className={`num shrink-0 font-semibold ${tone}`}>{formatBaht(pick(b))}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
