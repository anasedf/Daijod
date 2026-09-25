import { ChartPie, House, MonitorSmartphone, Moon, Plus, ReceiptText, Settings, Sun, Wallet, type LucideIcon } from 'lucide-react'
import { Component, useCallback, useEffect, useState, type ReactNode } from 'react'
import { TransactionForm } from './components/TransactionForm'
import { UIProvider } from './components/ui'
import { WalletForm } from './components/WalletForm'
import { useData } from './hooks/useData'
import { formatBaht } from './lib/money'
import { THEME_LABEL, useTheme, type Theme } from './lib/theme'
import type { Transaction } from './lib/types'
import { DashboardPage } from './pages/Dashboard'
import { HistoryPage } from './pages/History'
import { SettingsPage } from './pages/Settings'
import { StatsPage } from './pages/Stats'
import { WalletsPage } from './pages/Wallets'

export type Tab = 'home' | 'history' | 'stats' | 'wallets' | 'settings'

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'home', label: 'ภาพรวม', Icon: House },
  { id: 'history', label: 'รายการ', Icon: ReceiptText },
  { id: 'stats', label: 'สถิติ', Icon: ChartPie },
  { id: 'wallets', label: 'กระเป๋า', Icon: Wallet },
  { id: 'settings', label: 'ตั้งค่า', Icon: Settings },
]
// มือถือมีที่ 4 แท็บ + ปุ่มจด: กระเป๋าเข้าได้จากการ์ดยอดรวมและหน้าตั้งค่า
const MOBILE_TABS = TABS.filter((t) => t.id !== 'wallets')

type Editor = { kind: 'tx'; tx?: Transaction } | { kind: 'wallet' } | null

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-lg font-bold text-on-brand" aria-hidden>
        จ
      </span>
      <span className="text-lg font-bold tracking-tight">ได้จด</span>
    </div>
  )
}

