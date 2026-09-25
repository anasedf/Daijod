import { Download, FileUp, HardDrive, Plus, Upload } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { ImportSheet } from '../components/ImportSheet'
import { errorMessage, FormError, PageHeader, Sheet, useConfirm, useToast } from '../components/ui'
import type { AppData } from '../hooks/useData'
import { addCategory, deleteCategory, exportBackup, importBackup, updateCategory } from '../lib/db'
import { todayISO } from '../lib/dates'
import type { Category, CategoryType } from '../lib/types'

function CategoryForm({
  category,
  type,
  onClose,
}: {
  category?: Category
  type: CategoryType
  onClose: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? (type === 'income' ? '💰' : '📦'))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const i = icon.trim() || '📦'
      if (category) await updateCategory(category.id, { name, icon: i })
      else await addCategory({ name, icon: i, type })
      toast(category ? 'แก้ไขหมวดแล้ว' : 'เพิ่มหมวดแล้ว')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  async function remove() {
    if (!category) return
    const ok = await confirm({
      title: `ลบหมวด “${category.name}”?`,
      message: <p>ลบได้เฉพาะหมวดที่ยังไม่มีรายการใช้อยู่</p>,
      confirmLabel: 'ลบหมวด',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteCategory(category.id)
      toast('ลบหมวดแล้ว')
      onClose()
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  return (
    <Sheet
      title={`${category ? 'แก้ไข' : 'เพิ่ม'}หมวด${type === 'income' ? 'รายรับ' : 'รายจ่าย'}`}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          {category && (
            <button type="button" className="btn-secondary text-expense" onClick={remove}>
              ลบ
            </button>
          )}
          <button type="submit" form="category-form" className="btn-primary flex-1" disabled={saving}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      }
    >
      <form id="category-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <div>
            <label className="label" htmlFor="c-icon">
              ไอคอน
            </label>
            <input
              id="c-icon"
              className="field text-center text-2xl"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
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
              autoFocus
            />
          </div>
        </div>
        <p className="text-xs text-muted">ใส่อีโมจิเป็นไอคอนได้ (บนมือถือกดปุ่มอีโมจิบนแป้นพิมพ์ บน Windows กด Win + .)</p>
        {error && <FormError>{error}</FormError>}
      </form>
    </Sheet>
  )
}

export function SettingsPage({ data }: { data: AppData }) {
  const toast = useToast()
  const confirm = useConfirm()
  const fileInput = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState<{ type: CategoryType; category?: Category } | null>(null)
  const [importing, setImporting] = useState(false)

  async function exportFile() {
    try {
      const backup = await exportBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `daijod-backup-${todayISO()}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
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
      <PageHeader title="ตั้งค่า" subtitle="หมวดหมู่และการสำรองข้อมูล" />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-5">
        <div className="space-y-4 lg:space-y-5">
          {(['expense', 'income'] as CategoryType[]).map((type) => {
            const cats = data.categories.filter((c) => c.type === type)
            return (
              <section key={type} className="card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="card-title">หมวด{type === 'income' ? 'รายรับ' : 'รายจ่าย'}</h2>
                    <p className="text-xs text-muted">{cats.length} หมวด · แตะเพื่อแก้ไข</p>
                  </div>
                  <button className="btn-ghost -mr-2 min-h-9 px-3 text-sm text-brand" onClick={() => setEditing({ type })}>
                    <Plus size={16} aria-hidden /> เพิ่มหมวด
                  </button>
                </div>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {cats.map((c) => (
                    <li key={c.id}>
                      <button
                        className="flex w-full items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 text-left text-sm transition-colors hover:border-brand/40 hover:bg-sunken"
                        onClick={() => setEditing({ type, category: c })}
                        aria-label={`แก้ไขหมวด ${c.name}`}
                      >
                        <span className="text-xl" aria-hidden>
                          {c.icon}
                        </span>
                        <span className="truncate">{c.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
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
            อ่านรายการจากไฟล์ statement ของธนาคาร (ตอนนี้รองรับกสิกรไทย) แล้วตรวจก่อนบันทึก ไฟล์ถูกอ่านในเครื่องนี้เท่านั้น
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

      {editing && <CategoryForm type={editing.type} category={editing.category} onClose={() => setEditing(null)} />}
      {importing && <ImportSheet data={data} onClose={() => setImporting(false)} />}
    </>
  )
}
