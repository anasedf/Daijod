import { CheckSquare, FileUp, ReceiptText, Search, SearchX, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ImportSheet } from '../components/ImportSheet'
import { defaultRange, RangePicker, resolveRange } from '../components/RangePicker'
import { TransactionList } from '../components/TransactionList'
import { EmptyState, errorMessage, PageHeader, useConfirm, useToast } from '../components/ui'
import type { AppData } from '../hooks/useData'
import { deleteTransactions } from '../lib/db'
import { TX_META } from '../lib/labels'
import { loanCategoryIds } from '../lib/loans'
import { filterTransactions, sortNewestFirst, summarize } from '../lib/ledger'
import { formatBaht } from '../lib/money'
import type { Transaction, TransactionType } from '../lib/types'

export function HistoryPage({ data, onOpen }: { data: AppData; onOpen: (t: Transaction) => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [range, setRange] = useState(defaultRange('all'))
  const [type, setType] = useState<TransactionType | ''>('')
  const [walletId, setWalletId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [importing, setImporting] = useState(false)
  // โหมดเลือกหลายรายการเพื่อลบ (null = ไม่ได้เลือก)
  const [selected, setSelected] = useState<Set<string> | null>(null)

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
  const sum = useMemo(() => summarize(results, undefined, loanCategoryIds(data.categories)), [results, data.categories])
  const filtered = !!(type || walletId || categoryId || search.trim() || range.mode !== 'all')
  const catOptions = data.categories.filter((c) => !type || type === c.type)

  function reset() {
    setRange(defaultRange('all'))
    setType('')
    setWalletId('')
    setCategoryId('')
    setSearch('')
  }

  const selection = selected
    ? {
        selected,
        toggle: (id: string) =>
          setSelected((s) => {
            const n = new Set(s)
            if (n.has(id)) n.delete(id)
            else n.add(id)
            return n
          }),
      }
    : undefined
  const allShownSelected = selected !== null && results.length > 0 && results.every((t) => selected.has(t.id))

  async function removeSelected() {
    if (!selected || selected.size === 0) return
    const ok = await confirm({
      title: `ลบ ${selected.size} รายการ?`,
      danger: true,
      confirmLabel: `ลบ ${selected.size} รายการ`,
      message: <p>รายการที่เลือกจะถูกลบและกู้คืนไม่ได้ ยอดกระเป๋าจะคำนวณใหม่</p>,
    })
    if (!ok) return
    try {
      await deleteTransactions([...selected])
      toast(`ลบ ${selected.size} รายการแล้ว`)
      setSelected(null)
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  return (
    <>
      <PageHeader
        title="รายการ"
        subtitle={`ทั้งหมด ${data.transactions.length} รายการ`}
        actions={
          <>
            {/* ปุ่มเครื่องมือเป็นไอคอนกลม ไม่แย่งที่ตัวเลือกช่วงเวลา */}
            {data.transactions.length > 0 && (
              <button
                type="button"
                className={`${selected ? 'btn-primary' : 'btn-secondary'} min-h-10 px-3 text-sm`}
                onClick={() => setSelected(selected ? null : new Set())}
                aria-pressed={!!selected}
                title="เลือกหลายรายการ"
              >
                <CheckSquare size={17} aria-hidden /> {selected ? 'เลิกเลือก' : 'เลือก'}
              </button>
            )}
            {data.wallets.length > 0 && !selected && (
              <button type="button" className="btn-secondary min-h-10 px-3 text-sm" onClick={() => setImporting(true)} title="นำเข้า statement">
                <FileUp size={17} aria-hidden /> <span className="hidden sm:inline">นำเข้า</span>
              </button>
            )}
            <RangePicker value={range} onChange={setRange} showAll className="w-full sm:w-auto sm:justify-end" />
          </>
        }
      />
      {importing && <ImportSheet data={data} onClose={() => setImporting(false)} />}

      <div className="card overflow-hidden">
        <div className="min-w-0">
          {/* ค้นหา + ตัวกรอง */}
          <div className="grid gap-2 p-3 md:p-4 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  type="search"
                  className="field min-h-10 pl-10"
                  placeholder="ค้นหาชื่อ โน้ต หมวด หรือกระเป๋า"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="ค้นหา"
                />
              </div>
              <button
                type="button"
                className={`btn-secondary min-h-10 shrink-0 px-3 sm:hidden ${type || walletId || categoryId ? 'text-accent-strong' : ''}`}
                aria-expanded={showFilters}
                aria-controls="history-filters"
                aria-label="ตัวกรอง"
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal size={17} aria-hidden />
              </button>
            </div>
            <div id="history-filters" className={`${showFilters ? 'grid' : 'hidden'} grid-cols-1 gap-2 sm:grid sm:grid-cols-3`}>
              <select
                className="field text-sm xl:w-32"
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
                className="field text-sm xl:w-36"
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
                className="field text-sm xl:w-36"
                aria-label="หมวดหมู่"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={type === 'transfer'}
              >
                <option value="">ทุกหมวด</option>
                {catOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {!type && ` (${c.type === 'income' ? 'รับ' : 'จ่าย'})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* สรุปผลที่แสดงในบรรทัดเดียว */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line/70 px-4 py-2.5 text-sm md:px-5">
            <span className="text-ink-2">
              <b className="num font-semibold text-ink">{results.length}</b> รายการ
            </span>
            {results.length > 0 && (
              <>
                <span className="num text-income">+{formatBaht(sum.income)}</span>
                <span className="num text-expense">−{formatBaht(sum.expense)}</span>
                <span className={`num ${sum.net < 0 ? 'text-expense' : 'text-ink'}`}>สุทธิ {formatBaht(sum.net, { sign: true })}</span>
              </>
            )}
            {filtered && (
              <button className="ml-auto inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium text-accent-strong hover:bg-accent-soft" onClick={reset}>
                <X size={14} aria-hidden /> ล้างตัวกรอง
              </button>
            )}
          </div>
          {results.length === 0 ? (
            <div className="border-t border-line/70">
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
            <TransactionList transactions={results} data={data} onOpen={onOpen} selection={selection} flat />
          )}
        </div>
      </div>

      {/* แถบคำสั่งตอนเลือกหลายรายการ */}
      {selected && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 px-4 lg:bottom-6 lg:left-64">
          <div className="anim-sheet mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm text-canvas shadow-2xl">
            <span className="font-medium">
              เลือก <span className="num">{selected.size}</span> รายการ
            </span>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-canvas/80 hover:bg-white/10 hover:text-canvas"
              onClick={() => setSelected(allShownSelected ? new Set() : new Set(results.map((t) => t.id)))}
            >
              {allShownSelected ? 'ไม่เลือกเลย' : `เลือกทั้งหมดที่แสดง (${results.length})`}
            </button>
            <span className="flex-1" />
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-canvas/80 hover:bg-white/10 hover:text-canvas"
              onClick={() => setSelected(null)}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-expense px-3 py-1.5 font-semibold text-white disabled:opacity-40"
              disabled={selected.size === 0}
              onClick={removeSelected}
            >
              <Trash2 size={16} aria-hidden /> ลบ
            </button>
          </div>
        </div>
      )}
    </>
  )
}
