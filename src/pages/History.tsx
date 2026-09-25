import { FileUp, ReceiptText, Search, SearchX, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ImportSheet } from '../components/ImportSheet'
import { defaultRange, RangePicker, resolveRange } from '../components/RangePicker'
import { TransactionList } from '../components/TransactionList'
import { EmptyState, PageHeader } from '../components/ui'
import type { AppData } from '../hooks/useData'
import { TX_META } from '../lib/labels'
import { filterTransactions, sortNewestFirst, summarize } from '../lib/ledger'
import { formatBaht } from '../lib/money'
import type { Transaction, TransactionType } from '../lib/types'

export function HistoryPage({ data, onOpen }: { data: AppData; onOpen: (t: Transaction) => void }) {
  const [range, setRange] = useState(defaultRange('all'))
  const [type, setType] = useState<TransactionType | ''>('')
  const [walletId, setWalletId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const [importing, setImporting] = useState(false)

  const results = useMemo(
    () =>
      sortNewestFirst(
        filterTransactions(
          data.transactions,
          { range: resolveRange(range), type, walletId, categoryId, search },
          data.categoryMap,
          data.walletMap,
        ),
      ),
    [data, range, type, walletId, categoryId, search],
  )
  const sum = summarize(results)
  const filtered = !!(type || walletId || categoryId || search.trim() || range.mode !== 'all')
  const catOptions = data.categories.filter((c) => !type || type === c.type)

  function reset() {
    setRange(defaultRange('all'))
    setType('')
    setWalletId('')
    setCategoryId('')
    setSearch('')
  }

  return (
    <>
      <PageHeader
        title="รายการ"
        subtitle={`ทั้งหมด ${data.transactions.length} รายการ`}
        actions={
          <>
            {data.wallets.length > 0 && (
              <button type="button" className="btn-secondary order-last sm:order-first" onClick={() => setImporting(true)}>
                <FileUp size={18} aria-hidden /> นำเข้า statement
              </button>
            )}
            <RangePicker value={range} onChange={setRange} showAll className="w-full sm:w-auto sm:justify-end" />
          </>
        }
      />
      {importing && <ImportSheet data={data} onClose={() => setImporting(false)} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-5">
        <div className="min-w-0 space-y-4">
          {/* ค้นหา + ตัวกรอง */}
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative flex-1">
              <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
              <input
                type="search"
                className="field pl-10"
                placeholder="ค้นหารายละเอียด หมวด หรือกระเป๋า"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="ค้นหา"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 md:flex">
              <select
                className="field text-sm md:w-32"
                aria-label="ประเภท"
                value={type}
                onChange={(e) => {
                  const t = e.target.value as TransactionType | ''
                  setType(t)
                  if (categoryId && t && data.categoryMap.get(categoryId)?.type !== t) setCategoryId('')
                }}
              >
                <option value="">ทุกประเภท</option>
                {(Object.keys(TX_META) as TransactionType[]).map((t) => (
                  <option key={t} value={t}>
                    {TX_META[t].label}
                  </option>
                ))}
              </select>
              <select
                className="field text-sm md:w-36"
                aria-label="กระเป๋า"
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
              >
                <option value="">ทุกกระเป๋า</option>
                {data.wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <select
                className="field text-sm md:w-36"
                aria-label="หมวดหมู่"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={type === 'transfer'}
              >
                <option value="">ทุกหมวด</option>
                {catOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                    {!type && ` (${c.type === 'income' ? 'รับ' : 'จ่าย'})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* สรุปผลบนมือถือ */}
          <div className="flex items-center justify-between gap-3 text-sm lg:hidden">
            <span className="text-ink-2">
              <b className="font-semibold text-ink">{results.length}</b> รายการ
              {results.length > 0 && (
                <>
                  <span className="text-muted"> · </span>
                  <span className="num text-income">+{formatBaht(sum.income)}</span>
                  <span className="text-muted"> · </span>
                  <span className="num text-expense">−{formatBaht(sum.expense)}</span>
                </>
              )}
            </span>
            {filtered && (
              <button className="inline-flex shrink-0 items-center gap-1 font-medium text-brand" onClick={reset}>
                <X size={15} aria-hidden /> ล้างตัวกรอง
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <div className="card">
              {data.transactions.length === 0 ? (
                <EmptyState icon={ReceiptText} title="ยังไม่มีรายการ">
                  กดปุ่ม + เพื่อเริ่มจด
                </EmptyState>
              ) : (
                <EmptyState
                  icon={SearchX}
                  title="ไม่พบรายการที่ตรงกับตัวกรอง"
                  action={
                    <button className="btn-secondary" onClick={reset}>
                      ล้างตัวกรอง
                    </button>
                  }
                />
              )}
            </div>
          ) : (
            <TransactionList transactions={results} data={data} onOpen={onOpen} />
          )}
        </div>

        {/* สรุปผลบนจอใหญ่ */}
        <aside className="card sticky top-8 hidden p-5 lg:block">
          <h2 className="card-title">สรุปผลที่แสดง</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-2">จำนวน</dt>
              <dd className="num font-medium">{results.length} รายการ</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">รายรับ</dt>
              <dd className="num font-medium text-income">+{formatBaht(sum.income)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">รายจ่าย</dt>
              <dd className="num font-medium text-expense">−{formatBaht(sum.expense)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3">
              <dt className="font-medium">สุทธิ</dt>
              <dd className={`num font-semibold ${sum.net < 0 ? 'text-expense' : ''}`}>
                {formatBaht(sum.net, { sign: true })}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted">ไม่นับการโอนระหว่างกระเป๋า</p>
          {filtered && (
            <button className="btn-secondary mt-4 w-full" onClick={reset}>
              <X size={16} aria-hidden /> ล้างตัวกรอง
            </button>
          )}
        </aside>
      </div>
    </>
  )
}
