import { useState } from 'react'
import { WalletForm } from '../components/WalletForm'
import { errorMessage, useConfirm, useToast } from '../components/ui'
import type { AppData } from '../hooks/useData'
import { deleteWalletWithTransactions, transactionsOfWallet } from '../lib/db'
import { WALLET_TYPES } from '../lib/labels'
import { formatBaht } from '../lib/money'
import type { Wallet } from '../lib/types'

export function WalletsPage({ data }: { data: AppData }) {
  const [editing, setEditing] = useState<Wallet | 'new' | null>(null)
  const confirm = useConfirm()
  const toast = useToast()

  async function remove(w: Wallet) {
    const related = await transactionsOfWallet(w.id)
    const transfers = related.filter((t) => t.type === 'transfer').length
    const ok = await confirm({
      title: `ลบกระเป๋า “${w.name}”?`,
      danger: true,
      confirmLabel: related.length ? `ลบกระเป๋าและ ${related.length} รายการ` : 'ลบกระเป๋า',
      message: related.length ? (
        <div className="space-y-2">
          <p>
            กระเป๋านี้มี <b>{related.length} รายการ</b> ซึ่งจะถูกลบไปด้วยและกู้คืนไม่ได้
          </p>
          {transfers > 0 && (
            <p>
              ในนั้นมีการโอน {transfers} รายการ ยอดของกระเป๋าอีกฝั่งจะเปลี่ยนไปด้วย
            </p>
          )}
          <p className="text-sm text-slate-500">แนะนำให้สำรองข้อมูลในหน้า “ตั้งค่า” ก่อน</p>
        </div>
      ) : (
        <p>กระเป๋านี้ยังไม่มีรายการ</p>
      ),
    })
    if (!ok) return
    try {
      await deleteWalletWithTransactions(w.id)
      toast('ลบกระเป๋าแล้ว')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex items-baseline justify-between">
        <span className="text-slate-600">ยอดรวมทุกกระเป๋า</span>
        <span className="text-2xl font-bold tabular-nums">{formatBaht(data.total)}</span>
      </div>

      {data.wallets.length === 0 && (
        <p className="card text-center text-slate-500">ยังไม่มีกระเป๋า เพิ่มกระเป๋าแรกเพื่อเริ่มจดได้เลย</p>
      )}

      <ul className="space-y-2">
        {data.wallets.map((w) => (
          <li key={w.id} className="card flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
              style={{ backgroundColor: w.color + '22', boxShadow: `inset 0 0 0 2px ${w.color}` }}
              aria-hidden
            >
              {WALLET_TYPES[w.type].icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{w.name}</div>
              <div className="text-xs text-slate-500">
                {WALLET_TYPES[w.type].label} · ตั้งต้น {formatBaht(w.openingBalance)}
              </div>
            </div>
            <div className="text-right">
              <div className={`font-semibold tabular-nums ${(data.balances.get(w.id) ?? 0) < 0 ? 'text-red-700' : ''}`}>
                {formatBaht(data.balances.get(w.id) ?? 0)}
              </div>
              <div className="mt-1 flex justify-end gap-1 text-sm">
                <button className="rounded-lg px-2 py-1 text-teal-700 hover:bg-teal-50" onClick={() => setEditing(w)}>
                  แก้ไข
                </button>
                <button className="rounded-lg px-2 py-1 text-red-700 hover:bg-red-50" onClick={() => remove(w)}>
                  ลบ
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button className="btn-secondary w-full" onClick={() => setEditing('new')}>
        + เพิ่มกระเป๋า
      </button>

      {editing && (
        <WalletForm wallet={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
