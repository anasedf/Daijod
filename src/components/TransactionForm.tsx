import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { AppData } from '../hooks/useData'
import { addTransaction, deleteTransaction, updateTransaction } from '../lib/db'
import { formatTimestamp, todayISO } from '../lib/dates'
import { TX_META } from '../lib/labels'
import { amountToInput, formatBaht, parseAmount } from '../lib/money'
import { getPref, setPref } from '../lib/prefs'
import type { Transaction, TransactionType, Wallet } from '../lib/types'
import { errorMessage, FormError, Sheet, useConfirm, useToast, WalletIcon } from './ui'

function WalletPicker({
  label,
  wallets,
  balances,
  value,
  onChange,
  disabledId,
}: {
  label: string
  wallets: Wallet[]
  balances: Map<string, number>
  value: string
  onChange: (id: string) => void
  disabledId?: string
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {wallets.map((w) => {
          const selected = value === w.id
          const disabled = disabledId === w.id
          return (
            <button
              key={w.id}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onChange(w.id)}
              className={`flex min-h-14 shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-35 ${
                selected ? 'border-brand bg-brand-soft ring-1 ring-brand' : 'border-line hover:bg-sunken'
              }`}
            >
              <WalletIcon wallet={w} size="sm" />
              <span className="min-w-0">
                <span className={`block truncate text-sm ${selected ? 'font-semibold' : 'font-medium'}`}>{w.name}</span>
                <span className="num block text-xs text-muted">{formatBaht(balances.get(w.id) ?? 0)}</span>
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function TransactionForm({
  data,
  transaction,
  onClose,
}: {
  data: AppData
  transaction?: Transaction
  onClose: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const { wallets, categories, balances } = data

  const lastWallet = getPref('lastWallet')
  const defaultWallet = wallets.find((w) => w.id === lastWallet)?.id ?? wallets[0]?.id ?? ''

  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'expense')
  const [amount, setAmount] = useState(transaction ? amountToInput(transaction.amount) : '')
  const [date, setDate] = useState(transaction?.date ?? todayISO())
  const [note, setNote] = useState(transaction?.note ?? '')
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? '')
  const [source, setSource] = useState(transaction?.sourceWalletId ?? defaultWallet)
  const [dest, setDest] = useState(
    transaction?.destinationWalletId ??
      (transaction ? '' : defaultWallet),
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const cats = categories.filter((c) => type !== 'transfer' && c.type === type)

  function changeType(t: TransactionType) {
    setType(t)
    // หมวดของรับกับจ่ายใช้แทนกันไม่ได้
    if (categoryId && data.categoryMap.get(categoryId)?.type !== t) setCategoryId('')
    // ให้กระเป๋าที่เลือกไว้ตามไปด้วยเมื่อสลับรับ/จ่าย
    if (t === 'income' && type === 'expense') setDest(source)
    if (t === 'expense' && type === 'income') setSource(dest)
    if (t === 'transfer') {
      const from = type === 'income' ? dest : source
      setSource(from)
      setDest(wallets.find((w) => w.id !== from)?.id ?? '')
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (value === null || value <= 0) return setError('กรุณาใส่จำนวนเงินมากกว่า 0')
    setSaving(true)
    setError('')
    const input = {
      type,
      amount: value,
      date,
      note,
      categoryId: categoryId || undefined,
      sourceWalletId: source,
      destinationWalletId: dest,
    }
    try {
      if (transaction) await updateTransaction(transaction.id, input)
      else await addTransaction(input)
      setPref('lastWallet', type === 'income' ? dest : source)
      toast(transaction ? 'แก้ไขรายการแล้ว' : `บันทึก${TX_META[type].label} ${formatBaht(value)} แล้ว`)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  async function remove() {
    if (!transaction) return
    const ok = await confirm({
      title: 'ลบรายการนี้?',
      danger: true,
      confirmLabel: 'ลบรายการ',
      message: (
        <p>
          {TX_META[transaction.type].label} {formatBaht(transaction.amount)} จะถูกลบ และยอดกระเป๋าจะคำนวณใหม่
        </p>
      ),
    })
    if (!ok) return
    try {
      await deleteTransaction(transaction.id)
      toast('ลบรายการแล้ว')
      onClose()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }


  const meta = TX_META[type]

  return (
    <Sheet
      title={transaction ? 'แก้ไขรายการ' : 'จดรายการ'}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex gap-3">
          {transaction && (
            <button type="button" className="btn-secondary text-expense" onClick={remove} aria-label="ลบรายการนี้">
              <Trash2 size={18} aria-hidden />
              <span className="hidden sm:inline">ลบ</span>
            </button>
          )}
          <button type="submit" form="tx-form" className={`btn-primary flex-1 text-base`} disabled={saving}>
            {saving ? 'กำลังบันทึก…' : `บันทึก${meta.label}`}
          </button>
        </div>
      }
    >
      <form id="tx-form" onSubmit={submit} className="space-y-5">
        <div role="radiogroup" aria-label="ประเภทรายการ" className="segmented">
          {(['expense', 'income', 'transfer'] as TransactionType[]).map((t) => {
            const M = TX_META[t]
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                onClick={() => changeType(t)}
                disabled={t === 'transfer' && wallets.length < 2}
                className="inline-flex min-h-10! items-center justify-center gap-1.5 font-semibold! disabled:opacity-40"
              >
                <M.Icon size={16} strokeWidth={2.4} className={type === t ? M.text : ''} aria-hidden />
                {M.label}
              </button>
            )
          })}
        </div>

        <div className={`rounded-2xl px-4 py-4 ${meta.soft}`}>
          <label className="text-sm font-medium text-ink-2" htmlFor="t-amount">
            จำนวนเงิน (บาท)
          </label>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-3xl font-semibold ${meta.text}`} aria-hidden>
              ฿
            </span>
            <input
              id="t-amount"
              className={`num w-full min-w-0 bg-transparent text-4xl font-bold tracking-tight placeholder:text-ink/20 focus:outline-none ${meta.text}`}
              inputMode="decimal"
              autoComplete="off"
              autoFocus={!transaction}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              required
            />
          </div>
        </div>

        {type === 'transfer' ? (
          <>
            <WalletPicker label="โอนจาก" wallets={wallets} balances={balances} value={source} onChange={setSource} />
            <WalletPicker
              label="ไปยัง"
              wallets={wallets}
              balances={balances}
              value={dest}
              onChange={setDest}
              disabledId={source}
            />
          </>
        ) : (
          <WalletPicker
            label={type === 'income' ? 'เข้ากระเป๋า' : 'จ่ายจากกระเป๋า'}
            wallets={wallets}
            balances={balances}
            value={type === 'income' ? dest : source}
            onChange={type === 'income' ? setDest : setSource}
          />
        )}

        {type !== 'transfer' && (
          <fieldset>
            <legend className="label">
              หมวดหมู่ <span className="font-normal text-muted">(ไม่บังคับ)</span>
            </legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {cats.map((c) => {
                const on = categoryId === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCategoryId(on ? '' : c.id)}
                    className={`flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl border px-1 text-xs transition-colors ${
                      on ? 'border-brand bg-brand-soft font-semibold text-brand' : 'border-line text-ink-2 hover:bg-sunken'
                    }`}
                  >
                    <span className="text-xl" aria-hidden>
                      {c.icon}
                    </span>
                    <span className="line-clamp-1">{c.name}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
          <div>
            <label className="label" htmlFor="t-date">
              วันที่
            </label>
            <input
              id="t-date"
              type="date"
              className="field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="t-note">
              รายละเอียด <span className="font-normal text-muted">(ไม่บังคับ)</span>
            </label>
            <input
              id="t-note"
              className="field"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ข้าวกลางวัน"
              maxLength={200}
            />
          </div>
        </div>

        {error && <FormError>{error}</FormError>}

        {transaction && (
          <p className="text-center text-xs text-muted">
            บันทึกเมื่อ {formatTimestamp(transaction.createdAt)}
            {transaction.updatedAt !== transaction.createdAt &&
              ` · แก้ไขล่าสุด ${formatTimestamp(transaction.updatedAt)}`}
          </p>
        )}
      </form>
    </Sheet>
  )
}
