import { ArrowDownLeft, ArrowUpRight, ChevronRight, Download, HardDrive, ReceiptText, Scale, Wallet, Zap } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { Tab } from '../App'
import { DailyExpenseChart, MonthlyChart } from '../components/Charts'
import { defaultRange, RangePicker, rangeLabel, resolveRange } from '../components/RangePicker'
import { TransactionList } from '../components/TransactionList'
import { CategoryIcon, EmptyState, errorMessage, PageHeader, useToast, WalletIcon } from '../components/ui'
import type { AppData } from '../hooks/useData'
import { formatDateLong, formatDateShort, todayISO, toISODate, type DateRange } from '../lib/dates'
import { backupReminder, downloadBackup, snoozeBackupReminder } from '../lib/backup'
import { budgetSummary } from '../lib/budget'
import { addTransaction, db, postRecurring, skipRecurring } from '../lib/db'
import { TX_META } from '../lib/labels'
import { dueRecurrings } from '../lib/recurring'
import { expenseByCategory, filterTransactions, sortNewestFirst, summarize } from '../lib/ledger'
import { formatBaht } from '../lib/money'
import { loanBalances, loanCategoryIds, type LoanBalance } from '../lib/loans'
import { suggestQuickAdds, type QuickAdd } from '../lib/quick'
import { compareMonths, monthLabel, monthlyTotals } from '../lib/trend'
import type { Recurring, Transaction } from '../lib/types'

