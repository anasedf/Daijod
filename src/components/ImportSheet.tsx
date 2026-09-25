import { CircleCheck, FileText, FileUp, TriangleAlert } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { AppData } from '../hooks/useData'
import { importTransactions, updateWallet, UserError } from '../lib/db'
import { formatDateShort } from '../lib/dates'
import { effectOn } from '../lib/ledger'
import { formatBaht } from '../lib/money'
import { BANK_LABEL, parseStatement, SUPPORTED_BANKS } from '../lib/statement'
import { counterparty, rememberChoices, suggestChoice, type Choice } from '../lib/statement/classify'
import type { Statement, StatementTx } from '../lib/statement/kbank'
import { findMatchingTransfer } from '../lib/statement/match'
import type { Transaction, TransactionInput } from '../lib/types'
import { errorMessage, FormError, Sheet, useToast } from './ui'

type Status = 'new' | 'imported' | 'similar' | 'matched'

interface Row {
  tx: StatementTx
  name: string
  key: string
  choice: Choice
  selected: boolean
  status: Status
  /** โอนที่มีอยู่แล้วซึ่งรายการนี้ตรงกัน (เมื่อ status = matched) */
  matched?: Transaction
}

function encode(c: Choice) {
  return c.type === 'transfer' ? `transfer:${c.walletId}` : `${c.type}:${c.categoryId}`
}
function decode(v: string): Choice {
  const [type, id = ''] = v.split(':')
  return type === 'transfer' ? { type, walletId: id } : { type: type as 'expense' | 'income', categoryId: id }
}

function buildRows(statement: Statement, data: AppData, walletId: string): Row[] {
  const imported = new Set(data.transactions.map((t) => t.importKey).filter(Boolean))
  const usedTransfers = new Set<string>()
  return statement.transactions.map((tx) => {
    const cp = counterparty(tx)
    let choice = suggestChoice(tx, cp, { walletId, wallets: data.wallets, categories: data.categories })
    const sign = tx.direction === 'in' ? 1 : -1
    let status: Status = 'new'
    const matched = imported.has(tx.key) ? undefined : findMatchingTransfer(tx, walletId, data.transactions, usedTransfers)
    if (imported.has(tx.key)) status = 'imported'
    else if (matched) {
      // การโอนระหว่างกระเป๋าของเราที่นำเข้าจากอีกฝั่งไปแล้ว ไม่ต้องบันทึกซ้ำ
      status = 'matched'
      const other = tx.direction === 'in' ? matched.sourceWalletId! : matched.destinationWalletId!
      choice = { type: 'transfer', walletId: other }
    } else if (
      data.transactions.some(
        (t) => !t.importKey && t.date === tx.date && t.amount === tx.amount && Math.sign(effectOn(t, walletId)) === sign,
      )
    )
      status = 'similar'
    return { tx, name: cp.name, key: cp.key, choice, selected: status === 'new', status, matched }
  })
}

function toInput(row: Row, walletId: string): TransactionInput {
  const { tx, choice } = row
  const base = {
    amount: tx.amount,
    date: tx.date,
    note: row.name,
    importKey: tx.key,
    importDetail: [tx.kind, tx.channel, tx.time, tx.detail].filter(Boolean).join(' · '),
  }
  if (choice.type === 'transfer') {
    return tx.direction === 'in'
      ? { ...base, type: 'transfer', sourceWalletId: choice.walletId, destinationWalletId: walletId }
      : { ...base, type: 'transfer', sourceWalletId: walletId, destinationWalletId: choice.walletId }
  }
  const categoryId = choice.categoryId || undefined
  return choice.type === 'income'
    ? { ...base, type: 'income', categoryId, destinationWalletId: walletId }
    : { ...base, type: 'expense', categoryId, sourceWalletId: walletId }
}

const STATUS_LABEL: Record<Status, string> = {
  new: '',
  imported: 'นำเข้าแล้ว',
  similar: 'อาจซ้ำกับที่จดไว้',
  matched: 'ตรงกับโอนที่มีอยู่แล้ว',
}

