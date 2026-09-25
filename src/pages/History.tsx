import { useMemo, useState } from 'react'
import { defaultRange, RangePicker, resolveRange } from '../components/RangePicker'
import { TransactionList } from '../components/TransactionList'
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
    <div className="space-y-3">
      <input
        type="search"
        className="field"
        placeholder="🔍 ค้นหารายละเอียด หมวด หรือกระเป๋า"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="ค้นหา"
      />
      <RangePicker value={range} onChange={setRange} showAll />
      <div className="grid grid-cols-3 gap-2">
        <select
          className="field text-sm"
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
        <select className="field text-sm" aria-label="กระเป๋า" value={walletId} onChange={(e) => setWalletId(e.target.value)}>
          <option value="">ทุกกระเป๋า</option>
          {data.wallets.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select
          className="field text-sm"
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

      <div className="flex items-center justify-between px-1 text-sm text-slate-600">
        <span>
          {results.length} รายการ
          {results.length > 0 && (
            <>
              {' · '}
              <span className="text-emerald-700">รับ {formatBaht(sum.income)}</span>
              {' · '}
              <span className="text-red-700">จ่าย {formatBaht(sum.expense)}</span>
            </>
          )}
        </span>
        {filtered && (
          <button className="font-medium text-teal-700" onClick={reset}>
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <p className="card text-center text-slate-500">
          {data.transactions.length === 0 ? 'ยังไม่มีรายการ กดปุ่ม + เพื่อเริ่มจด' : 'ไม่พบรายการที่ตรงกับตัวกรอง'}
        </p>
      ) : (
        <TransactionList transactions={results} data={data} onOpen={onOpen} />
      )}
    </div>
  )
}
