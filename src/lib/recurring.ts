// รายการประจำ: หาว่าเดือนนี้อันไหนถึงกำหนดแล้วยังไม่ได้บันทึก
import type { Recurring } from './types'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** วันครบกำหนดในเดือนนั้น (ถ้าเดือนสั้นกว่า day ใช้วันสุดท้าย) */
export function dueDateFor(rec: Pick<Recurring, 'day'>, month: string): string {
  return `${month}-${pad(Math.min(rec.day, daysInMonth(month)))}`
}

export interface DueItem {
  rec: Recurring
  date: string
}

/** ถึงกำหนดแล้ว (วันนี้หรือก่อนหน้าในเดือนนี้) และเดือนนี้ยังไม่ได้บันทึก/ข้าม */
export function dueRecurrings(list: Recurring[], today: string): DueItem[] {
  const month = today.slice(0, 7)
  return list
    .filter((r) => r.active && r.lastMonth !== month)
    .map((rec) => ({ rec, date: dueDateFor(rec, month) }))
    .filter((d) => d.date <= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.rec.name.localeCompare(b.rec.name, 'th')))
}

/** ที่จะถึงกำหนดถัดไป (เดือนนี้ถ้ายังไม่ถึง ไม่งั้นเดือนหน้า) เรียงตามวัน */
export function upcomingRecurrings(list: Recurring[], today: string): DueItem[] {
  const month = today.slice(0, 7)
  const [y, m] = month.split('-').map(Number)
  const next = `${m === 12 ? y + 1 : y}-${pad(m === 12 ? 1 : m + 1)}`
  return list
    .filter((r) => r.active)
    .map((rec) => {
      const thisMonth = dueDateFor(rec, month)
      return { rec, date: thisMonth > today && rec.lastMonth !== month ? thisMonth : dueDateFor(rec, next) }
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}
