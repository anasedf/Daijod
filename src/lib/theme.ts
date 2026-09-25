// ธีมของแอป: ตามเครื่อง / สว่าง / มืด เก็บใน prefs และใส่ data-theme ให้ <html>
// ใช้ store เล็ก ๆ เพื่อให้ปุ่มบนหัวหน้ากับหน้าตั้งค่าเห็นค่าเดียวกัน
import { useSyncExternalStore } from 'react'
import { getPref, setPref } from './prefs'

export type Theme = 'system' | 'light' | 'dark'

export const THEME_LABEL: Record<Theme, string> = { system: 'ตามเครื่อง', light: 'สว่าง', dark: 'มืด' }

const listeners = new Set<() => void>()
let current: Theme = (() => {
  const t = getPref('theme')
  return t === 'light' || t === 'dark' ? t : 'system'
})()

const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function apply() {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = current === 'system' ? (mq?.matches ? 'dark' : 'light') : current
}
mq?.addEventListener('change', apply)
apply()

export function getTheme(): Theme {
  return current
}

export function setTheme(t: Theme) {
  current = t
  setPref('theme', t)
  apply()
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const t = useSyncExternalStore(subscribe, getTheme, getTheme)
  return [t, setTheme]
}