/** รายการประจำที่ถึงกำหนดแล้วในเดือนนี้: บันทึกหรือข้าม */
function DueRecurrings({ data, onOpen }: { data: AppData; onOpen: (t: Transaction) => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const due = useMemo(() => dueRecurrings(data.recurrings, todayISO()), [data.recurrings])
  if (due.length === 0) return null

  async function post(rec: Recurring, date: string) {
    setBusy(rec.id)
    try {
      const id = await postRecurring(rec, date)
      toast(`บันทึก ${rec.name} ${formatBaht(rec.amount)} แล้ว`, 'success', {
        label: 'แก้ไข',
        onClick: async () => {
          const t = await db.transactions.get(id)
          if (t) onOpen(t)
        },
      })
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function skip(rec: Recurring, date: string) {
    setBusy(rec.id)
    try {
      await skipRecurring(rec.id, date.slice(0, 7))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="card lg:col-span-12" aria-label="รายการประจำถึงกำหนด">
      <CardHeader title="รายการประจำถึงกำหนด" subtitle={`${due.length} รายการรอบันทึก`} />
      <ul className="divide-y divide-line/70 border-t border-line/70">
        {due.map(({ rec, date }) => {
          const meta = TX_META[rec.type]
          const cat = rec.categoryId ? data.categoryMap.get(rec.categoryId) : undefined
          const wallet = data.walletMap.get(rec.type === 'income' ? rec.destinationWalletId! : rec.sourceWalletId!)
          return (
            <li key={rec.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
              <CategoryIcon category={cat} size="md" fallback={<meta.Icon size={18} className={meta.text} />} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{rec.name}</span>
                <span className="block text-xs text-muted">
                  ครบกำหนด {formatDateShort(date)} · {wallet?.name}
                </span>
              </span>
              <span className={`num font-semibold ${rec.type === 'transfer' ? 'text-ink-2' : meta.text}`}>
                {meta.sign}
                {formatBaht(rec.amount)}
              </span>
              <span className="flex gap-2">
                <button className="btn-ghost min-h-9 px-3 text-sm" disabled={busy !== null} onClick={() => skip(rec, date)}>
                  ข้ามเดือนนี้
                </button>
                <button className="btn-primary min-h-9 px-3 text-sm" disabled={busy !== null} onClick={() => post(rec, date)}>
                  บันทึก
                </button>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** เงินยืม: ใครติดเรา เราติดใคร (จากหมวดให้ยืม/ได้รับคืน/ยืมมา/จ่ายคืน ชื่อคนอยู่ในรายละเอียด) */
function LoanCard({ data }: { data: AppData }) {
  const balances = useMemo(() => loanBalances(data.transactions, data.categories), [data])
  const hasLoanTx = useMemo(() => {
    const ids = loanCategoryIds(data.categories)
    return data.transactions.some((t) => t.categoryId && ids.has(t.categoryId))
  }, [data])
  if (!hasLoanTx) return null
  const owedToMe = balances.filter((b) => b.owedToMe > 0)
  const iOwe = balances.filter((b) => b.iOwe > 0)
  const totalIn = owedToMe.reduce((s, b) => s + b.owedToMe, 0)
  const totalOut = iOwe.reduce((s, b) => s + b.iOwe, 0)
  const subtitle = balances.length === 0
    ? 'เคลียร์หมดแล้ว'
    : [totalIn > 0 && `เขาติดเรา ${formatBaht(totalIn)}`, totalOut > 0 && `เราติดเขา ${formatBaht(totalOut)}`].filter(Boolean).join(' · ')

  return (
    <section className="card lg:col-span-6">
      <CardHeader title="เงินยืม" subtitle={subtitle} />
      <div className="grid gap-5 px-5 pb-5 sm:grid-cols-2">
        <LoanList title="เขาติดเรา" items={owedToMe} pick={(b) => b.owedToMe} tone="text-income" />
        <LoanList title="เราติดเขา" items={iOwe} pick={(b) => b.iOwe} tone="text-expense" />
      </div>
      <p className="border-t border-line/70 px-5 py-2.5 text-xs text-muted">
        จดด้วยหมวด ให้ยืม / ได้รับคืน / ยืมมา / จ่ายคืน แล้วใส่ชื่อคนในช่องรายละเอียด รายการเหล่านี้ไม่นับเป็นรายรับรายจ่าย
      </p>
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
      {items.length === 0 ? (
        <p className="text-sm text-muted">ไม่มี</p>
      ) : (
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
      )}
    </div>
  )
}

/** 6 เดือนย้อนหลัง + เดือนนี้เทียบเดือนก่อน */
function TrendCard({ data }: { data: AppData }) {
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
    <section className="card lg:col-span-6">
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

/** งบประมาณของเดือนปัจจุบัน: ใช้ไปกี่ % เหลือเท่าไหร่ ควรใช้วันละเท่าไหร่ */
function BudgetCard({ data, onNavigate }: { data: AppData; onNavigate: (tab: Tab) => void }) {
  const summary = useMemo(() => budgetSummary(data.categories, data.transactions, todayISO()), [data])
  const hasExpenseCats = data.categories.some((c) => c.type === 'expense')
  if (summary.items.length === 0) {
    if (!hasExpenseCats) return null
    return (
      <section className="card flex flex-col lg:col-span-6">
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
    <section className="card lg:col-span-6">
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

function BudgetBar({ ratio }: { ratio: number }) {
  const tone = ratio >= 1 ? 'bg-expense' : ratio >= 0.8 ? 'bg-amber-500' : 'bg-chart'
  return (
    <div className="mt-1.5 h-2 rounded-full bg-chart-track" aria-hidden>
      <div className={`h-2 rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(1.5, ratio * 100))}%` }} />
    </div>
  )
}

/** แถบเตือนให้สำรองข้อมูล เมื่อไม่เคยสำรองหรือสำรองนานแล้ว */
function BackupBanner({ data }: { data: AppData }) {
  const toast = useToast()
  const [tick, setTick] = useState(0)
  const reminder = useMemo(() => backupReminder(data.transactions), [data.transactions, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!reminder) return null

  async function download() {
    try {
      await downloadBackup()
      toast('ดาวน์โหลดไฟล์สำรองแล้ว เก็บไว้ที่อื่นด้วยนะ (เช่น Google Drive)')
      setTick((t) => t + 1)
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-brand/30 bg-brand-soft/60 px-4 py-3 text-sm lg:col-span-12">
      <span className="flex items-center gap-2 text-ink">
        <HardDrive size={18} className="shrink-0 text-brand" aria-hidden />
        {reminder.reason === 'never'
          ? `มี ${data.transactions.length} รายการแล้ว แต่ยังไม่เคยสำรองข้อมูล ถ้าเครื่องหายหรือล้างเบราว์เซอร์ ข้อมูลจะหายทั้งหมด`
          : `สำรองข้อมูลล่าสุดเมื่อ ${reminder.days} วันก่อน และมีรายการใหม่หลังจากนั้น`}
      </span>
      <span className="ml-auto flex gap-2">
        <button
          type="button"
          className="btn-ghost min-h-9 px-3 text-sm"
          onClick={() => {
            snoozeBackupReminder()
            setTick((t) => t + 1)
          }}
        >
          ไว้ก่อน
        </button>
        <button type="button" className="btn-primary min-h-9 px-3 text-sm" onClick={download}>
          <Download size={16} aria-hidden /> สำรองตอนนี้
        </button>
      </span>
    </div>
  )
}

/** ปุ่มลัด: รายการที่จดบ่อย แตะเดียวบันทึกเลย (แก้ได้จากปุ่มบน toast) */
function QuickAdds({ data, onOpen }: { data: AppData; onOpen: (t: Transaction) => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const items = useMemo(() => suggestQuickAdds(data.transactions, { today: todayISO() }), [data.transactions])
  const valid = items.filter((q) => data.walletMap.has(q.walletId))
  if (valid.length === 0) return null

  async function add(q: QuickAdd) {
    setBusy(q.key)
    try {
      const id = await addTransaction({
        type: q.type,
        amount: q.amount,
        date: todayISO(),
        note: q.note,
        categoryId: q.categoryId,
        sourceWalletId: q.type === 'expense' ? q.walletId : undefined,
        destinationWalletId: q.type === 'income' ? q.walletId : undefined,
      })
      toast(`บันทึก ${q.note || data.categoryMap.get(q.categoryId ?? '')?.name} ${formatBaht(q.amount)} แล้ว`, 'success', {
        label: 'แก้ไข',
        onClick: async () => {
          const t = await db.transactions.get(id)
          if (t) onOpen(t)
        },
      })
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-label="จดเร็ว" className="lg:col-span-12">
      <div className="mb-2 flex items-center gap-1.5 px-1 text-sm font-medium text-ink-2">
        <Zap size={16} className="text-brand" aria-hidden /> จดเร็ว
        <span className="text-xs font-normal text-muted">· แตะเพื่อจดเป็นของวันนี้</span>
      </div>
      <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {valid.map((q) => {
          const cat = q.categoryId ? data.categoryMap.get(q.categoryId) : undefined
          const wallet = data.walletMap.get(q.walletId)!
          return (
            <li key={q.key} className="shrink-0">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => add(q)}
                className="card flex items-center gap-2.5 rounded-2xl py-2 pr-3.5 pl-2 text-left transition-colors hover:bg-sunken disabled:opacity-60"
              >
                <CategoryIcon category={cat} size="sm" fallback={q.type === 'income' ? '+' : '−'} />
                <span className="min-w-0">
                  <span className="block max-w-36 truncate text-sm font-medium">{q.note || cat?.name}</span>
                  <span className="block text-xs text-muted">
                    <span className={`num ${q.type === 'income' ? 'text-income' : ''}`}>
                      {q.type === 'income' ? '+' : '−'}
                      {formatBaht(q.amount)}
                    </span>{' '}
                    · {wallet.name}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function StatTile({
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

function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
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

/** ช่วงของกราฟรายวัน: ใช้ช่วงที่เลือกถ้าอยู่ระหว่าง 2–62 วัน ไม่งั้นแสดง 30 วันล่าสุด */
function chartRange(range: Partial<DateRange> | undefined): DateRange {
  if (range?.from && range.to && range.from !== range.to) {
    const days = (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000
    if (days <= 62) return { from: range.from, to: range.to }
  }
  const from = new Date()
  from.setDate(from.getDate() - 29)
  return { from: toISODate(from), to: todayISO() }
}

/** วงแหวนรายจ่ายตามหมวด: ใช้สีของหมวดแต่ละหมวด (ไม่เกิน 5 หมวด ที่เหลือรวมเป็น "อื่น ๆ") */
const RING_LIMIT = 5
const OTHER_COLOR = '#9a9aa6'
function ringSlices(byCat: { categoryId: string | null; amount: number }[], data: AppData) {
  const top = byCat.slice(0, RING_LIMIT).map((c) => {
    const cat = c.categoryId ? data.categoryMap.get(c.categoryId) : undefined
    return { key: c.categoryId ?? 'none', name: cat?.name ?? 'ไม่ระบุหมวด', color: cat?.color ?? OTHER_COLOR, amount: c.amount }
  })
  const rest = byCat.slice(RING_LIMIT).reduce((s, c) => s + c.amount, 0)
  if (rest > 0) top.push({ key: 'rest', name: `หมวดอื่น (${byCat.length - RING_LIMIT})`, color: OTHER_COLOR, amount: rest })
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

export function DashboardPage({
  data,
  onOpen,
  onAddWallet,
  onNavigate,
}: {
  data: AppData
  onOpen: (t: Transaction) => void
  onAddWallet: () => void
  onNavigate: (tab: Tab) => void
}) {
  const [rangeValue, setRangeValue] = useState(defaultRange('month'))
  const range = resolveRange(rangeValue)

  const { inRange, sum, byCat, recent, daily, loanIds } = useMemo(() => {
    const r = resolveRange(rangeValue)
    const loanIds = loanCategoryIds(data.categories)
    const notLoan = (t: Transaction) => !t.categoryId || !loanIds.has(t.categoryId)
    const inRange = filterTransactions(data.transactions, { range: r }, data.categoryMap, data.walletMap)
    const daily = chartRange(r)
    return {
      inRange,
      loanIds,
      sum: summarize(inRange, undefined, loanIds),
      byCat: expenseByCategory(inRange, undefined, loanIds),
      recent: sortNewestFirst(inRange).slice(0, 6),
      daily: {
        range: daily,
        txs: filterTransactions(data.transactions, { range: daily }, data.categoryMap, data.walletMap).filter(notLoan),
      },
    }
  }, [data, rangeValue])

  if (data.wallets.length === 0) {
    return (
      <>
        <PageHeader title="ยินดีต้อนรับ" subtitle={formatDateLong(todayISO())} />
        <div className="card mx-auto max-w-lg">
          <EmptyState
            icon={Wallet}
            title="เริ่มจากเพิ่มกระเป๋าแรก"
            action={
              <button className="btn-primary" onClick={onAddWallet}>
                เพิ่มกระเป๋าแรก
              </button>
            }
          >
            กระเป๋าคือที่เก็บเงิน เช่น เงินสด บัญชีธนาคาร หรือ e-Wallet ใส่ยอดเงินที่มีตอนนี้ แล้วเริ่มจดรายรับรายจ่ายได้เลย
          </EmptyState>
        </div>
      </>
    )
  }

  const count = inRange.filter((t) => t.type !== 'transfer' && !(t.categoryId && loanIds.has(t.categoryId))).length
  const dailyIsSelected = daily.range.from === range?.from && daily.range.to === range?.to

  return (
    <>
      <PageHeader
        title="ภาพรวม"
        subtitle={formatDateLong(todayISO())}
        actions={<RangePicker value={rangeValue} onChange={setRangeValue} className="w-full sm:w-auto sm:justify-end" />}
      />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <BackupBanner data={data} />
        <DueRecurrings data={data} onOpen={onOpen} />
        <QuickAdds data={data} onOpen={onOpen} />

        {/* ยอดคงเหลือรวม + กระเป๋า */}
        <section className="hero-card relative overflow-hidden rounded-3xl p-5 sm:p-6 lg:col-span-5 lg:row-span-2">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-sm opacity-90">
              <Wallet size={18} aria-hidden /> ยอดคงเหลือรวม
            </span>
            <span className="rounded-full bg-white/18 px-3 py-1 text-xs">{data.wallets.length} กระเป๋า</span>
          </div>
          <div className="num mt-6 text-4xl font-semibold tracking-tight break-words sm:text-5xl lg:mt-8">{formatBaht(data.total)}</div>

          <ul className="no-scrollbar -mx-5 mt-6 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:mt-8 lg:block lg:space-y-2">
            {data.wallets.map((w) => {
              const bal = data.balances.get(w.id) ?? 0
              return (
                <li
                  key={w.id}
                  className="flex min-w-44 shrink-0 items-center gap-2.5 rounded-2xl bg-white/14 px-3 py-2.5 backdrop-blur-sm sm:min-w-0"
                >
                  <WalletIcon wallet={w} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm">{w.name}</span>
                  <span className={`num shrink-0 text-sm font-semibold ${bal < 0 ? 'text-sun' : ''}`}>{formatBaht(bal)}</span>
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            onClick={() => onNavigate('wallets')}
            className="mt-5 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-medium text-on-brand"
          >
            จัดการกระเป๋า <ChevronRight size={15} aria-hidden />
          </button>
        </section>

        {/* ตัวเลขสรุป */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-7 lg:gap-4">
          <StatTile
            label="รายรับ"
            value={formatBaht(sum.income)}
            tone="bg-income-soft text-income"
            icon={<ArrowDownLeft size={16} strokeWidth={2.4} />}
          />
          <StatTile
            label="รายจ่าย"
            value={formatBaht(sum.expense)}
            tone="bg-expense-soft text-expense"
            icon={<ArrowUpRight size={16} strokeWidth={2.4} />}
          />
          <div className="col-span-2 sm:col-span-1">
            <StatTile
              label={sum.net < 0 ? 'สุทธิ (จ่ายเกิน)' : 'สุทธิ'}
              value={<span className={sum.net < 0 ? 'text-expense' : ''}>{formatBaht(sum.net, { sign: true })}</span>}
              tone="bg-sunken text-ink-2"
              icon={<Scale size={16} strokeWidth={2.2} />}
              hint={`${count} รายการรับ-จ่าย`}
            />
          </div>
        </div>

        {/* กราฟรายวัน */}
        <section className="card lg:col-span-7">
          <CardHeader
            title="รายจ่ายรายวัน"
            subtitle={dailyIsSelected ? rangeLabel(daily.range) : `30 วันล่าสุด · ${rangeLabel(daily.range)}`}
          />
          <div className="px-5 pt-3 pb-5">
            <DailyExpenseChart transactions={daily.txs} range={daily.range} />
          </div>
        </section>

        {/* รายจ่ายตามหมวด: การ์ดเข้ม วงแหวนสีตามหมวด */}
        <section className="deep-card card lg:col-span-6">
          <CardHeader title="รายจ่ายตามหมวด" subtitle={rangeLabel(range)} />
          {byCat.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-muted">ไม่มีรายจ่ายในช่วงนี้</p>
          ) : (
            (() => {
              const slices = ringSlices(byCat, data)
              return (
                <div className="flex flex-col items-center gap-6 px-5 pt-2 pb-6 sm:flex-row">
                  <div
                    className="grid h-44 w-44 shrink-0 place-items-center rounded-full"
                    role="img"
                    aria-label={`รายจ่ายรวม ${formatBaht(sum.expense)}`}
                    style={{ background: ringGradient(slices) }}
                  >
                    <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-deep">
                      <span className="text-xs text-muted">รายจ่ายรวม</span>
                      <span className="num mt-1 text-lg font-semibold">{formatBaht(sum.expense)}</span>
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
                          <span className="ml-1 text-xs font-normal text-muted">{Math.round((s.amount / sum.expense) * 100)}%</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })()
          )}
        </section>

        {/* เทียบเดือนต่อเดือน */}
        <TrendCard data={data} />

        {/* งบประมาณเดือนนี้ */}
        <BudgetCard data={data} onNavigate={onNavigate} />

        {/* เงินยืม */}
        <LoanCard data={data} />

        {/* รายการล่าสุด */}
        <section className="card overflow-hidden lg:col-span-12">
          <CardHeader
            title="รายการล่าสุด"
            subtitle={rangeLabel(range)}
            action={
              <button
                className="-mr-2 inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-sm font-medium text-brand hover:bg-brand-soft"
                onClick={() => onNavigate('history')}
              >
                ดูทั้งหมด <ChevronRight size={16} aria-hidden />
              </button>
            }
          />
          {recent.length === 0 ? (
            <EmptyState icon={ReceiptText} title="ยังไม่มีรายการในช่วงนี้">
              กดปุ่ม + เพื่อจดรายการแรก
            </EmptyState>
          ) : (
            <TransactionList transactions={recent} data={data} onOpen={onOpen} flat />
          )}
        </section>
      </div>
    </>
  )
}
