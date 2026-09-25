import { ArrowDownLeft, CalendarDays, ChevronRight, Download, HardDrive, ReceiptText, Scale, Wallet, Zap } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { Tab } from '../App'
import { CardHeader, categorySlices } from '../components/insights'
import { TransactionList } from '../components/TransactionList'
import { CategoryIcon, EmptyState, errorMessage, PageHeader, useToast, WalletIcon } from '../components/ui'
import type { AppData } from '../hooks/useData'
import { backupReminder, downloadBackup, snoozeBackupReminder } from '../lib/backup'
import { budgetSummary } from '../lib/budget'
import { formatDateLong, formatDateShort, monthRange, todayISO } from '../lib/dates'
import { addTransaction, db, postRecurring, skipRecurring } from '../lib/db'
import { TX_META, WALLET_TYPES } from '../lib/labels'
import { expenseByCategory, filterTransactions, sortNewestFirst, summarize } from '../lib/ledger'
import { loanCategoryIds } from '../lib/loans'
import { formatBaht } from '../lib/money'
import { suggestQuickAdds, type QuickAdd } from '../lib/quick'
import { dueRecurrings } from '../lib/recurring'
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

/** แถบเตือนให้สำรองข้อมูล เมื่อไม่เคยสำรองหรือสำรองนานแล้ว (บรรทัดเดียว ไม่แย่งความสนใจ) */
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-sun-soft px-4 py-2.5 text-sm lg:col-span-12">
      <HardDrive size={17} className="shrink-0 text-ink-2" aria-hidden />
      <span className="min-w-0 flex-1 text-ink-2">
        {reminder.reason === 'never' ? `ยังไม่เคยสำรองข้อมูล (${data.transactions.length} รายการ)` : `สำรองล่าสุด ${reminder.days} วันก่อน มีรายการใหม่หลังจากนั้น`}
      </span>
      <span className="flex gap-1">
        <button
          type="button"
          className="btn-ghost min-h-8 px-2.5 text-xs"
          onClick={() => {
            snoozeBackupReminder()
            setTick((t) => t + 1)
          }}
        >
          ไว้ก่อน
        </button>
        <button type="button" className="btn-primary min-h-8 px-3 text-xs" onClick={download}>
          <Download size={14} aria-hidden /> สำรอง
        </button>
      </span>
    </div>
  )
}

