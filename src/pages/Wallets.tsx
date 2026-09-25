import { Pencil, Plus, Trash2, Wallet as WalletGlyph } from 'lucide-react'
import { useMemo, useState } from 'react'
import { WalletForm } from '../components/WalletForm'
import { EmptyState, errorMessage, PageHeader, useConfirm, useToast } from '../components/ui'
import type { AppData } from '../hooks/useData'
import { deleteWalletWithTransactions, transactionsOfWallet } from '../lib/db'
import { inRange, monthRange } from '../lib/dates'
import { WALLET_TYPES } from '../lib/labels'
import { effectOn } from '../lib/ledger'
import { formatBaht } from '../lib/money'
import type { Wallet } from '../lib/types'

export function WalletsPage({ data }: { data: AppData }) {
  const [editing, setEditing] = useState<Wallet | 'new' | null>(null)
  const confirm = useConfirm()
  const toast = useToast()

  // เงินเข้า/ออกของแต่ละกระเป๋าในเดือนนี้ (รวมการโอน)
  const flow = useMemo(() => {
    const month = monthRange()
    const out = new Map<string, { in: number; out: number }>()
    for (const w of data.wallets) out.set(w.id, { in: 0, out: 0 })
    for (const tx of data.transactions) {
      if (!inRange(tx.date, month)) continue
      for (const id of [tx.sourceWalletId, tx.destinationWalletId]) {
        const f = id && out.get(id)
        if (!f) continue
        const e = effectOn(tx, id)
        if (e > 0) f.in += e
        else f.out -= e
      }
    }
    return out
  }, [data])

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
            กระเป๋านี้มี <b className="text-ink">{related.length} รายการ</b> ซึ่งจะถูกลบไปด้วยและกู้คืนไม่ได้
          </p>
          {transfers > 0 && <p>ในนั้นมีการโอน {transfers} รายการ ยอดของกระเป๋าอีกฝั่งจะเปลี่ยนไปด้วย</p>}
          <p className="text-sm text-muted">แนะนำให้สำรองข้อมูลในหน้า “ตั้งค่า” ก่อน</p>
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
    <>
      <PageHeader
        title="กระเป๋า"
        subtitle={
          data.wallets.length ? (
            <>
              ยอดรวม <span className="num font-semibold text-ink">{formatBaht(data.total)}</span> จาก {data.wallets.length}{' '}
              กระเป๋า
            </>
          ) : undefined
        }
        actions={
          data.wallets.length > 0 && (
            <button className="btn-primary hidden sm:inline-flex" onClick={() => setEditing('new')}>
              <Plus size={18} aria-hidden /> เพิ่มกระเป๋า
            </button>
          )
        }
      />

      {data.wallets.length === 0 ? (
        <div className="card mx-auto max-w-lg">
          <EmptyState
            icon={WalletGlyph}
            title="ยังไม่มีกระเป๋า"
            action={
              <button className="btn-primary" onClick={() => setEditing('new')}>
                <Plus size={18} aria-hidden /> เพิ่มกระเป๋าแรก
              </button>
            }
          >
            เพิ่มกระเป๋าแรกเพื่อเริ่มจดได้เลย
          </EmptyState>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.wallets.map((w) => {
            const bal = data.balances.get(w.id) ?? 0
            const f = flow.get(w.id)!
            const { Icon, label } = WALLET_TYPES[w.type]
            return (
              <li key={w.id} className="card overflow-hidden">
                <div
                  className="relative overflow-hidden p-5 text-white"
                  style={{ background: `linear-gradient(135deg, ${w.color}, color-mix(in oklab, ${w.color} 70%, black))` }}
                >
                  <div className="pointer-events-none absolute -right-6 -bottom-10 opacity-15" aria-hidden>
                    <Icon size={140} strokeWidth={1.2} />
                  </div>
                  <div className="relative flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                      <Icon size={18} aria-hidden />
                      <span className="opacity-85">{label}</span>
                    </div>
                    <div className="-mt-1.5 -mr-2 flex">
                      <button
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white"
                        onClick={() => setEditing(w)}
                        aria-label={`แก้ไข ${w.name}`}
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white"
                        onClick={() => remove(w)}
                        aria-label={`ลบ ${w.name}`}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                  <div className="relative mt-5 truncate text-lg font-semibold">{w.name}</div>
                  <div className="num relative text-3xl font-bold tracking-tight">{formatBaht(bal)}</div>
                </div>
                <dl className="grid grid-cols-3 divide-x divide-line text-center text-xs">
                  <div className="px-2 py-3">
                    <dt className="text-muted">เข้าเดือนนี้</dt>
                    <dd className="num mt-0.5 font-semibold text-income">+{formatBaht(f.in)}</dd>
                  </div>
                  <div className="px-2 py-3">
                    <dt className="text-muted">ออกเดือนนี้</dt>
                    <dd className="num mt-0.5 font-semibold text-expense">−{formatBaht(f.out)}</dd>
                  </div>
                  <div className="px-2 py-3">
                    <dt className="text-muted">ยอดตั้งต้น</dt>
                    <dd className="num mt-0.5 font-semibold text-ink-2">{formatBaht(w.openingBalance)}</dd>
                  </div>
                </dl>
              </li>
            )
          })}
          <li>
            <button
              onClick={() => setEditing('new')}
              className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-ink-2 transition-colors hover:border-brand hover:bg-brand-soft/50 hover:text-brand"
            >
              <Plus size={24} aria-hidden />
              <span className="font-medium">เพิ่มกระเป๋า</span>
            </button>
          </li>
        </ul>
      )}

      {editing && <WalletForm wallet={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
