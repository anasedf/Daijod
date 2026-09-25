import { useRef, useState, type FormEvent } from 'react'
import { errorMessage, Sheet, useConfirm, useToast } from '../components/ui'
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

  return (
    <Sheet
      title={`${category ? 'แก้ไข' : 'เพิ่ม'}หมวด${type === 'income' ? 'รายรับ' : 'รายจ่าย'}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <div>
            <label className="label" htmlFor="c-icon">
              ไอคอน
            </label>
            <input
              id="c-icon"
              className="field text-center text-xl"
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
        <p className="text-xs text-slate-500">ใส่อีโมจิเป็นไอคอนได้ (บนมือถือกดปุ่มอีโมจิบนแป้นพิมพ์)</p>
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

export function SettingsPage({ data }: { data: AppData }) {
  const toast = useToast()
  const confirm = useConfirm()
  const fileInput = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState<{ type: CategoryType; category?: Category } | null>(null)

  async function removeCategory(c: Category) {
    const ok = await confirm({
      title: `ลบหมวด “${c.name}”?`,
      message: <p>ลบได้เฉพาะหมวดที่ยังไม่มีรายการใช้อยู่</p>,
      confirmLabel: 'ลบหมวด',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteCategory(c.id)
      toast('ลบหมวดแล้ว')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

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
          <b>แทนที่</b>ด้วยข้อมูลในไฟล์ “{file.name}”
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
    <div className="space-y-4">
      {(['expense', 'income'] as CategoryType[]).map((type) => (
        <section key={type} className="card">
          <h2 className="mb-2 font-semibold">หมวด{type === 'income' ? 'รายรับ' : 'รายจ่าย'}</h2>
          <ul className="divide-y divide-slate-100">
            {data.categories
              .filter((c) => c.type === type)
              .map((c) => (
                <li key={c.id} className="flex items-center gap-2 py-2">
                  <span className="text-xl" aria-hidden>
                    {c.icon}
                  </span>
                  <span className="flex-1">{c.name}</span>
                  <button
                    className="rounded-lg px-2 py-1 text-sm text-teal-700 hover:bg-teal-50"
                    onClick={() => setEditing({ type, category: c })}
                  >
                    แก้ไข
                  </button>
                  <button
                    className="rounded-lg px-2 py-1 text-sm text-red-700 hover:bg-red-50"
                    onClick={() => removeCategory(c)}
                  >
                    ลบ
                  </button>
                </li>
              ))}
          </ul>
          <button className="btn-secondary mt-2 w-full" onClick={() => setEditing({ type })}>
            + เพิ่มหมวด
          </button>
        </section>
      ))}

      <section className="card space-y-3">
        <h2 className="font-semibold">สำรองข้อมูล</h2>
        <p className="text-sm text-slate-600">
          ข้อมูลทั้งหมดเก็บอยู่ในเบราว์เซอร์ของเครื่องนี้เท่านั้น ถ้าล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเครื่อง
          ข้อมูลจะหาย ควรกดสำรองเก็บไว้เป็นระยะ
        </p>
        <button className="btn-primary w-full" onClick={exportFile}>
          ⬇️ ดาวน์โหลดไฟล์สำรอง (.json)
        </button>
        <button className="btn-secondary w-full" onClick={() => fileInput.current?.click()}>
          ⬆️ นำเข้าจากไฟล์สำรอง
        </button>
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


      {editing && (
        <CategoryForm type={editing.type} category={editing.category} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
