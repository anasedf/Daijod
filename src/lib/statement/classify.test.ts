import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from '../db'
import type { Wallet } from '../types'
import { counterparty, suggestChoice } from './classify'
import type { StatementTx } from './kbank'

function tx(over: Partial<StatementTx>): StatementTx {
  return {
    date: '2026-05-01',
    time: '10:00',
    kind: 'โอนเงิน',
    channel: 'K PLUS',
    detail: '',
    amount: 10000,
    direction: 'out',
    balance: 0,
    key: 'k',
    ...over,
  }
}
function wallet(id: string, name: string, type: Wallet['type'] = 'bank'): Wallet {
  return { id, name, type, color: '#000', openingBalance: 0, createdAt: 0, updatedAt: 0 }
}
const wallets = [wallet('bank', 'กสิกร'), wallet('cash', 'เงินสด', 'cash'), wallet('tm', 'TrueMoney', 'ewallet')]
const ctx = { walletId: 'bank', wallets, categories: DEFAULT_CATEGORIES, rules: {} }

describe('counterparty', () => {
  it('ตัดคำนำหน้า รหัส และเครื่องหมายตัดคำออก', () => {
    expect(counterparty(tx({ detail: 'โอนไป พร้อมเพย์ X6680 ร้านข้าวมันไก่+ +' })).name).toBe('ร้านข้าวมันไก่')
    expect(counterparty(tx({ detail: 'เพื่อชำระ Ref X9783 TrueMoney Wallet' })).name).toBe('TrueMoney Wallet')
    expect(counterparty(tx({ detail: 'จาก KTB X8330 MR.SOMCHAI JAI++', direction: 'in' })).name).toBe('MR.SOMCHAI JAI')
    expect(counterparty(tx({ detail: 'โอนไป X2131 บจก. ช้อปปี้เพย์ (++ Ref X9000 SHOPEEPAY(THAILAND) CO.,LTD. (ODD' })).name).toBe('บจก. ช้อปปี้เพย์')
    expect(counterparty(tx({ detail: 'เพื่อชำระ Ref X3001 ปตท.สาขาหนึ่ง ( ชื่อบัญชี: หจก. หนึ่ง)' })).name).toBe('ปตท.สาขาหนึ่ง')
  })

  it('บัตรเดบิตใช้คีย์เดียวกันแม้รหัสอ้างอิงต่างกัน', () => {
    const a = counterparty(tx({ kind: 'ชำระด้วยบัตรเดบิต', detail: 'รหัสอ้างอิง EDC14445' }))
    const b = counterparty(tx({ kind: 'ชำระด้วยบัตรเดบิต', detail: 'รหัสอ้างอิง EDC00445' }))
    expect(a.name).toBe('บัตรเดบิต EDC14445')
    expect(a.key).toBe(b.key)
  })

  it('คีย์รวมรหัสบัญชีเพื่อแยกคนชื่อซ้ำ', () => {
    const a = counterparty(tx({ detail: 'โอนไป พร้อมเพย์ X1111 นาย ก' }))
    const b = counterparty(tx({ detail: 'โอนไป พร้อมเพย์ X2222 นาย ก' }))
    expect(a.name).toBe(b.name)
    expect(a.key).not.toBe(b.key)
  })
})

describe('suggestChoice', () => {
  const suggest = (t: StatementTx, rules = {}) => suggestChoice(t, counterparty(t), { ...ctx, rules })

  it('เดาหมวดจากคำในรายละเอียด', () => {
    expect(suggest(tx({ detail: 'เพื่อชำระ Ref X1 ร้านข้าวมันไก่' }))).toEqual({ type: 'expense', categoryId: 'exp-food' })
    expect(suggest(tx({ detail: 'เพื่อชำระ Ref X1 ปตท.สาขาหนึ่ง' }))).toEqual({ type: 'expense', categoryId: 'exp-travel' })
    expect(suggest(tx({ detail: 'โอนไป X2131 บจก. ช้อปปี้เพย์ (++' }))).toEqual({ type: 'expense', categoryId: 'exp-shopping' })
  })

  it('ไม่รู้ก็ปล่อยว่างให้ผู้ใช้เลือก', () => {
    expect(suggest(tx({ detail: 'โอนไป พร้อมเพย์ X1111 นาย ก' }))).toEqual({ type: 'expense', categoryId: '' })
  })

  it('เงินเข้าเป็นรายรับ ดอกเบี้ยก็เช่นกัน', () => {
    expect(suggest(tx({ direction: 'in', kind: 'รับโอนเงิน', detail: 'จาก X1 นาย ข' }))).toEqual({ type: 'income', categoryId: 'inc-other' })
    expect(suggest(tx({ direction: 'in', kind: 'รับดอกเบี้ยเงินฝาก' }))).toEqual({ type: 'income', categoryId: 'inc-other' })
  })

  it('ชื่อตรงกับกระเป๋าอื่น -> โอน', () => {
    expect(suggest(tx({ detail: 'เพื่อชำระ Ref X9783 TrueMoney Wallet' }))).toEqual({ type: 'transfer', walletId: 'tm' })
    expect(suggest(tx({ kind: 'หักบัญชี', detail: 'โอนไป X3589 บจก. ทรู มันนี่ เพ++ Ref X9203 TRUE MONEY CO., LTD (ODD)' }))).toEqual({ type: 'transfer', walletId: 'tm' })
    expect(suggest(tx({ direction: 'in', kind: 'ฝากเงินสด', detail: '' }))).toEqual({ type: 'transfer', walletId: 'cash' })
    expect(suggest(tx({ direction: 'in', kind: 'รับโอนเงิน', channel: 'CDM', detail: 'รหัสอ้างอิง CDM01006' }))).toEqual({ type: 'transfer', walletId: 'cash' })
  })

  it('ตัดชื่อบัญชีเต็มที่ขึ้นบรรทัดใหม่', () => {
    expect(counterparty(tx({ detail: 'เพื่อชำระ Ref X1 ร้านเนื้อ สาขาหนึ่ง (ชื่อ บัญชี: บจก. ร้านเนื้อ)' })).name).toBe('ร้านเนื้อ สาขาหนึ่ง')
  })

  it('ใช้สิ่งที่ผู้ใช้เคยเลือกก่อน', () => {
    const t = tx({ detail: 'โอนไป พร้อมเพย์ X1111 นาย ก' })
    const key = counterparty(t).key
    expect(suggest(t, { [key]: { type: 'expense', categoryId: 'exp-home' } })).toEqual({ type: 'expense', categoryId: 'exp-home' })
    // หมวดที่ถูกลบไปแล้วจะไม่ถูกใช้
    expect(suggest(t, { [key]: { type: 'expense', categoryId: 'gone' } })).toEqual({ type: 'expense', categoryId: '' })
    // กฎที่เป็นรายจ่ายไม่ใช้กับเงินเข้า
    expect(suggest({ ...t, direction: 'in' }, { [key]: { type: 'expense', categoryId: 'exp-home' } })).toEqual({ type: 'income', categoryId: 'inc-other' })
  })
})
