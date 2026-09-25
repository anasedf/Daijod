/** แปลงข้อความที่ผู้ใช้พิมพ์ (เช่น "1,250.5") เป็นสตางค์ คืน null ถ้าไม่ใช่ตัวเลขที่ถูกต้อง */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[,\s฿]/g, '')
  if (!/^-?\d+(\.\d{0,2})?$/.test(cleaned) && !/^-?\.\d{1,2}$/.test(cleaned)) return null
  const [whole, frac = ''] = cleaned.split('.')
  const sign = whole.startsWith('-') ? -1 : 1
  const baht = Math.abs(Number(whole || '0'))
  const satang = Number((frac + '00').slice(0, 2))
  const result = sign * (baht * 100 + satang)
  return Number.isSafeInteger(result) ? result : null
}

const formatter = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** แสดงสตางค์เป็นเงินบาท เช่น 125050 -> "฿1,250.50" */
export function formatBaht(satang: number, opts: { sign?: boolean } = {}): string {
  const abs = formatter.format(Math.abs(satang) / 100)
  if (satang < 0) return `-฿${abs}`
  if (opts.sign && satang > 0) return `+฿${abs}`
  return `฿${abs}`
}

/** สตางค์ -> ข้อความสำหรับใส่ในช่องกรอก เช่น 125050 -> "1250.50" */
export function amountToInput(satang: number): string {
  const s = (satang / 100).toFixed(2)
  return s.endsWith('.00') ? s.slice(0, -3) : s
}