/** ปุ่มลัด: รายการที่จดบ่อย แตะเดียวบันทึกเลย (แก้ได้จากปุ่มบน toast) แสดงไม่เกิน 4 อัน */
function QuickAdds({ data, onOpen }: { data: AppData; onOpen: (t: Transaction) => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const items = useMemo(() => suggestQuickAdds(data.transactions, { today: todayISO(), limit: 4 }), [data.transactions])
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
      <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-medium text-muted">
        <Zap size={14} aria-hidden /> จดเร็ว · แตะเพื่อจดเป็นของวันนี้
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
                className="flex items-center gap-2.5 rounded-full bg-surface py-1.5 pr-4 pl-1.5 text-left transition-colors hover:bg-sunken disabled:opacity-60"
              >
                <CategoryIcon category={cat} size="sm" fallback={q.type === 'income' ? '+' : '−'} className="rounded-full!" />
                <span className="min-w-0">
                  <span className="block max-w-36 truncate text-sm font-medium">{q.note || cat?.name}</span>
                  <span className={`num block text-xs ${q.type === 'income' ? 'text-income' : 'text-muted'}`}>
                    {q.type === 'income' ? '+' : '−'}
                    {formatBaht(q.amount)} · {wallet.name}
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

/** เดือนนี้ในการ์ดเดียว: จ่ายไปเท่าไหร่ (ตัวใหญ่) รับ สุทธิ และวันละเท่าไหร่ */
function MonthCard({ data, onNavigate }: { data: AppData; onNavigate: (tab: Tab) => void }) {
  const { sum, count, daysLeft, perDay, avgPerDay, budget } = useMemo(() => {
    const today = todayISO()
    const range = monthRange()
    const loanIds = loanCategoryIds(data.categories)
    const inRange = filterTransactions(data.transactions, { range }, data.categoryMap, data.walletMap)
    const sum = summarize(inRange, undefined, loanIds)
    const count = inRange.filter((t) => t.type !== 'transfer' && !(t.categoryId && loanIds.has(t.categoryId))).length
    const dayOfMonth = Number(today.slice(8, 10))
    const budget = budgetSummary(data.categories, data.transactions, today)
    const left = budget.totalBudget - budget.totalSpent
    return {
      sum,
      count,
      daysLeft: budget.daysLeft,
      avgPerDay: Math.round(sum.expense / dayOfMonth),
      budget: budget.items.length > 0 ? budget : null,
      perDay: budget.items.length > 0 && left > 0 ? Math.floor(left / budget.daysLeft) : null,
    }
  }, [data])

  const ratio = budget && budget.totalBudget ? budget.totalSpent / budget.totalBudget : null

  return (
    <section className="card p-5 sm:p-6 lg:col-span-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-ink-2">รายจ่ายเดือนนี้</h2>
          <div className="num mt-1 text-4xl font-semibold tracking-tight break-words sm:text-[2.75rem]">{formatBaht(sum.expense)}</div>
          <p className="mt-1 text-xs text-muted">
            {count} รายการ · เหลืออีก {daysLeft} วัน
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('stats')}
          className="btn-secondary min-h-9 shrink-0 px-3 text-sm"
        >
          สถิติ <ChevronRight size={15} aria-hidden />
        </button>
      </div>

      {ratio !== null && budget && (
        <div className="mt-5">
          <div className="flex justify-between text-xs text-muted">
            <span>งบเดือนนี้</span>
            <span className="num">
              {formatBaht(budget.totalSpent)} / {formatBaht(budget.totalBudget)}
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-chart-track" aria-hidden>
            <div
              className={`h-2 rounded-full ${ratio >= 1 ? 'bg-expense' : ratio >= 0.8 ? 'bg-sun' : 'bg-chart'}`}
              style={{ width: `${Math.min(100, Math.max(1.5, ratio * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* กล่องย่อย 3 ใบ แบบงานอ้างอิง: ไอคอน + ตัวเลข + แถบสัดส่วน */}
      <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <MiniTile label="รายรับ" value={`+${formatBaht(sum.income)}`} tone="bg-income-soft text-income" bar={sum.income + sum.expense ? sum.income / (sum.income + sum.expense) : 0} barTone="bg-income" icon={<ArrowDownLeft size={15} strokeWidth={2.4} />} />
        <MiniTile
          label="สุทธิ"
          value={formatBaht(sum.net, { sign: true })}
          tone={sum.net < 0 ? 'bg-expense-soft text-expense' : 'bg-sunken text-ink-2'}
          valueTone={sum.net < 0 ? 'text-expense' : ''}
          icon={<Scale size={15} strokeWidth={2.2} />}
        />
        <MiniTile
          label={perDay !== null ? 'ใช้ได้อีกวันละ' : 'เฉลี่ยวันละ'}
          value={formatBaht(perDay ?? avgPerDay)}
          tone="bg-accent-soft text-accent-strong"
          icon={<CalendarDays size={15} strokeWidth={2.2} />}
          className="col-span-2 sm:col-span-1"
        />
      </dl>
    </section>
  )
}

function MiniTile({
  label,
  value,
  icon,
  tone,
  valueTone = '',
  bar,
  barTone = 'bg-chart',
  className = '',
}: {
  label: string
  value: string
  icon: ReactNode
  tone: string
  valueTone?: string
  bar?: number
  barTone?: string
  className?: string
}) {
  return (
    <div className={`rounded-2xl bg-sunken/70 p-3 ${className}`}>
      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${tone}`} aria-hidden>
        {icon}
      </span>
      <dt className="mt-2.5 text-xs text-muted">{label}</dt>
      <dd className={`num mt-0.5 text-base font-semibold whitespace-nowrap ${valueTone}`}>{value}</dd>
      {bar !== undefined && (
        <div className="mt-2 h-1.5 rounded-full bg-chart-track" aria-hidden>
          <div className={`h-1.5 rounded-full ${barTone}`} style={{ width: `${Math.max(2, Math.min(100, bar * 100))}%` }} />
        </div>
      )}
    </div>
  )
}

/** รายจ่ายตามหมวดแบบย่อ: 4 หมวดแรก แถบบาง ๆ */
function TopCategories({ data, onNavigate }: { data: AppData; onNavigate: (tab: Tab) => void }) {
  const { slices, total } = useMemo(() => {
    const loanIds = loanCategoryIds(data.categories)
    const inRange = filterTransactions(data.transactions, { range: monthRange() }, data.categoryMap, data.walletMap)
    const byCat = expenseByCategory(inRange, undefined, loanIds)
    return { slices: categorySlices(byCat, data, 4), total: summarize(inRange, undefined, loanIds).expense }
  }, [data])
  if (slices.length === 0) return null
  const max = slices[0].amount

  return (
    <section className="card lg:col-span-7">
      <CardHeader
        title="จ่ายไปกับอะไร"
        subtitle="เดือนนี้"
        action={
          <button className="-mr-2 inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-sm font-medium text-ink-2 hover:bg-sunken" onClick={() => onNavigate('stats')}>
            ทั้งหมด <ChevronRight size={16} aria-hidden />
          </button>
        }
      />
      <ul className="space-y-3 px-5 pb-5">
        {slices.map((s) => (
          <li key={s.key}>
            <div className="flex items-center gap-2.5 text-sm">
              <CategoryIcon category={s.cat} size="sm" fallback="⋯" />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="num font-medium">{formatBaht(s.amount)}</span>
              <span className="num w-9 text-right text-xs text-muted">{Math.round((s.amount / total) * 100)}%</span>
            </div>
            <div className="mt-1.5 ml-9.5 h-1.5 rounded-full bg-chart-track" aria-hidden>
              <div className="h-1.5 rounded-full" style={{ width: `${Math.max(2, (s.amount / max) * 100)}%`, background: s.color }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
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
  const recent = useMemo(() => sortNewestFirst(data.transactions).slice(0, 5), [data.transactions])

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

  return (
    <>
      <PageHeader title="ภาพรวม" subtitle={formatDateLong(todayISO())} />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <BackupBanner data={data} />
        <DueRecurrings data={data} onOpen={onOpen} />

        {/* บัตรยอดคงเหลือ: แบบบัตรธนาคาร มีวงกลมตกแต่งจาง ๆ */}
        <section className="hero-card relative overflow-hidden rounded-3xl p-5 sm:p-6 lg:col-span-5">
          <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full border-[18px] border-white/12" aria-hidden />
          <div className="pointer-events-none absolute -right-2 -bottom-20 h-44 w-44 rounded-full bg-white/10" aria-hidden />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm opacity-90">
                <Wallet size={18} aria-hidden /> ยอดคงเหลือรวม
              </span>
              <span className="text-xs opacity-80">{data.wallets.length} กระเป๋า</span>
            </div>
            <div className="num mt-6 text-4xl font-semibold tracking-tight break-words sm:text-[2.75rem]">{formatBaht(data.total)}</div>
            <div className="mt-auto flex items-end justify-between gap-3 pt-8">
              <span className="text-xs opacity-75">ทุกกระเป๋ารวมกัน</span>
              <button
                type="button"
                onClick={() => onNavigate('wallets')}
                className="inline-flex min-h-9 items-center gap-1 rounded-full bg-brand px-3.5 text-sm font-medium text-on-brand"
              >
                กระเป๋า <ChevronRight size={15} aria-hidden />
              </button>
            </div>
          </div>
        </section>

        <MonthCard data={data} onNavigate={onNavigate} />

        {/* รายชื่อกระเป๋า */}
        <section className="card lg:col-span-5">
          <CardHeader
            title="กระเป๋า"
            action={
              <button className="-mr-2 inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-sm font-medium text-ink-2 hover:bg-sunken" onClick={() => onNavigate('wallets')}>
                จัดการ <ChevronRight size={16} aria-hidden />
              </button>
            }
          />
          <ul className="divide-y divide-line/70 border-t border-line/70">
            {data.wallets.map((w) => {
              const bal = data.balances.get(w.id) ?? 0
              return (
                <li key={w.id} className="flex items-center gap-3 px-5 py-3">
                  <WalletIcon wallet={w} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{w.name}</span>
                    <span className="block text-xs text-muted">{WALLET_TYPES[w.type].label}</span>
                  </span>
                  <span className={`num shrink-0 font-semibold ${bal < 0 ? 'text-expense' : ''}`}>{formatBaht(bal)}</span>
                </li>
              )
            })}
          </ul>
        </section>

        <TopCategories data={data} onNavigate={onNavigate} />

        <QuickAdds data={data} onOpen={onOpen} />

        {/* รายการล่าสุด */}
        <section className="card overflow-hidden lg:col-span-12">
          <CardHeader
            title="รายการล่าสุด"
            action={
              <button
                className="-mr-2 inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-sm font-medium text-ink-2 hover:bg-sunken"
                onClick={() => onNavigate('history')}
              >
                ทั้งหมด <ChevronRight size={16} aria-hidden />
              </button>
            }
          />
          {recent.length === 0 ? (
            <EmptyState icon={ReceiptText} title="ยังไม่มีรายการ">
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