function Shell() {
  const data = useData()
  const [theme, setTheme] = useTheme()
  const nextTheme: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : MonitorSmartphone
  const themeToggle = (
    <button
      type="button"
      className="icon-btn bg-surface lg:bg-transparent"
      onClick={() => setTheme(nextTheme[theme])}
      aria-label={`ธีม${THEME_LABEL[theme]} (กดเพื่อเปลี่ยน)`}
      title={`ธีม${THEME_LABEL[theme]}`}
    >
      <ThemeIcon size={19} />
    </button>
  )
  const [tab, setTab] = useState<Tab>('home')
  const [editor, setEditor] = useState<Editor>(null)
  const close = useCallback(() => setEditor(null), [])
  const openTx = useCallback((tx: Transaction) => setEditor({ kind: 'tx', tx }), [])

  useEffect(() => {
    // ขอให้เบราว์เซอร์ไม่ลบข้อมูลเองเมื่อพื้นที่เหลือน้อย
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  const addNew = useCallback(() => {
    if (!data) return
    setEditor(data.wallets.length === 0 ? { kind: 'wallet' } : { kind: 'tx' })
  }, [data])

  // คีย์ลัดบนคอม: กด N เพื่อจดรายการใหม่
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editor || e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'n') return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      addNew()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editor, addNew])

  const addLabel = data?.wallets.length === 0 ? 'เพิ่มกระเป๋า' : 'จดรายการ'

  return (
    <div className="min-h-dvh lg:flex">
      {/* ---------- จอใหญ่: แถบด้านข้าง ---------- */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface px-5 py-7 lg:flex">
        <div className="flex items-center justify-between px-2">
          <Logo />
          {themeToggle}
        </div>
        <button type="button" onClick={addNew} disabled={!data} className="btn-primary mt-6 w-full justify-between">
          <span className="flex items-center gap-2">
            <Plus size={18} strokeWidth={2.5} aria-hidden />
            {addLabel}
          </span>
          <kbd className="rounded-md bg-white/15 px-1.5 text-xs font-medium" aria-label="คีย์ลัด N">
            N
          </kbd>
        </button>
        <nav className="mt-6" aria-label="เมนูหลัก">
          <ul className="space-y-1">
            {TABS.map(({ id, label, Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={tab === id ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-full px-4 py-3 text-[0.95rem] font-medium transition-colors ${
                    tab === id ? 'bg-brand text-on-brand' : 'text-ink-2 hover:bg-sunken hover:text-ink'
                  }`}
                >
                  <Icon size={20} strokeWidth={tab === id ? 2.4 : 2} aria-hidden />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        {data && data.wallets.length > 0 && (
          <div className="hero-card mt-auto rounded-3xl p-5">
            <div className="text-xs font-medium opacity-80">ยอดรวมทุกกระเป๋า</div>
            <div className="num mt-1 text-xl font-semibold">{formatBaht(data.total)}</div>
            <div className="mt-1 text-xs opacity-70">{data.wallets.length} กระเป๋า</div>
          </div>
        )}
      </aside>

      {/* ---------- เนื้อหา ---------- */}
      <main className="mx-auto w-full max-w-6xl min-w-0 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">
        <div className="mb-5 flex items-center justify-between lg:hidden">
          <Logo />
          {themeToggle}
        </div>
        {!data ? (
          <p className="py-20 text-center text-muted" role="status">
            กำลังโหลด…
          </p>
        ) : tab === 'home' ? (
          <DashboardPage
            data={data}
            onOpen={openTx}
            onAddWallet={() => setEditor({ kind: 'wallet' })}
            onNavigate={setTab}
          />
        ) : tab === 'history' ? (
          <HistoryPage data={data} onOpen={openTx} />
        ) : tab === 'stats' ? (
          <StatsPage data={data} onNavigate={setTab} />
        ) : tab === 'wallets' ? (
          <WalletsPage data={data} />
        ) : (
          <SettingsPage data={data} />
        )}
      </main>

      {/* ---------- มือถือ: แถบเมนูล่าง ---------- */}
      {/* แถบติดขอบล่างเต็มความกว้าง ไม่ลอย ปุ่ม + อยู่ในแถวเดียวกัน */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="เมนูหลัก"
      >
        <ul className="mx-auto grid h-[4.25rem] max-w-xl grid-cols-5 items-center">
          {[...MOBILE_TABS.slice(0, 2), null, ...MOBILE_TABS.slice(2)].map((t) =>
            t === null ? (
              <li key="add" className="flex justify-center">
                <button
                  type="button"
                  onClick={addNew}
                  disabled={!data}
                  aria-label={addLabel}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-on-brand transition-transform active:scale-95"
                >
                  <Plus size={26} strokeWidth={2.4} aria-hidden />
                </button>
              </li>
            ) : (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? 'page' : undefined}
                  className={`flex h-[4.25rem] w-full flex-col items-center justify-center gap-1 text-[0.68rem] font-medium ${
                    tab === t.id ? 'text-ink' : 'text-muted'
                  }`}
                >
                  <span
                    className={`flex h-7 w-11 items-center justify-center rounded-full transition-colors ${
                      tab === t.id ? 'bg-accent-soft text-accent-strong' : ''
                    }`}
                    aria-hidden
                  >
                    <t.Icon size={21} strokeWidth={tab === t.id ? 2.2 : 1.9} />
                  </span>
                  {t.label}
                </button>
              </li>
            ),
          )}
        </ul>
      </nav>

      {data && editor?.kind === 'tx' && <TransactionForm data={data} transaction={editor.tx} onClose={close} />}
      {editor?.kind === 'wallet' && <WalletForm onClose={close} />}
    </div>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <h1 className="text-lg font-semibold">เปิดฐานข้อมูลไม่ได้</h1>
        <p className="mt-2 text-ink-2">
          เบราว์เซอร์อาจปิดการเก็บข้อมูลไว้ (เช่น โหมดไม่ระบุตัวตน) ลองเปิดในหน้าต่างปกติ แล้วโหลดหน้าใหม่
        </p>
        <button className="btn-primary mt-4" onClick={() => location.reload()}>
          โหลดใหม่
        </button>
      </div>
    )
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <UIProvider>
        <Shell />
      </UIProvider>
    </ErrorBoundary>
  )
}
