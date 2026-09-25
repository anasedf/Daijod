import { CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { AppData } from '../hooks/useData'
import { addRecurring, deleteRecurring, updateRecurring } from '../lib/db'
import { formatDateShort, todayISO } from '../lib/dates'
import { TX_META } from '../lib/labels'
import { amountToInput, formatBaht, parseAmount } from '../lib/money'
import { upcomingRecurrings } from '../lib/recurring'
import type { Recurring, TransactionType } from '../lib/types'
import { WalletPicker } from './TransactionForm'
import { CategoryIcon, errorMessage, FormError, Sheet, useConfirm, useToast } from './ui'

export function RecurringForm({ data, recurring, onClose }: { data: AppData; recurring?: Recurring; onClose: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const { wallets, categories, balances } = data
  const first = wallets[0]?.id ?? ''
  const [name, setName] = useState(recurring?.name ?? '')
  const [type, setType] = useState<TransactionType>(recurring?.type ?? 'expense')
  const [amount, setAmount] = useState(recurring ? amountToInput(recurring.amount) : '')
  const [day, setDay] = useState(recurring?.day ?? 1)
  const [note, setNote] = useState(recurring?.note ?? '')
  const [categoryId, setCategoryId] = useState(recurring?.categoryId ?? '')
  const [source, setSource] = useState(recurring?.sourceWalletId ?? first)
  const [dest, setDest] = useState(recurring?.destinationWalletId ?? (recurring ? '' : first))
  const [active, setActive] = useState(recurring?.active ?? true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const cats = categories.filter((c) => type !== 'transfer' && c.type === type)

  function changeType(t: TransactionType) {
    setType(t)
    if (categoryId && data.categoryMap.get(categoryId)?.type !== t) setCategoryId('')
    if (t === 'transfer') setDest(wallets.find((w) => w.id !== source)?.id ?? '')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (value === null || value <= 0) return setError('กรุณาใส่จำนวนเงินมากกว่า 0')
    setSaving(true)
    setError('')
    const input = {
      name,
      type,
      amount: value,
      day,
      note,
      categoryId: categoryId || undefined,
      sourceWalletId: type === 'income' ? undefined : source,
      destinationWalletId: type === 'expense' ? undefined : dest,
      active,
    }
    try {
      if (recurring) await updateRecurring(recurring.id, input)
      else await addRecurring(input)
      toast(recurring ? 'แก้ไขรายการประจำแล้ว' : 'เพิ่มรายการประจำแล้ว')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  async function remove() {
    if (!recurring) return
    const ok = await confirm({
      title: `ลบรายการประจำ “${recurring.name}”?`,
      message: <p>รายการที่เคยบันทึกไปแล้วจะยังอยู่ แค่จะไม่ถามอีก</p>,
      confirmLabel: 'ลบ',
      danger: true,
    })
    if (!ok) return
    await deleteRecurring(recurring.id)
    toast('ลบรายการประจำแล้ว')
    onClose()
  }

  return (
    <Sheet
      title={recurring ? 'แก้ไขรายการประจำ' : 'เพิ่มรายการประจำ'}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex gap-3">
          {recurring && (
            <button type="button" className="btn-secondary text-expense" onClick={remove}>
              <Trash2 size={18} aria-hidden /> ลบ
            </button>
          )}
          <button type="submit" form="recurring-form" className="btn-primary flex-1" disabled={saving}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      }
    >
      <form id="recurring-form" onSubmit={submit} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <div>
            <label className="label" htmlFor="r-name">
              ชื่อ
            </label>
            <input id="r-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ค่าห้อง" maxLength={40} required autoFocus={!recurring} />
          </div>
          <div>
            <label className="label" htmlFor="r-day">
              ทุกวันที่
            </label>
            <select id="r-day" className="field" value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div role="radiogroup" aria-label="ประเภทรายการ" className="segmented">
          {(['expense', 'income', 'transfer'] as TransactionType[]).map((t) => {
            const M = TX_META[t]
            return (
              <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => changeType(t)} disabled={t === 'transfer' && wallets.length < 2} className="inline-flex items-center justify-center gap-1.5 font-semibold! disabled:opacity-40">
                <M.Icon size={16} className={type === t ? M.text : ''} aria-hidden />
                {M.label}
              </button>
            )
          })}
        </div>

        <div>
          <label className="label" htmlFor="r-amount">
            จำนวนเงิน (บาท)
          </label>
          <input id="r-amount" className="field num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required />
        </div>

        {type === 'transfer' ? (
          <>
            <WalletPicker label="โอนจาก" wallets={wallets} balances={balances} value={source} onChange={setSource} />
            <WalletPicker label="ไปยัง" wallets={wallets} balances={balances} value={dest} onChange={setDest} disabledId={source} />
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
                  <button key={c.id} type="button" aria-pressed={on} onClick={() => setCategoryId(on ? '' : c.id)} className={`flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl border px-1 text-xs transition-colors ${on ? 'border-brand bg-brand-soft font-semibold text-brand' : 'border-line text-ink-2 hover:bg-sunken'}`}>
                    <CategoryIcon category={c} size="sm" />
                    <span className="line-clamp-1">{c.name}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        <div>
          <label className="label" htmlFor="r-note">
            รายละเอียด <span className="font-normal text-muted">(ไม่บังคับ ถ้าว่างใช้ชื่อ)</span>
          </label>
          <input id="r-note" className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </div>

        {recurring && (
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-brand" checked={active} onChange={(e) => setActive(e.target.checked)} />
            เปิดใช้งาน (ปิดไว้จะไม่ถามให้บันทึก)
          </label>
        )}

        {error && <FormError>{error}</FormError>}
      </form>
    </Sheet>
  )
}

/** รายการประจำทั้งหมดในหน้าตั้งค่า */
export function RecurringSection({ data }: { data: AppData }) {
  const [editing, setEditing] = useState<Recurring | 'new' | null>(null)
  const nextDate = new Map(upcomingRecurrings(data.recurrings, todayISO()).map((d) => [d.rec.id, d.date]))

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand" aria-hidden>
            <CalendarClock size={20} />
          </span>
          <div>
            <h2 className="card-title">รายการประจำ</h2>
            <p className="text-xs text-muted">ถึงวันที่กำหนด หน้าภาพรวมจะถามให้บันทึก</p>
          </div>
        </div>
        <button className="btn-ghost -mr-2 min-h-9 px-3 text-sm text-brand" onClick={() => setEditing('new')} disabled={data.wallets.length === 0}>
          <Plus size={16} aria-hidden /> เพิ่ม
        </button>
      </div>
      {data.recurrings.length === 0 ? (
        <p className="text-sm text-muted">ยังไม่มี · เช่น ค่าห้องทุกวันที่ 1, ค่าเน็ตทุกวันที่ 20, เงินเดือนทุกวันที่ 25</p>
      ) : (
        <ul className="divide-y divide-line/70">
          {data.recurrings.map((r) => {
            const meta = TX_META[r.type]
            const cat = r.categoryId ? data.categoryMap.get(r.categoryId) : undefined
            return (
              <li key={r.id} className={`flex items-center gap-3 py-2.5 ${r.active ? '' : 'opacity-50'}`}>
                <CategoryIcon category={cat} size="sm" fallback={<meta.Icon size={15} className={meta.text} />} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="block text-xs text-muted">
                    ทุกวันที่ {r.day} · {r.active ? `ครั้งถัดไป ${formatDateShort(nextDate.get(r.id) ?? '')}` : 'ปิดอยู่'}
                  </span>
                </span>
                <span className={`num text-sm font-semibold ${r.type === 'transfer' ? 'text-ink-2' : meta.text}`}>
                  {meta.sign}
                  {formatBaht(r.amount)}
                </span>
                <button className="icon-btn h-8 w-8" onClick={() => setEditing(r)} aria-label={`แก้ไข ${r.name}`}>
                  <Pencil size={15} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {editing && <RecurringForm data={data} recurring={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </section>
  )
}
