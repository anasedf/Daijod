import { CircleAlert, CircleCheck, X, type LucideIcon } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { UserError } from '../lib/db'
import { WALLET_TYPES } from '../lib/labels'
import type { Wallet } from '../lib/types'

// ---------- Sheet (มือถือ: เลื่อนขึ้นจากด้านล่าง / จอใหญ่: หน้าต่างกลางจอ) ----------

export function Sheet({
  title,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** ความกว้างบนจอใหญ่ (มือถือเต็มจอเสมอ) */
  size?: 'md' | 'lg' | 'xl'
}) {
  const panel = useRef<HTMLDivElement>(null)
  // เก็บ onClose ใน ref เพื่อให้ effect ทำงานครั้งเดียวตอนเปิด (ไม่แย่งโฟกัสระหว่างพิมพ์)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <div className="anim-fade absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`anim-sheet sm:anim-pop relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl outline-none sm:max-h-[88dvh] sm:rounded-2xl ${
          size === 'xl' ? 'sm:max-w-4xl' : size === 'lg' ? 'sm:max-w-xl' : 'sm:max-w-md'
        }`}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-3 pb-2 sm:pt-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="icon-btn -mr-2" aria-label="ปิด">
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-5">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] sm:pb-4">
            {footer}
          </div>
        )}
        {!footer && <div className="h-[env(safe-area-inset-bottom)] shrink-0" />}
      </div>
    </div>
  )
}

// ---------- ชิ้นส่วนเล็ก ๆ ที่ใช้ซ้ำ ----------

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 lg:mb-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
    </header>
  )
}

export function WalletIcon({ wallet, size = 'md' }: { wallet: Wallet; size?: 'sm' | 'md' | 'lg' }) {
  const { Icon } = WALLET_TYPES[wallet.type]
  const box = size === 'sm' ? 'h-7 w-7 rounded-lg' : size === 'lg' ? 'h-11 w-11 rounded-xl' : 'h-9 w-9 rounded-xl'
  return (
    <span
      className={`flex shrink-0 items-center justify-center text-white ${box}`}
      style={{ backgroundColor: wallet.color }}
      aria-hidden
    >
      <Icon size={size === 'sm' ? 15 : size === 'lg' ? 22 : 18} strokeWidth={2} />
    </span>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand" aria-hidden>
        <Icon size={26} />
      </span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-2">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex gap-2 rounded-xl bg-expense-soft p-3 text-sm whitespace-pre-line text-expense">
      <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

// ---------- Toast (ข้อความแจ้งผลสั้น ๆ) ----------

type ToastKind = 'success' | 'error'
interface ToastState {
  id: number
  message: string
  kind: ToastKind
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

// ---------- Confirm (ยืนยันก่อนลบ) ----------

interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmLabel: string
  danger?: boolean
}
const ConfirmContext = createContext<(opts: ConfirmOptions) => Promise<boolean>>(async () => false)

export function useConfirm() {
  return useContext(ConfirmContext)
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const [confirm, setConfirm] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    setToast({ id: Date.now(), message, kind })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.kind === 'error' ? 5000 : 2500)
    return () => clearTimeout(t)
  }, [toast])

  const ask = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirm({ ...opts, resolve })),
    [],
  )
  const closeConfirm = useCallback(
    (value: boolean) => {
      confirm?.resolve(value)
      setConfirm(null)
    },
    [confirm],
  )
  const cancelConfirm = useCallback(() => closeConfirm(false), [closeConfirm])

  return (
    <ToastContext.Provider value={showToast}>
      <ConfirmContext.Provider value={ask}>
        {children}
        {confirm && (
          <Sheet
            title={confirm.title}
            onClose={cancelConfirm}
            footer={
              <div className="flex gap-3">
                <button type="button" className="btn-secondary flex-1" onClick={cancelConfirm}>
                  ยกเลิก
                </button>
                <button
                  type="button"
                  className={`flex-1 ${confirm.danger ? 'btn-danger' : 'btn-primary'}`}
                  onClick={() => closeConfirm(true)}
                >
                  {confirm.confirmLabel}
                </button>
              </div>
            }
          >
            <div className="text-ink-2">{confirm.message}</div>
          </Sheet>
        )}
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),0.75rem)] z-[60] flex justify-center px-4 lg:top-auto lg:right-6 lg:bottom-6 lg:left-auto lg:justify-end"
        >
          {toast && (
            <div
              key={toast.id}
              role={toast.kind === 'error' ? 'alert' : 'status'}
              className="anim-sheet flex max-w-sm items-start gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-medium whitespace-pre-line text-canvas shadow-xl"
            >
              {toast.kind === 'error' ? (
                <CircleAlert size={18} className="mt-0.5 shrink-0 text-expense" aria-hidden />
              ) : (
                <CircleCheck size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
              )}
              {toast.message}
            </div>
          )}
        </div>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  )
}

/** ข้อความผิดพลาดที่อ่านเข้าใจได้ */
export function errorMessage(e: unknown): string {
  if (e instanceof UserError) return e.message
  return 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง'
}
