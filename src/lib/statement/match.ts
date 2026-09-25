// จับคู่รายการใน statement กับ "การโอน" ที่มีอยู่แล้วในแอป (เช่น เติม TrueMoney ที่นำเข้าจากฝั่งกสิกรไปแล้ว)
// เพื่อไม่ให้การโอนระหว่างบัญชีของตัวเองถูกบันทึกซ้ำสองฝั่ง
import type { Transaction } from '../types'
import type { StatementTx } from './kbank'

const MAX_DAY_GAP = 2

function dayDiff(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000
}

/**
 * หาโอนที่ตรงกับรายการนี้: อีกฝั่งของโอนเป็นกระเป๋าที่กำลังนำเข้า ยอดเท่ากัน วันที่ห่างไม่เกิน 2 วัน
 * ใช้แต่ละโอนได้ครั้งเดียว (used) เลือกอันที่วันที่ใกล้ที่สุด
 */
export function findMatchingTransfer(
  tx: StatementTx,
  walletId: string,
  transactions: Transaction[],
  used: Set<string>,
): Transaction | undefined {
  let best: Transaction | undefined
  let bestGap = Infinity
  for (const t of transactions) {
    if (t.type !== 'transfer' || t.amount !== tx.amount || used.has(t.id)) continue
    const side = tx.direction === 'in' ? t.destinationWalletId : t.sourceWalletId
    if (side !== walletId) continue
    const gap = dayDiff(t.date, tx.date)
    if (gap > MAX_DAY_GAP || gap >= bestGap) continue
    best = t
    bestGap = gap
  }
  if (best) used.add(best.id)
  return best
}
