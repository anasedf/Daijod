import type { TransactionType, WalletType } from './types'

// สีช่วยแยกประเภท แต่ทุกที่ต้องมีข้อความ/ไอคอนประกอบเสมอ (ไม่ใช้สีอย่างเดียว)
export const TX_META: Record<
  TransactionType,
  { label: string; icon: string; sign: string; text: string; bg: string; activeBg: string }
> = {
  expense: { label: 'รายจ่าย', icon: '↑', sign: '−', text: 'text-red-700', bg: 'bg-red-50', activeBg: 'bg-red-700' },
  income: { label: 'รายรับ', icon: '↓', sign: '+', text: 'text-emerald-700', bg: 'bg-emerald-50', activeBg: 'bg-emerald-700' },
  transfer: { label: 'โอน', icon: '⇄', sign: '', text: 'text-sky-700', bg: 'bg-sky-50', activeBg: 'bg-sky-700' },
}

export const WALLET_TYPES: Record<WalletType, { label: string; icon: string }> = {
  cash: { label: 'เงินสด', icon: '💵' },
  bank: { label: 'บัญชีธนาคาร', icon: '🏦' },
  ewallet: { label: 'e-Wallet', icon: '📱' },
  other: { label: 'อื่น ๆ', icon: '👛' },
}

export const WALLET_COLORS = ['#0f766e', '#15803d', '#1d4ed8', '#7e22ce', '#be185d', '#c2410c', '#a16207', '#475569']
