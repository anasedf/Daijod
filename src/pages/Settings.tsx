import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Download, FileUp, HardDrive, Pencil, Plus, Trash2, Upload, Wallet } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { DangerZone } from '../components/DangerZone'
import { ImportRules } from '../components/ImportRules'
import { ImportSheet } from '../components/ImportSheet'
import { RecurringSection } from '../components/RecurringForm'
import { CategoryIcon, errorMessage, FormError, PageHeader, Sheet, useConfirm, useToast } from '../components/ui'
import type { Tab } from '../App'
import type { AppData } from '../hooks/useData'
import { formatBaht } from '../lib/money'
import {
  addCategory,
  countCategoryUse,
  deleteCategory,

  importBackup,
  setCategoryOrder,
  updateCategory,
} from '../lib/db'
import { downloadBackup, lastBackupAt } from '../lib/backup'
import { formatTimestamp } from '../lib/dates'
import { CATEGORY_COLORS, ICON_GROUPS } from '../lib/icons'
import { amountToInput, parseAmount } from '../lib/money'
import type { Category, CategoryType } from '../lib/types'

/** ยืนยันลบหมวด ถ้ามีรายการใช้อยู่ให้เลือกว่าจะย้ายไปหมวดไหน */
function DeleteCategorySheet({
  category,
  categories,
  onClose,
  onDeleted,
}: {
  category: Category
  categories: Category[]
  onClose: () => void
  onDeleted: () => void
}) {
  const toast = useToast()
  const [used, setUsed] = useState<number | null>(null)
  const [moveTo, setMoveTo] = useState('')
  const [busy, setBusy] = useState(false)
  const targets = categories.filter((c) => c.type === category.type && c.id !== category.id)

  useEffect(() => {
    countCategoryUse(category.id).then(setUsed)
  }, [category.id])

  async function run() {
    setBusy(true)
    try {
      await deleteCategory(category.id, used ? moveTo || null : undefined)
      toast(used ? `ลบหมวดแล้ว ย้าย ${used} รายการเรียบร้อย` : 'ลบหมวดแล้ว')
      onDeleted()
    } catch (e) {
      toast(errorMessage(e), 'error')
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={`ลบหมวด “${category.name}”?`}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            ยกเลิก
          </button>
          <button type="button" className="btn-danger flex-1" onClick={run} disabled={busy || used === null}>
            {busy ? 'กำลังลบ…' : used ? 'ย้ายรายการและลบหมวด' : 'ลบหมวด'}
          </button>
        </div>
      }
    >
      {used === null ? (
        <p className="text-muted">กำลังตรวจสอบ…</p>
      ) : used === 0 ? (
        <p className="text-ink-2">หมวดนี้ยังไม่มีรายการใช้อยู่ ลบได้เลย</p>
      ) : (
        <div className="space-y-4">
          <p className="text-ink-2">
            มี <b className="text-ink">{used} รายการ</b> ใช้หมวดนี้อยู่ เลือกว่าจะย้ายรายการเหล่านั้นไปหมวดไหน
          </p>
          <div>
            <label className="label" htmlFor="c-move">
              ย้ายไปหมวด
            </label>
            <select id="c-move" className="field" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">ไม่ระบุหมวด</option>
              {targets.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function CategoryForm({
  category,
  type,
  onClose,
  onDelete,
}: {
  category?: Category
  type: CategoryType
  onClose: () => void
  onDelete?: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState(category?.name ?? '')
  const [iconName, setIconName] = useState(category?.iconName ?? (category ? '' : type === 'income' ? 'Coins' : 'Package'))
  const [emoji, setEmoji] = useState(category?.iconName ? '' : category?.icon ?? '')
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0])
  const [budget, setBudget] = useState(category?.budget ? amountToInput(category.budget) : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const preview: Category = { id: '', name, type, icon: emoji || '📦', iconName: iconName || undefined, color }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const budgetSatang = budget.trim() === '' ? undefined : parseAmount(budget)
    if (budgetSatang === null || (budgetSatang !== undefined && budgetSatang < 0)) {
      return setError('งบประมาณต้องเป็นตัวเลข เช่น 6000')
    }
    setSaving(true)
    try {
      const input = {
        name,
        icon: emoji.trim() || '📦',
        iconName: iconName || undefined,
        color,
        budget: type === 'expense' ? budgetSatang || undefined : undefined,
      }
      if (category) await updateCategory(category.id, input)
      else await addCategory({ ...input, type })
      toast(category ? 'แก้ไขหมวดแล้ว' : 'เพิ่มหมวดแล้ว')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }


  return (
    <Sheet
      title={`${category ? 'แก้ไข' : 'เพิ่ม'}หมวด${type === 'income' ? 'รายรับ' : 'รายจ่าย'}`}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex gap-3">
          {category && onDelete && (
            <button type="button" className="btn-secondary text-expense" onClick={onDelete}>
              <Trash2 size={18} aria-hidden /> ลบ
            </button>
          )}
          <button type="submit" form="category-form" className="btn-primary flex-1" disabled={saving}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      }
    >
      <form id="category-form" onSubmit={submit} className="space-y-5">
        <div className="flex items-center gap-4">
          <CategoryIcon category={preview} size="lg" />
          <div className="flex-1">
            <label className="label" htmlFor="c-name">
              ชื่อหมวด
            </label>
            <input
              id="c-name"
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              required
              autoFocus={!category}
            />
          </div>
        </div>

        <fieldset>
          <legend className="label">สี</legend>
          <div className="flex flex-wrap gap-2.5">
            {CATEGORY_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                aria-label={`สีที่ ${i + 1}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                  color === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </fieldset>

        {type === 'expense' && (
          <div>
            <label className="label" htmlFor="c-budget">
              งบต่อเดือน (บาท) <span className="font-normal text-muted">(ไม่บังคับ)</span>
            </label>
            <input
              id="c-budget"
              className="field num"
              inputMode="decimal"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="เช่น 6000"
            />
            <p className="mt-1.5 text-xs text-muted">ตั้งแล้วหน้าภาพรวมจะบอกว่าเดือนนี้ใช้ไปเท่าไหร่ และเหลือใช้ได้วันละเท่าไหร่</p>
          </div>
        )}

        <fieldset>
          <legend className="label">ไอคอน</legend>
          <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-line p-3">
            {ICON_GROUPS.map((g) => (
              <div key={g.label}>
                <div className="mb-1.5 text-xs font-medium text-muted">{g.label}</div>
                <div className="flex flex-wrap gap-1.5">
                  {g.icons.map(({ name: n, Icon }) => {
                    const on = iconName === n
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-label={n}
                        aria-pressed={on}
                        onClick={() => {
                          setIconName(n)
                          setEmoji('')
                        }}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                          on ? 'ring-2 ring-brand' : 'hover:bg-sunken'
                        }`}
                        style={on ? { backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`, color } : undefined}
                      >
                        <Icon size={20} />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-ink-2">
            <label htmlFor="c-emoji" className="shrink-0">
              หรือใช้อีโมจิ
            </label>
            <input
              id="c-emoji"
              className="field min-h-9 w-20 text-center text-lg"
              value={emoji}
              maxLength={4}
              placeholder="🍜"
              onChange={(e) => {
                setEmoji(e.target.value)
                if (e.target.value) setIconName('')
              }}
            />
          </div>
        </fieldset>

        {error && <FormError>{error}</FormError>}
      </form>
    </Sheet>
  )
}

export function SettingsPage({ data, onNavigate }: { data: AppData; onNavigate?: (tab: Tab) => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const fileInput = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState<{ type: CategoryType; category?: Category } | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [importing, setImporting] = useState(false)
  const [sorting, setSorting] = useState<CategoryType | null>(null)

  /** สลับตำแหน่งหมวดกับตัวข้าง ๆ แล้วบันทึกลำดับใหม่ทั้งชุด */
  async function move(cats: Category[], i: number, delta: number) {
    const ids = cats.map((c) => c.id)
    const j = i + delta
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    try {
      await setCategoryOrder(ids)
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  const [backupTick, setBackupTick] = useState(0)
  const lastBackup = useMemo(() => lastBackupAt(), [backupTick]) // eslint-disable-line react-hooks/exhaustive-deps

  async function exportFile() {
    try {
      await downloadBackup()
      setBackupTick((t) => t + 1)
      toast('ดาวน์โหลดไฟล์สำรองแล้ว')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  async function importFile(file: File) {
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      return toast('อ่านไฟล์ไม่ได้ ไฟล์ต้องเป็น .json ที่ได้จากปุ่มสำรองข้อมูล', 'error')
    }
    const ok = await confirm({
      title: 'นำเข้าข้อมูล?',
      danger: true,
      confirmLabel: 'แทนที่ด้วยข้อมูลในไฟล์',
      message: (
        <p>
          ข้อมูลปัจจุบันทั้งหมด ({data.wallets.length} กระเป๋า, {data.transactions.length} รายการ) จะถูก
          <b className="text-ink">แทนที่</b>ด้วยข้อมูลในไฟล์ “{file.name}”
        </p>
      ),
    })
    if (!ok) return
    try {
      await importBackup(parsed)
      toast('นำเข้าข้อมูลแล้ว')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  return (
    <>
      <PageHeader title="ตั้งค่า" subtitle="กระเป๋า หมวดหมู่ และการสำรองข้อมูล" />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-5">
        <div className="space-y-4 lg:space-y-5">
          {/* มือถือไม่มีแท็บกระเป๋า ให้เข้าจากตรงนี้ */}
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('wallets')}
              className="card flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-sunken lg:hidden"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-strong" aria-hidden>
                <Wallet size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">กระเป๋า</span>
                <span className="block text-xs text-muted">
                  {data.wallets.length} กระเป๋า · รวม {formatBaht(data.total)}
                </span>
              </span>
              <ChevronRight size={18} className="text-muted" aria-hidden />
            </button>
          )}
          {(['expense', 'income'] as CategoryType[]).map((type) => {
            const cats = data.categories.filter((c) => c.type === type)
            return (
              <section key={type} className="card p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="card-title">หมวด{type === 'income' ? 'รายรับ' : 'รายจ่าย'}</h2>
                    <p className="text-xs text-muted">{cats.length} หมวด</p>
                  </div>
                  <div className="-mr-2 flex">
                    {cats.length > 1 && (
                      <button
                        className={`btn-ghost min-h-9 px-3 text-sm ${sorting === type ? 'text-brand' : ''}`}
                        onClick={() => setSorting(sorting === type ? null : type)}
                        aria-pressed={sorting === type}
                      >
                        <ArrowUpDown size={16} aria-hidden /> {sorting === type ? 'เสร็จ' : 'จัดเรียง'}
                      </button>
                    )}
                    <button className="btn-ghost min-h-9 px-3 text-sm text-brand" onClick={() => setEditing({ type })}>
                      <Plus size={16} aria-hidden /> เพิ่มหมวด
                    </button>
                  </div>
                </div>
                {sorting === type ? (
                  <ul className="divide-y divide-line/70 rounded-xl border border-line">
                    {cats.map((c, i) => (
                      <li key={c.id} className="flex items-center gap-2.5 py-1.5 pr-1.5 pl-3">
                        <CategoryIcon category={c} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                        <button className="icon-btn h-8 w-8" disabled={i === 0} onClick={() => move(cats, i, -1)} aria-label={`เลื่อน ${c.name} ขึ้น`}>
                          <ArrowUp size={16} />
                        </button>
                        <button className="icon-btn h-8 w-8" disabled={i === cats.length - 1} onClick={() => move(cats, i, 1)} aria-label={`เลื่อน ${c.name} ลง`}>
                          <ArrowDown size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {cats.map((c) => (
                    <li
                      key={c.id}
                      className="group relative flex items-center gap-0.5 rounded-xl border border-line pr-1 pl-2.5 transition-colors hover:border-brand/40"
                    >
                      <button
                        className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left text-sm"
                        onClick={() => setEditing({ type, category: c })}
                        aria-label={`แก้ไขหมวด ${c.name}`}
                      >
                        <CategoryIcon category={c} size="sm" />
                        <span className="truncate">{c.name}</span>
                      </button>
                      {/* มือถือ: ปุ่มอยู่ท้ายชิปเสมอ / จอใหญ่: ลอยทับด้านขวาเฉพาะตอนชี้ ไม่กินที่ชื่อ */}
                      <div className="flex items-center gap-0.5 lg:absolute lg:inset-y-0.5 lg:right-1 lg:rounded-lg lg:bg-surface lg:pl-1 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
                        <button
                          className="icon-btn hidden h-8 w-8 sm:inline-flex"
                          onClick={() => setEditing({ type, category: c })}
                          aria-label={`แก้ไข ${c.name}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-btn h-8 w-8 hover:text-expense"
                          onClick={() => setDeleting(c)}
                          aria-label={`ลบ ${c.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                )}
              </section>
            )
          })}

          <RecurringSection data={data} />

          <ImportRules data={data} />

          <DangerZone data={data} />
        </div>

        <div className="space-y-4 lg:sticky lg:top-8 lg:space-y-5">
          <section className="card p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand" aria-hidden>
                <FileUp size={20} />
              </span>
              <h2 className="card-title">นำเข้าจาก statement</h2>
            </div>
            <p className="mt-3 text-sm text-ink-2">
              อ่านรายการจากไฟล์ statement (กสิกรไทย, TrueMoney) แล้วตรวจก่อนบันทึก ไฟล์ถูกอ่านในเครื่องนี้เท่านั้น
            </p>
            <button className="btn-secondary mt-4 w-full" onClick={() => setImporting(true)} disabled={data.wallets.length === 0}>
              <FileUp size={18} aria-hidden /> เลือกไฟล์ statement
            </button>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand" aria-hidden>
                <HardDrive size={20} />
              </span>
              <h2 className="card-title">สำรองข้อมูล</h2>
            </div>
            <p className="mt-3 text-sm text-ink-2">
              ข้อมูลทั้งหมดเก็บอยู่ในเบราว์เซอร์ของเครื่องนี้เท่านั้น ถ้าล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเครื่อง
              ข้อมูลจะหาย ควรสำรองเก็บไว้เป็นระยะ
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-sunken p-3">
                <dt className="text-xs text-muted">กระเป๋า</dt>
                <dd className="num text-lg font-semibold">{data.wallets.length}</dd>
              </div>
              <div className="rounded-xl bg-sunken p-3">
                <dt className="text-xs text-muted">รายการ</dt>
                <dd className="num text-lg font-semibold">{data.transactions.length}</dd>
              </div>
            </dl>
            <div className="mt-4 space-y-2">
              <button className="btn-primary w-full" onClick={exportFile}>
                <Download size={18} aria-hidden /> ดาวน์โหลดไฟล์สำรอง
              </button>
              <button className="btn-secondary w-full" onClick={() => fileInput.current?.click()}>
                <Upload size={18} aria-hidden /> นำเข้าจากไฟล์สำรอง
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-muted">
              สำรองล่าสุด: {lastBackup ? formatTimestamp(lastBackup) : 'ยังไม่เคย'}
            </p>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) importFile(f)
              }}
            />
          </section>
        </div>
      </div>

      {editing && (
        <CategoryForm
          type={editing.type}
          category={editing.category}
          onClose={() => setEditing(null)}
          onDelete={editing.category ? () => setDeleting(editing.category!) : undefined}
        />
      )}
      {deleting && (
        <DeleteCategorySheet
          category={deleting}
          categories={data.categories}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            setEditing(null)
          }}
        />
      )}
      {importing && <ImportSheet data={data} onClose={() => setImporting(false)} />}
    </>
  )
}
