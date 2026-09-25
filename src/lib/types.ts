// จำนวนเงินทั้งหมดเก็บเป็น "สตางค์" (จำนวนเต็ม) เพื่อเลี่ยงปัญหาทศนิยมของ JavaScript
// เช่น 125.50 บาท = 12550

export type WalletType = 'cash' | 'bank' | 'ewallet' | 'other'

export interface Wallet {
  id: string
  name: string
  type: WalletType
  openingBalance: number // สตางค์
  color: string
  createdAt: number
  updatedAt: number
}

export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Transaction {
  id: string
  type: TransactionType
  amount: number // สตางค์ ต้องมากกว่า 0
  date: string // YYYY-MM-DD (วันที่ตามเวลาท้องถิ่น)
  categoryId?: string // ไม่ใช้กับการโอน
  note: string
  sourceWalletId?: string // รายจ่าย และ โอน
  destinationWalletId?: string // รายรับ และ โอน
  importKey?: string // รหัสรายการจาก statement ที่นำเข้า ใช้กันนำเข้าซ้ำ
  createdAt: number
  updatedAt: number
}

export type CategoryType = 'income' | 'expense'

export interface Category {
  id: string
  name: string
  type: CategoryType
  icon: string // อีโมจิ (ใช้เมื่อไม่มี iconName)
  iconName?: string // ชื่อไอคอนจากชุดใน lib/icons.ts
  color?: string
  budget?: number // งบต่อเดือน (สตางค์) ใช้กับหมวดรายจ่าย
}

/** รายการประจำ: ถึงวันที่กำหนดของทุกเดือน แอปจะถามให้บันทึกเป็นรายการจริง */
export interface Recurring {
  id: string
  name: string
  type: TransactionType
  amount: number // สตางค์
  day: number // วันที่ของเดือน 1–31 (เดือนที่สั้นกว่าใช้วันสุดท้าย)
  note: string
  categoryId?: string
  sourceWalletId?: string
  destinationWalletId?: string
  active: boolean
  lastMonth?: string // YYYY-MM ที่บันทึกหรือข้ามไปแล้วล่าสุด
  createdAt: number
  updatedAt: number
}
export type RecurringInput = Omit<Recurring, 'id' | 'createdAt' | 'updatedAt' | 'lastMonth'>

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
export type WalletInput = Omit<Wallet, 'id' | 'createdAt' | 'updatedAt'>
