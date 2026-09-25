import { useState, type FormEvent } from 'react'
import { addWallet, updateWallet } from '../lib/db'
import { WALLET_COLORS, WALLET_TYPES } from '../lib/labels'
import { amountToInput, formatBaht, parseAmount } from '../lib/money'
import type { Wallet, WalletType } from '../lib/types'
import { errorMessage, FormError, Sheet, useToast } from './ui'

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

  const preview = parseAmount(opening) ?? 0
  const { Icon } = WALLET_TYPES[type]

  return (
    <Sheet
      title={wallet ? 'แก้ไขกระเป๋า' : 'เพิ่มกระเป๋า'}
      onClose={onClose}
      footer={
        <button type="submit" form="wallet-form" className="btn-primary w-full" disabled={saving}>
          {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
      }
    >
      <form id="wallet-form" onSubmit={submit} className="space-y-5">
        {/* ตัวอย่างการ์ด */}
        <div
          className="relative overflow-hidden rounded-2xl p-4 text-white"
          style={{ background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 70%, black))` }}
          aria-hidden
        >
          <Icon size={110} strokeWidth={1.2} className="absolute -right-4 -bottom-8 opacity-15" />
          <div className="flex items-center gap-2 text-sm opacity-85">
            <Icon size={16} /> {WALLET_TYPES[type].label}
          </div>
          <div className="mt-4 truncate font-semibold">{name.trim() || 'ชื่อกระเป๋า'}</div>
          <div className="num text-2xl font-bold">{formatBaht(preview)}</div>
        </div>

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
            autoFocus={!wallet}
          />
        </div>
        <fieldset>
          <legend className="label">ประเภท</legend>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(WALLET_TYPES) as WalletType[]).map((t) => {
              const T = WALLET_TYPES[t]
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={type === t}
                  onClick={() => setType(t)}
                  className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm transition-colors ${
                    type === t ? 'border-brand bg-brand-soft font-semibold text-brand' : 'border-line hover:bg-sunken'
                  }`}
                >
                  <T.Icon size={18} aria-hidden /> {T.label}
                </button>
              )
            })}
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="w-open">
            ยอดตั้งต้น (บาท)
          </label>
          <input
            id="w-open"
            className="field num"
            inputMode="decimal"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            placeholder="0"
          />
          <p className="mt-1.5 text-xs text-muted">ยอดเงินที่มีอยู่ตอนเริ่มจด ติดลบได้ (เช่น บัตรเครดิต)</p>
        </div>
        <fieldset>
          <legend className="label">สี</legend>
          <div className="flex flex-wrap gap-2.5">
            {WALLET_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                aria-label={`สีที่ ${i + 1}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`h-9 w-9 rounded-full transition-transform hover:scale-110 ${
                  color === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </fieldset>
        {error && <FormError>{error}</FormError>}
      </form>
    </Sheet>
  )
}
