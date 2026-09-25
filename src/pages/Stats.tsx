import { ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Tab } from '../App'
import { DailyExpenseChart } from '../components/Charts'
import { BudgetCard, CardHeader, CategoryRingCard, chartRange, LoanCard, StatTile, TrendCard } from '../components/insights'
import { defaultRange, RangePicker, rangeLabel, resolveRange } from '../components/RangePicker'
import { PageHeader } from '../components/ui'
import type { AppData } from '../hooks/useData'
import { expenseByCategory, filterTransactions, summarize } from '../lib/ledger'
import { loanCategoryIds } from '../lib/loans'
import { formatBaht } from '../lib/money'
import type { Transaction } from '../lib/types'

/** หน้าสถิติ: ทุกกราฟและการวิเคราะห์อยู่ที่นี่ หน้าแรกจะได้เบา */
export function StatsPage({ data, onNavigate }: { data: AppData; onNavigate: (tab: Tab) => void }) {
  const [rangeValue, setRangeValue] = useState(defaultRange('month'))
  const range = resolveRange(rangeValue)

  const { sum, byCat, daily, count } = useMemo(() => {
    const r = resolveRange(rangeValue)
    const loanIds = loanCategoryIds(data.categories)
    const notLoan = (t: Transaction) => !t.categoryId || !loanIds.has(t.categoryId)
    const inRange = filterTransactions(data.transactions, { range: r }, data.categoryMap, data.walletMap)
    const dailyRange = chartRange(r)
    return {
      sum: summarize(inRange, undefined, loanIds),
      byCat: expenseByCategory(inRange, undefined, loanIds),
      count: inRange.filter((t) => t.type !== 'transfer' && notLoan(t)).length,
      daily: {
        range: dailyRange,
        txs: filterTransactions(data.transactions, { range: dailyRange }, data.categoryMap, data.walletMap).filter(notLoan),
      },
    }
  }, [data, rangeValue])

  const dailyIsSelected = daily.range.from === range?.from && daily.range.to === range?.to

  return (
    <>
      <PageHeader
        title="สถิติ"
        subtitle={rangeLabel(range)}
        actions={<RangePicker value={rangeValue} onChange={setRangeValue} showAll className="w-full sm:w-auto sm:justify-end" />}
      />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-12 lg:gap-4">
          <StatTile label="รายรับ" value={formatBaht(sum.income)} tone="bg-income-soft text-income" icon={<ArrowDownLeft size={16} strokeWidth={2.4} />} />
          <StatTile label="รายจ่าย" value={formatBaht(sum.expense)} tone="bg-expense-soft text-expense" icon={<ArrowUpRight size={16} strokeWidth={2.4} />} />
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

        <section className="card lg:col-span-7">
          <CardHeader
            title="รายจ่ายรายวัน"
            subtitle={dailyIsSelected ? rangeLabel(daily.range) : `30 วันล่าสุด · ${rangeLabel(daily.range)}`}
          />
          <div className="px-5 pt-3 pb-5">
            <DailyExpenseChart transactions={daily.txs} range={daily.range} />
          </div>
        </section>

        <CategoryRingCard byCat={byCat} total={sum.expense} data={data} subtitle={rangeLabel(range)} className="lg:col-span-5" />

        <TrendCard data={data} className="lg:col-span-7" />
        <BudgetCard data={data} onNavigate={onNavigate} className="lg:col-span-5" />
        <LoanCard data={data} className="lg:col-span-12" />
      </div>
    </>
  )
}