/** เดากระเป๋าที่น่าจะเป็นบัญชีของ statement นี้ จากชื่อกระเป๋า */
function guessWallet(bank: Statement['bank'], wallets: AppData['wallets']): string | undefined {
  const re = bank === 'truemoney' ? /true|ทรู/i : /กสิกร|kbank|kplus|k plus/i
  return wallets.find((w) => re.test(w.name))?.id
}

export function ImportSheet({ data, onClose, walletId: initialWallet }: { data: AppData; onClose: () => void; walletId?: string }) {
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [walletId, setWalletId] = useState(
    initialWallet ?? data.wallets.find((w) => w.type === 'bank')?.id ?? data.wallets[0]?.id ?? '',
  )
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [needPassword, setNeedPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [statement, setStatement] = useState<Statement | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [adjust, setAdjust] = useState(false)

  const wallet = data.walletMap.get(walletId)
  const others = data.wallets.filter((w) => w.id !== walletId)

  async function parse() {
    if (!file || !wallet) return
    setBusy(true)
    setError('')
    try {
      // โหลด pdf.js เฉพาะตอนใช้ (ไฟล์ใหญ่)
      const { extractTextItems, PasswordRequired } = await import('../lib/statement/pdf')
      let pages
      try {
        pages = await extractTextItems(await file.arrayBuffer(), password || undefined)
      } catch (e) {
        if (e instanceof PasswordRequired) setNeedPassword(true)
        throw e
      }
      const st = parseStatement(pages)
      if (st.transactions.length === 0) throw new UserError('ไม่พบรายการในไฟล์นี้')
      // ถ้ากระเป๋าที่เลือกไว้ไม่ตรงกับธนาคารของไฟล์ แต่มีกระเป๋าที่ชื่อตรง ให้สลับให้เลย
      let target = walletId
      const guess = guessWallet(st.bank, data.wallets)
      if (guess && guess !== walletId && !guessWallet(st.bank, [wallet])) {
        target = guess
        setWalletId(guess)
      }
      setStatement(st)
      setRows(buildRows(st, data, target))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const picked = rows.filter((r) => r.selected && r.status !== 'imported')
  const selectable = rows.filter((r) => r.status !== 'imported')
  const sumIn = picked.filter((r) => r.tx.direction === 'in').reduce((s, r) => s + r.tx.amount, 0)
  const sumOut = picked.filter((r) => r.tx.direction === 'out').reduce((s, r) => s + r.tx.amount, 0)

  // เทียบยอดกระเป๋าในแอป ณ วันสิ้นสุด statement กับยอดยกไปใน statement
  const balanceCheck = useMemo(() => {
    if (!statement || statement.closingBalance === undefined || !wallet) return null
    const end = statement.period?.to ?? statement.transactions.at(-1)!.date
    let app = wallet.openingBalance
    for (const t of data.transactions) if (t.date <= end) app += effectOn(t, wallet.id)
    for (const r of rows) {
      if (r.selected && r.status !== 'imported') app += r.tx.direction === 'in' ? r.tx.amount : -r.tx.amount
    }
    return { end, app, statement: statement.closingBalance, diff: statement.closingBalance - app }
  }, [statement, wallet, data.transactions, rows])

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  async function save() {
    if (!wallet) return
    if (picked.length === 0) return setError('ยังไม่ได้เลือกรายการที่จะนำเข้า')
    setBusy(true)
    setError('')
    try {
      const n = await importTransactions(picked.map((r) => toInput(r, walletId)))
      if (adjust && balanceCheck?.diff) {
        await updateWallet(wallet.id, {
          name: wallet.name,
          type: wallet.type,
          color: wallet.color,
          openingBalance: wallet.openingBalance + balanceCheck.diff,
        })
      }
      rememberChoices(picked.map((r) => ({ key: r.key, choice: r.choice })))
      toast(`นำเข้า ${n} รายการเข้า “${wallet.name}” แล้ว`)
      onClose()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  // ---------- ขั้นเลือกไฟล์ ----------
  if (!statement) {
    return (
      <Sheet
        title="นำเข้าจาก statement"
        onClose={onClose}
        size="lg"
        footer={
          <button type="button" className="btn-primary w-full" disabled={!file || !wallet || busy} onClick={parse}>
            {busy ? 'กำลังอ่านไฟล์…' : 'อ่านไฟล์'}
          </button>
        }
      >
        <div className="space-y-5">
          <p className="text-sm text-ink-2">
            รองรับ statement ของ <b className="text-ink">{SUPPORTED_BANKS}</b> ไฟล์ถูกอ่านในเครื่องนี้เท่านั้น ไม่ถูกส่งไปที่ไหน
            ถ้านำเข้าทั้งสองฝั่งของบัญชีที่โอนหากัน แอปจะจับคู่การโอนให้ ไม่บันทึกซ้ำ
          </p>

          <div>
            <label className="label" htmlFor="imp-wallet">
              นำเข้าเป็นรายการของกระเป๋า
            </label>
            <select id="imp-wallet" className="field" value={walletId} onChange={(e) => setWalletId(e.target.value)}>
              {data.wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="label">ไฟล์ statement</span>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-line p-4 text-left transition-colors hover:border-brand hover:bg-brand-soft/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand" aria-hidden>
                {file ? <FileText size={22} /> : <FileUp size={22} />}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{file ? file.name : 'เลือกไฟล์ PDF'}</span>
                <span className="block text-xs text-muted">
                  {file ? `${(file.size / 1024).toFixed(0)} KB · แตะเพื่อเปลี่ยนไฟล์` : 'แตะเพื่อเลือกไฟล์จากเครื่อง'}
                </span>
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) {
                  setFile(f)
                  setError('')
                }
              }}
            />
          </div>

          {(needPassword || password) && (
            <div>
              <label className="label" htmlFor="imp-password">
                รหัสผ่านของไฟล์
              </label>
              <input
                id="imp-password"
                type="password"
                className="field"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <p className="mt-1.5 text-xs text-muted">ใช้เปิดไฟล์ในเครื่องนี้เท่านั้น ไม่ถูกบันทึกไว้</p>
            </div>
          )}

          {error && <FormError>{error}</FormError>}
        </div>
      </Sheet>
    )
  }

  // ---------- ขั้นตรวจก่อนบันทึก ----------
  const allSelected = selectable.length > 0 && selectable.every((r) => r.selected)
  return (
    <Sheet
      title="ตรวจรายการก่อนนำเข้า"
      onClose={onClose}
      size="xl"
      footer={
        <div className="space-y-3">
          {error && <FormError>{error}</FormError>}
          {balanceCheck && balanceCheck.diff !== 0 && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-sunken p-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={adjust} onChange={(e) => setAdjust(e.target.checked)} />
              <span>
                ปรับยอดตั้งต้นของกระเป๋า{' '}
                <b className="num">{formatBaht(balanceCheck.diff, { sign: true })}</b> ให้ยอด ณ วันที่{' '}
                {formatDateShort(balanceCheck.end)} เท่ากับ statement ({formatBaht(balanceCheck.statement)})
                <span className="block text-xs text-muted">
                  ตอนนี้แอปจะมี {formatBaht(balanceCheck.app)} หลังนำเข้า ส่วนต่างมักมาจากรายการก่อนเริ่มจดหรือที่ยังไม่ได้นำเข้า
                </span>
              </span>
            </label>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-ink-2">
              เลือก <b className="text-ink">{picked.length}</b> รายการ
              {picked.length > 0 && (
                <>
                  <span className="text-muted"> · </span>
                  <span className="num text-income">+{formatBaht(sumIn)}</span>
                  <span className="text-muted"> · </span>
                  <span className="num text-expense">−{formatBaht(sumOut)}</span>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setStatement(null)} disabled={busy}>
                เลือกไฟล์ใหม่
              </button>
              <button type="button" className="btn-primary" onClick={save} disabled={busy || picked.length === 0}>
                {busy ? 'กำลังบันทึก…' : `นำเข้า ${picked.length} รายการ`}
              </button>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-sunken px-4 py-3 text-sm">
          <span>
            กระเป๋า <b>{wallet?.name}</b>
          </span>
          <span className="text-ink-2">
            {BANK_LABEL[statement.bank]}
            {statement.accountNo && ` ${statement.accountNo}`}
          </span>
          {statement.period && (
            <span className="text-ink-2">
              {formatDateShort(statement.period.from)} – {formatDateShort(statement.period.to)}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5">
            {statement.warnings.length === 0 ? (
              <CircleCheck size={16} className="text-income" aria-hidden />
            ) : (
              <TriangleAlert size={16} className="text-expense" aria-hidden />
            )}
            อ่านได้ {rows.length} รายการ
          </span>
        </div>
        {statement.warnings.length > 0 && (
          <ul className="space-y-1 rounded-xl bg-expense-soft p-3 text-sm text-expense">
            {statement.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              checked={allSelected}
              onChange={(e) => setRows((rs) => rs.map((r) => (r.status === 'imported' ? r : { ...r, selected: e.target.checked })))}
            />
            เลือกทั้งหมด
          </label>
          <span className="text-xs text-muted">รายการที่นำเข้าแล้ว ตรงกับโอนที่มีอยู่ หรืออาจซ้ำ จะไม่ถูกเลือกไว้ก่อน</span>
        </div>

        <ul className="divide-y divide-line/70 rounded-xl border border-line">
          {rows.map((r, i) => {
            const own = r.tx.direction === 'in' ? 'income' : 'expense'
            const cats = data.categories.filter((c) => c.type === own)
            const disabled = r.status === 'imported'
            return (
              <li
                key={r.tx.key}
                className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 md:grid-cols-[auto_5.5rem_minmax(0,1fr)_7rem_15rem] ${
                  disabled ? 'opacity-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand"
                  checked={r.selected}
                  disabled={disabled}
                  onChange={(e) => update(i, { selected: e.target.checked })}
                  aria-label={`เลือก ${r.name}`}
                />
                <span className="num hidden text-sm md:block">
                  <span className="block">{formatDateShort(r.tx.date)}</span>
                  <span className="block text-xs text-muted">{r.tx.time}</span>
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{r.name}</span>
                    {r.status !== 'new' && (
                      <span className="shrink-0 rounded-md bg-sunken px-1.5 py-0.5 text-[0.65rem] font-medium text-ink-2">
                        {STATUS_LABEL[r.status]}
                      </span>
                    )}
                  </span>
                  {r.matched && (
                    <span className="block truncate text-xs text-brand">
                      มีอยู่แล้วเป็น “โอน {data.walletMap.get(r.matched.sourceWalletId!)?.name} →{' '}
                      {data.walletMap.get(r.matched.destinationWalletId!)?.name}” {formatDateShort(r.matched.date)} ไม่ต้องติ๊ก
                    </span>
                  )}
                  <span className="block truncate text-xs text-muted" title={r.tx.detail}>
                    <span className="md:hidden">
                      {formatDateShort(r.tx.date)} {r.tx.time} ·{' '}
                    </span>
                    {r.tx.kind}
                    {r.tx.detail && ` · ${r.tx.detail}`}
                  </span>
                </span>
                <span className={`num text-right text-sm font-semibold ${r.tx.direction === 'in' ? 'text-income' : 'text-expense'}`}>
                  {r.tx.direction === 'in' ? '+' : '−'}
                  {formatBaht(r.tx.amount)}
                </span>
                <select
                  className="field col-span-3 min-h-9 text-sm md:col-span-1"
                  value={encode(r.choice)}
                  disabled={disabled}
                  onChange={(e) => update(i, { choice: decode(e.target.value) })}
                  aria-label={`ประเภทของ ${r.name}`}
                >
                  <optgroup label={own === 'income' ? 'รายรับ' : 'รายจ่าย'}>
                    <option value={`${own}:`}>{own === 'income' ? 'รายรับ' : 'รายจ่าย'} · ไม่ระบุหมวด</option>
                    {cats.map((c) => (
                      <option key={c.id} value={`${own}:${c.id}`}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                  {others.length > 0 && (
                    <optgroup label="โอนระหว่างกระเป๋า">
                      {others.map((w) => (
                        <option key={w.id} value={`transfer:${w.id}`}>
                          {r.tx.direction === 'in' ? 'รับโอนจาก' : 'โอนไป'} {w.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </li>
            )
          })}
        </ul>
      </div>
    </Sheet>
  )
}
