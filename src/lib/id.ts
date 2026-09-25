/** สร้าง id แบบสุ่ม (crypto.randomUUID ใช้ไม่ได้เมื่อเปิดผ่าน http ที่ไม่ใช่ localhost) */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
