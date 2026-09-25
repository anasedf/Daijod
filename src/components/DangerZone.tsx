import { TriangleAlert } from 'lucide-react'
import type { AppData } from '../hooks/useData'
import { deleteAllTransactions, deleteImportedTransactions, resetAllData } from '../lib/db'
import { errorMessage, useConfirm, useToast } from './ui'

/** ลบข้อมูลเป็นชุด แยกระดับให้เลือกว่าจะเก็บอะไรไว้ */
export function DangerZone({ data }: { data: AppData }) {
  const toast = useToast()
  const confirm = useConfirm()
  const imported = data.transactions.filter((t) => t.importKey).length
  const backupHint = <p className="text-sm text-muted">ถ้ายังไม่แน่ใจ กด “ดาวน์โหลดไฟล์สำรอง” เก็บไว้ก่อน</p>

  async function run(ok: boolean, action: () => Promise<number | void>, done: (n: number | void) => string) {
    if (!ok) return
    try {
      toast(done(await action()))
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  async function removeImported() {
    const ok = await confirm({
      title: `ลบรายการที่นำเข้าจาก statement ${imported} รายการ?`,
      danger: true,
      confirmLabel: `ลบ ${imported} รายการ`,
      message: (
        <div className="space-y-2">
          <p>รายการที่จดมือเอง กระเป๋า หมวด รายการประจำ และกฎจัดหมวด ยังอยู่ครบ นำเข้าไฟล์เดิมใหม่ได้ทันที</p>
          {backupHint}
        </div>
      ),
    })
    await run(ok, deleteImportedTransactions, (n) => `ลบรายการที่นำเข้า ${n} รายการแล้ว`)
  }

  async function removeTransactions() {
    const ok = await confirm({
      title: `ลบรายการทั้งหมด ${data.transactions.length} รายการ?`,
      danger: true,
      confirmLabel: 'ลบรายการทั้งหมด',
      message: (
        <div className="space-y-2">
          <p>
            กระเป๋า หมวด รายการประจำ และกฎจัดหมวด ยังอยู่ครบ ยอดแต่ละกระเป๋าจะกลับไปเท่า<b className="text-ink">ยอดตั้งต้น</b>
          </p>
          {backupHint}
        </div>
      ),
    })
    await run(ok, deleteAllTransactions, (n) => `ลบ ${n} รายการแล้ว`)
  }

  async function resetAll() {
    const ok = await confirm({
      title: 'ลบทุกอย่างและเริ่มใหม่?',
      danger: true,
      confirmLabel: 'ลบทุกอย่าง',
      message: (
        <div className="space-y-2">
          <p>
            กระเป๋า <b className="text-ink">{data.wallets.length}</b> ใบ, รายการ <b className="text-ink">{data.transactions.length}</b>{' '}
            รายการ และรายการประจำ จะถูกลบทั้งหมดและ<b className="text-ink">กู้คืนไม่ได้</b> หมวดหมู่กลับเป็นค่าเริ่มต้น
          </p>
          {backupHint}
        </div>
      ),
    })
    await run(ok, resetAllData, () => 'ลบข้อมูลทั้งหมดแล้ว')
  }

  const rows: { title: string; desc: string; label: string; onClick: () => void; disabled: boolean; danger?: boolean }[] = [
    {
      title: 'ลบเฉพาะรายการที่นำเข้าจาก statement',
      desc: `${imported} รายการ · ใช้เมื่ออยากนำเข้าไฟล์เดิมใหม่ตั้งแต่ต้น`,
      label: 'ลบที่นำเข้า',
      onClick: removeImported,
      disabled: imported === 0,
    },
    {
      title: 'ลบรายการทั้งหมด',
      desc: `${data.transactions.length} รายการ · เก็บกระเป๋า หมวด รายการประจำ และกฎไว้`,
      label: 'ลบรายการ',
      onClick: removeTransactions,
      disabled: data.transactions.length === 0,
    },
    {
      title: 'ลบทุกอย่าง เริ่มใหม่',
      desc: 'กระเป๋า รายการ รายการประจำ หมวดกลับเป็นค่าเริ่มต้น',
      label: 'ลบทุกอย่าง',
      onClick: resetAll,
      disabled: data.wallets.length === 0 && data.transactions.length === 0,
      danger: true,
    },
  ]

  return (
    <section className="card border-expense/30 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-expense-soft text-expense" aria-hidden>
          <TriangleAlert size={20} />
        </span>
        <div>
          <h2 className="card-title">ลบข้อมูล</h2>
          <p className="text-xs text-muted">ลบแล้วกู้คืนไม่ได้ ถ้าจะลบแค่บางรายการ ไปที่หน้า “รายการ” แล้วกด “เลือก”</p>
        </div>
      </div>
      <ul className="mt-4 divide-y divide-line/70">
        {rows.map((r) => (
          <li key={r.title} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{r.title}</span>
              <span className="block text-xs text-muted">{r.desc}</span>
            </span>
            <button
              className={`${r.danger ? 'btn-danger' : 'btn-secondary text-expense'} min-h-9 px-3 text-sm`}
              onClick={r.onClick}
              disabled={r.disabled}
            >
              {r.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
