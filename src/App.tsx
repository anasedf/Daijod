import { Component, useCallback, useEffect, useState, type ReactNode } from 'react'
import { TransactionForm } from './components/TransactionForm'
import { UIProvider } from './components/ui'
import { WalletForm } from './components/WalletForm'
import { useData } from './hooks/useData'
import type { Transaction } from './lib/types'
import { DashboardPage } from './pages/Dashboard'
import { HistoryPage } from './pages/History'
import { SettingsPage } from './pages/Settings'
import { WalletsPage } from './pages/Wallets'

type Tab = 'home' | 'history' | 'wallets' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'ภาพรวม', icon: '🏠' },
  { id: 'history', label: 'รายการ', icon: '📋' },
  { id: 'wallets', label: 'กระเป๋า', icon: '👛' },
  { id: 'settings', label: 'ตั้งค่า', icon: '⚙️' },
]

type Editor = { kind: 'tx'; tx?: Transaction } | { kind: 'wallet' } | null

function Shell() {
  const data = useData()
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

  function addNew() {
    if (!data) return
    setEditor(data.wallets.length === 0 ? { kind: 'wallet' } : { kind: 'tx' })
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-28">
      <header className="sticky top-0 z-20 bg-slate-100/90 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur">
        <h1 className="text-xl font-bold text-teal-800">
          ได้จด <span className="text-base font-normal text-slate-500">· {TABS.find((t) => t.id === tab)!.label}</span>
        </h1>
      </header>

      <main className="px-4">
        {!data ? (
          <p className="py-12 text-center text-slate-500" role="status">
            กำลังโหลด…
          </p>
        ) : tab === 'home' ? (
          <DashboardPage
            data={data}
            onOpen={openTx}
            onAddWallet={() => setEditor({ kind: 'wallet' })}
            onSeeAll={() => setTab('history')}
          />
        ) : tab === 'history' ? (
          <HistoryPage data={data} onOpen={openTx} />
        ) : tab === 'wallets' ? (
          <WalletsPage data={data} />
        ) : (
          <SettingsPage data={data} />
        )}
      </main>

      {data && (
        <button
          type="button"
          onClick={addNew}
          aria-label={data.wallets.length === 0 ? 'เพิ่มกระเป๋า' : 'เพิ่มรายการ'}
          className="fixed right-[max(1rem,calc(50%-15rem))] bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex h-16 w-16 items-center justify-center rounded-full bg-teal-700 text-4xl text-white shadow-lg hover:bg-teal-800 active:scale-95"
        >
          +
        </button>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
        aria-label="เมนูหลัก"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {TABS.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`flex h-16 w-full flex-col items-center justify-center text-xs ${
                  tab === t.id ? 'font-semibold text-teal-700' : 'text-slate-500'
                }`}
              >
                <span className="text-xl" aria-hidden>
                  {t.icon}
                </span>
                {t.label}
              </button>
            </li>
          ))}
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
        <p className="mt-2 text-slate-600">
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
