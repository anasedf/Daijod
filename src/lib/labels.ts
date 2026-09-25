import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Landmark,
  Smartphone,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { TransactionType, WalletType } from './types'

// สีช่วยแยกประเภท แต่ทุกที่ต้องมีข้อความ/ไอคอนประกอบเสมอ (ไม่ใช้สีอย่างเดียว)
export const TX_META: Record<
  TransactionType,
  { label: string; Icon: LucideIcon; sign: string; text: string; soft: string; solid: string }
> = {
  expense: { label: 'รายจ่าย', Icon: ArrowUpRight, sign: '−', text: 'text-expense', soft: 'bg-expense-soft', solid: 'bg-expense' },
  income: { label: 'รายรับ', Icon: ArrowDownLeft, sign: '+', text: 'text-income', soft: 'bg-income-soft', solid: 'bg-income' },
  transfer: { label: 'โอน', Icon: ArrowLeftRight, sign: '', text: 'text-transfer', soft: 'bg-transfer-soft', solid: 'bg-transfer' },
}

export const WALLET_TYPES: Record<WalletType, { label: string; Icon: LucideIcon }> = {
  cash: { label: 'เงินสด', Icon: Banknote },
  bank: { label: 'บัญชีธนาคาร', Icon: Landmark },
  ewallet: { label: 'e-Wallet', Icon: Smartphone },
  other: { label: 'อื่น ๆ', Icon: Wallet },
}

export const WALLET_COLORS = ['#0f766e', '#15803d', '#1d4ed8', '#7e22ce', '#be185d', '#c2410c', '#a16207', '#475569']
