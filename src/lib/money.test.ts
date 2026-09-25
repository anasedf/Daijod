import { describe, expect, it } from 'vitest'
import { amountToInput, formatBaht, parseAmount } from './money'

describe('parseAmount', () => {
  it('แปลงตัวเลขเป็นสตางค์', () => {
    expect(parseAmount('100')).toBe(10000)
    expect(parseAmount('1,250.5')).toBe(125050)
    expect(parseAmount('0.1')).toBe(10)
    expect(parseAmount('.25')).toBe(25)
    expect(parseAmount('฿ 20.99')).toBe(2099)
  })
  it('ปฏิเสธข้อความที่ไม่ใช่ตัวเลข', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('1.234')).toBeNull()
    expect(parseAmount('1e5')).toBeNull()
  })
})

describe('formatBaht', () => {
  it('แสดงเป็นเงินบาท', () => {
    expect(formatBaht(125050)).toBe('฿1,250.50')
    expect(formatBaht(-500)).toBe('-฿5.00')
    expect(formatBaht(500, { sign: true })).toBe('+฿5.00')
  })
  it('แปลงกลับเป็นค่าในช่องกรอก', () => {
    expect(amountToInput(125050)).toBe('1250.50')
    expect(amountToInput(10000)).toBe('100')
  })
})
