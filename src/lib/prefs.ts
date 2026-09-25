// ค่าที่จำไว้เพื่อความสะดวก (ถ้าเบราว์เซอร์ไม่ให้ใช้ localStorage ก็ทำงานต่อได้)
export function getPref(key: string): string | null {
  try {
    return localStorage.getItem(`daijod:${key}`)
  } catch {
    return null
  }
}

export function setPref(key: string, value: string) {
  try {
    localStorage.setItem(`daijod:${key}`, value)
  } catch {
    // ไม่เป็นไร
  }
}
