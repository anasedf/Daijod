// สำรองข้อมูลเป็นไฟล์ และจำว่าสำรองล่าสุดเมื่อไหร่ เพื่อเตือนเมื่อนานเกินไป
import { todayISO } from './dates'
import { exportBackup } from './db'
import { getPref, setPref } from './prefs'
import type { Transaction } from './types'

const REMIND_AFTER_DAYS = 14
const SNOOZE_DAYS = 7
const MIN_TRANSACTIONS = 10

export function lastBackupAt(): number | null {
  const v = Number(getPref('lastBackupAt'))
  return v > 0 ? v : null
}

/** ดาวน์โหลดไฟล์สำรอง แล้วจดเวลาไว้ */
export async function downloadBackup() {
  const backup = await exportBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `daijod-backup-${todayISO()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  setPref('lastBackupAt', String(Date.now()))
}

export function snoozeBackupReminder(now = Date.now()) {
  setPref('backupSnoozedUntil', String(now + SNOOZE_DAYS * 86_400_000))
}

export type BackupReminder = { reason: 'never' | 'stale'; days: number } | null

/**
 * ควรเตือนให้สำรองไหม: มีรายการพอสมควร และไม่เคยสำรอง หรือสำรองครั้งล่าสุดนานเกินไปแล้วมีการแก้ไขหลังจากนั้น
 */
export function backupReminder(
  transactions: Transaction[],
  opts: { now?: number; lastBackup?: number | null; snoozedUntil?: number | null } = {},
): BackupReminder {
  const now = opts.now ?? Date.now()
  const last = opts.lastBackup === undefined ? lastBackupAt() : opts.lastBackup
  const snoozed = opts.snoozedUntil === undefined ? Number(getPref('backupSnoozedUntil')) || null : opts.snoozedUntil
  if (transactions.length < MIN_TRANSACTIONS) return null
  if (snoozed && now < snoozed) return null
  if (!last) return { reason: 'never', days: 0 }
  const days = Math.floor((now - last) / 86_400_000)
  if (days < REMIND_AFTER_DAYS) return null
  const changedSince = transactions.some((t) => t.updatedAt > last)
  return changedSince ? { reason: 'stale', days } : null
}
