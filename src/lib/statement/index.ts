// เลือกตัวอ่านให้ตรงกับธนาคารของไฟล์
import { UserError } from '../db'
import { isKBankStatement, parseKBank, type Statement, type TextItem } from './kbank'
import { isTrueMoneyStatement, parseTrueMoney } from './truemoney'

export const SUPPORTED_BANKS = 'ธนาคารกสิกรไทย (PDF จาก K PLUS) และ TrueMoney Wallet'

export function parseStatement(pages: TextItem[][]): Statement {
  if (isKBankStatement(pages)) return parseKBank(pages)
  if (isTrueMoneyStatement(pages)) return parseTrueMoney(pages)
  throw new UserError(`ยังรองรับเฉพาะ statement ของ${SUPPORTED_BANKS}`)
}

export const BANK_LABEL: Record<Statement['bank'], string> = { kbank: 'กสิกรไทย', truemoney: 'TrueMoney' }
