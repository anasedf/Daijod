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

// ---------- Sheet (หน้าต่างเลื่อนขึ้นจากด้านล่างบนมือถือ) ----------

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
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
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl outline-none sm:rounded-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-full px-3 py-1 text-2xl leading-none text-slate-500 hover:bg-slate-100"
            aria-label="ปิด"
          >
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
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
          <Sheet title={confirm.title} onClose={cancelConfirm}>
            <div className="text-slate-700">{confirm.message}</div>
            <div className="mt-6 flex gap-3">
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
          </Sheet>
        )}
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),0.75rem)] z-50 flex justify-center px-4"
        >
          {toast && (
            <div
              key={toast.id}
              role={toast.kind === 'error' ? 'alert' : 'status'}
              className={`max-w-sm whitespace-pre-line rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
                toast.kind === 'error' ? 'bg-red-700' : 'bg-slate-800'
              }`}
            >
              {toast.kind === 'error' ? '⚠️ ' : '✓ '}
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
