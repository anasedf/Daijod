import { useState, type FormEvent } from 'react'
import type { AppData } from '../hooks/useData'
import { addTransaction, deleteTransaction, updateTransaction } from '../lib/db'
import { formatTimestamp, todayISO } from '../lib/dates'
import { TX_META } from '../lib/labels'
import { amountToInput, formatBaht, parseAmount } from '../lib/money'
import { getPref, setPref } from '../lib/prefs'
import type { Transaction, TransactionType, Wallet } from '../lib/types'
import { errorMessage, Sheet, useConfirm, useToast } from './ui'

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
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
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
              className={`min-h-12 shrink-0 rounded-xl border px-3 py-1 text-left disabled:opacity-40 ${
                selected ? 'border-2 font-semibold' : 'border-slate-300'
              }`}
              style={selected ? { borderColor: w.color, backgroundColor: w.color + '14' } : undefined}
            >
              <div className="text-sm">{w.name}</div>
              <div className="text-xs tabular-nums text-slate-500">{formatBaht(balances.get(w.id) ?? 0)}</div>
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
    <Sheet title={transaction ? 'แก้ไขรายการ' : 'เพิ่มรายการ'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div role="radiogroup" aria-label="ประเภทรายการ" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {(['expense', 'income', 'transfer'] as TransactionType[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => changeType(t)}
              disabled={t === 'transfer' && wallets.length < 2}
              className={`min-h-11 rounded-lg font-semibold disabled:opacity-40 ${
                type === t ? `${TX_META[t].activeBg} text-white shadow` : 'text-slate-600'
              }`}
            >
              {TX_META[t].icon} {TX_META[t].label}
            </button>
          ))}
        </div>

        <div>
          <label className="label" htmlFor="t-amount">
            จำนวนเงิน (บาท)
          </label>
          <div className="relative">
            <span className={`absolute top-1/2 left-3 -translate-y-1/2 text-2xl ${meta.text}`}>฿</span>
            <input
              id="t-amount"
              className={`field h-16 pl-10 text-3xl font-bold tabular-nums ${meta.text}`}
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
            <legend className="label">หมวดหมู่ (ไม่บังคับ)</legend>
            <div className="grid grid-cols-4 gap-2">
              {cats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={categoryId === c.id}
                  onClick={() => setCategoryId(categoryId === c.id ? '' : c.id)}
                  className={`flex min-h-16 flex-col items-center justify-center rounded-xl border px-1 text-xs ${
                    categoryId === c.id ? 'border-2 border-teal-700 bg-teal-50 font-semibold' : 'border-slate-200'
                  }`}
                >
                  <span className="text-xl" aria-hidden>
                    {c.icon}
                  </span>
                  <span className="line-clamp-1">{c.name}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <div className="grid grid-cols-2 gap-3">
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
              รายละเอียด
            </label>
            <input
              id="t-note"
              className="field"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ไม่บังคับ"
              maxLength={200}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="whitespace-pre-line rounded-lg bg-red-50 p-3 text-sm text-red-800">
            ⚠️ {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full text-lg" disabled={saving}>
          {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>

        {transaction && (
          <>
            <button type="button" className="btn-secondary w-full text-red-700" onClick={remove}>
              ลบรายการนี้
            </button>
            <p className="text-center text-xs text-slate-500">
              บันทึกเมื่อ {formatTimestamp(transaction.createdAt)}
              {transaction.updatedAt !== transaction.createdAt &&
                ` · แก้ไขล่าสุด ${formatTimestamp(transaction.updatedAt)}`}
            </p>
          </>
        )}
      </form>
    </Sheet>
  )
}
