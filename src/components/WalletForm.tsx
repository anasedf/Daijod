import { useState, type FormEvent } from 'react'
import { addWallet, updateWallet } from '../lib/db'
import { WALLET_COLORS, WALLET_TYPES } from '../lib/labels'
import { amountToInput, parseAmount } from '../lib/money'
import type { Wallet, WalletType } from '../lib/types'
import { errorMessage, Sheet, useToast } from './ui'

export function WalletForm({ wallet, onClose }: { wallet?: Wallet; onClose: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(wallet?.name ?? '')
  const [type, setType] = useState<WalletType>(wallet?.type ?? 'bank')
  const [color, setColor] = useState(wallet?.color ?? WALLET_COLORS[0])
  const [opening, setOpening] = useState(wallet ? amountToInput(wallet.openingBalance) : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const openingBalance = opening.trim() === '' ? 0 : parseAmount(opening)
    if (openingBalance === null) return setError('ยอดตั้งต้นต้องเป็นตัวเลข เช่น 1500 หรือ 1500.50')
    setSaving(true)
    setError('')
    try {
      const input = { name, type, color, openingBalance }
      if (wallet) await updateWallet(wallet.id, input)
      else await addWallet(input)
      toast(wallet ? 'แก้ไขกระเป๋าแล้ว' : 'เพิ่มกระเป๋าแล้ว')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Sheet title={wallet ? 'แก้ไขกระเป๋า' : 'เพิ่มกระเป๋า'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="w-name">
            ชื่อ
          </label>
          <input
            id="w-name"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น กสิกร, TrueMoney"
            maxLength={40}
            required
          />
        </div>
        <fieldset>
          <legend className="label">ประเภท</legend>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(WALLET_TYPES) as WalletType[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={`min-h-12 rounded-xl border px-3 text-left ${
                  type === t ? 'border-teal-700 bg-teal-50 font-semibold' : 'border-slate-300'
                }`}
              >
                {WALLET_TYPES[t].icon} {WALLET_TYPES[t].label}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="w-open">
            ยอดตั้งต้น (บาท)
          </label>
          <input
            id="w-open"
            className="field"
            inputMode="decimal"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            placeholder="0"
          />
          <p className="mt-1 text-xs text-slate-500">ยอดเงินที่มีอยู่ตอนเริ่มจด ติดลบได้ (เช่น บัตรเครดิต)</p>
        </div>
        <fieldset>
          <legend className="label">สี</legend>
          <div className="flex flex-wrap gap-2">
            {WALLET_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                aria-label={`สีที่ ${i + 1}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`h-10 w-10 rounded-full ${color === c ? 'ring-4 ring-slate-400 ring-offset-2' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            ⚠️ {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={saving}>
          {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
      </form>
    </Sheet>
  )
}
