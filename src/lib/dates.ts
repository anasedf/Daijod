function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** วันที่ท้องถิ่นเป็น YYYY-MM-DD */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export interface DateRange {
  from: string // รวมวันนี้ด้วย
  to: string // รวมวันนี้ด้วย
}

export function monthRange(d = new Date()): DateRange {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { from: toISODate(first), to: toISODate(last) }
}

export function inRange(date: string, range?: Partial<DateRange>): boolean {
  if (!range) return true
  if (range.from && date < range.from) return false
  if (range.to && date > range.to) return false
  return true
}

const longFmt = new Intl.DateTimeFormat('th-TH', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const shortFmt = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
const timeFmt = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** เช่น "ศ. 25 ก.ย. 2569" */
export function formatDateLong(iso: string): string {
  return longFmt.format(parseISO(iso))
}

export function formatDateShort(iso: string): string {
  return shortFmt.format(parseISO(iso))
}

export function formatTimestamp(ms: number): string {
  return timeFmt.format(new Date(ms))
}

/** หัวข้อกลุ่มรายการ: "วันนี้", "เมื่อวาน" หรือวันที่เต็ม */
export function dayHeading(iso: string, today = todayISO()): string {
  if (iso === today) return 'วันนี้'
  const y = parseISO(today)
  y.setDate(y.getDate() - 1)
  if (iso === toISODate(y)) return 'เมื่อวาน'
  return formatDateLong(iso)
}
