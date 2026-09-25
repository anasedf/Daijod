import { ArrowDownLeft, ArrowUpRight, ChevronRight, ReceiptText, Scale, Wallet, Zap } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { Tab } from '../App'
import { CategoryBars, DailyExpenseChart } from '../components/Charts'
import { defaultRange, RangePicker, rangeLabel, resolveRange } from '../components/RangePicker'
import { TransactionList } from '../components/TransactionList'
import { CategoryIcon, EmptyState, errorMessage, PageHeader, useToast, WalletIcon } from '../components/ui'
import type { AppData } from '../hooks/useData'
import { formatDateLong, todayISO, toISODate, type DateRange } from '../lib/dates'
import { addTransaction, db } from '../lib/db'
import { expenseByCategory, filterTransactions, sortNewestFirst, summarize } from '../lib/ledger'
import { formatBaht } from '../lib/money'
import { suggestQuickAdds, type QuickAdd } from '../lib/quick'
import type { Transaction } from '../lib/types'

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
                className="card flex items-center gap-2.5 py-2 pr-3.5 pl-2 text-left transition-colors hover:border-brand/40 hover:bg-sunken disabled:opacity-60"
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
    <div className="card p-4">
      <div className="flex items-center gap-2 text-sm text-ink-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`} aria-hidden>
          {icon}
        </span>
        {label}
      </div>
      <div className="num mt-3 text-xl font-bold tracking-tight break-all lg:text-2xl">{value}</div>
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

  const { inRange, sum, byCat, recent, daily } = useMemo(() => {
    const r = resolveRange(rangeValue)
    const inRange = filterTransactions(data.transactions, { range: r }, data.categoryMap, data.walletMap)
    const daily = chartRange(r)
    return {
      inRange,
      sum: summarize(inRange),
      byCat: expenseByCategory(inRange),
      recent: sortNewestFirst(inRange).slice(0, 6),
      daily: { range: daily, txs: filterTransactions(data.transactions, { range: daily }, data.categoryMap, data.walletMap) },
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

  const count = inRange.filter((t) => t.type !== 'transfer').length
  const dailyIsSelected = daily.range.from === range?.from && daily.range.to === range?.to

  return (
    <>
      <PageHeader
        title="ภาพรวม"
        subtitle={formatDateLong(todayISO())}
        actions={<RangePicker value={rangeValue} onChange={setRangeValue} className="w-full sm:w-auto sm:justify-end" />}
      />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <QuickAdds data={data} onOpen={onOpen} />

        {/* ยอดรวม + กระเป๋า */}
        <section className="relative overflow-hidden rounded-3xl bg-hero p-5 text-on-hero lg:col-span-5 lg:row-span-2 lg:p-6">
          <div
            className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-brand/25 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <div className="text-sm opacity-75">ยอดคงเหลือรวม</div>
            <div className="num mt-1 text-4xl font-bold tracking-tight lg:text-[2.75rem]">{formatBaht(data.total)}</div>
            <div className="mt-1 text-xs opacity-60">{data.wallets.length} กระเป๋า</div>

            <ul className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:mt-6 lg:block lg:space-y-1 lg:overflow-visible lg:px-0">
              {data.wallets.map((w) => {
                const bal = data.balances.get(w.id) ?? 0
                return (
                  <li
                    key={w.id}
                    className="flex min-w-40 shrink-0 flex-col gap-2 rounded-2xl bg-white/8 p-3 lg:min-w-0 lg:flex-row lg:items-center lg:gap-3 lg:rounded-xl lg:bg-transparent lg:px-2 lg:py-2 lg:hover:bg-white/5"
                  >
                    <WalletIcon wallet={w} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm opacity-85">{w.name}</span>
                    <span className={`num font-semibold ${bal < 0 ? 'text-expense' : ''}`}>{formatBaht(bal)}</span>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              onClick={() => onNavigate('wallets')}
              className="mt-3 hidden items-center gap-1 rounded-lg px-2 py-1 text-sm opacity-75 hover:bg-white/5 hover:opacity-100 lg:inline-flex"
            >
              จัดการกระเป๋า <ChevronRight size={16} aria-hidden />
            </button>
          </div>
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

        {/* หมวดหมู่ */}
        <section className="card lg:col-span-5">
          <CardHeader title="รายจ่ายตามหมวด" subtitle={rangeLabel(range)} />
          <div className="px-5 pb-5">
            {byCat.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">ไม่มีรายจ่ายในช่วงนี้</p>
            ) : (
              <CategoryBars totals={byCat} total={sum.expense} data={data} />
            )}
          </div>
        </section>

        {/* รายการล่าสุด */}
        <section className="card overflow-hidden lg:col-span-7">
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
