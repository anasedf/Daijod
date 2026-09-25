// ดึงข้อความพร้อมพิกัดจาก PDF ด้วย pdf.js (ทำงานในเบราว์เซอร์ทั้งหมด ไม่ส่งไฟล์ไปไหน)
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { UserError } from '../db'
import type { TextItem } from './kbank'

GlobalWorkerOptions.workerSrc = workerUrl

export class PasswordRequired extends UserError {}

export async function extractTextItems(data: ArrayBuffer, password?: string): Promise<TextItem[][]> {
  const task = getDocument({ data, password })
  let doc
  try {
    doc = await task.promise
  } catch (e) {
    const name = (e as { name?: string })?.name
    if (name === 'PasswordException') {
      throw new PasswordRequired(password ? 'รหัสผ่านไม่ถูกต้อง' : 'ไฟล์นี้ติดรหัสผ่าน กรุณาใส่รหัสผ่านของ statement')
    }
    if (name === 'InvalidPDFException') throw new UserError('ไฟล์นี้ไม่ใช่ PDF หรือไฟล์เสียหาย')
    throw e
  }
  try {
    const pages: TextItem[][] = []
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      pages.push(
        content.items.flatMap((i) =>
          'str' in i ? [{ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width }] : [],
        ),
      )
    }
    return pages
  } finally {
    await task.destroy()
  }
}
