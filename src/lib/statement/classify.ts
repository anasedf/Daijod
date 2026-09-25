// เดาว่าแต่ละรายการใน statement ควรเป็นรายจ่าย/รายรับหมวดไหน หรือเป็นการโอนไปกระเป๋าอื่น
import { getPref, setPref } from '../prefs'
import type { Category, Wallet } from '../types'
import type { StatementTx } from './kbank'

export type Choice = { type: 'expense' | 'income'; categoryId: string } | { type: 'transfer'; walletId: string }

export interface Counterparty {
  name: string // ชื่อสั้น ๆ ที่อ่านรู้เรื่อง ใช้เป็นรายละเอียดของรายการ
  key: string // ใช้จำว่าเคยจัดคู่ค้านี้เข้าหมวดไหน
}

const BANK_CODES = /\b(KTB|SCB|BAY|BBL|TMB|TTB|GSB|KBANK|UOB|CIMB|LHB|KKP|TISCO|BAAC|GHB|ICBC)\b/g

/** ฝากเงินสดที่สาขา ตู้ CDM หรือเซเว่น */
function isCashDeposit(tx: StatementTx) {
  return tx.kind === 'ฝากเงินสด' || (tx.direction === 'in' && /^รหัสอ้างอิง (CDM|ATM)/.test(tx.detail))
}

const squash = (s: string) => s.toLowerCase().replace(/[\s.,_-]/g, '')

/** ดึงชื่อคู่ค้าออกจากรายละเอียด เช่น "โอนไป พร้อมเพย์ X1234 ร้านข้าว++" -> "ร้านข้าว" */
export function counterparty(tx: StatementTx): Counterparty {
  if (tx.kind === 'รับดอกเบี้ยเงินฝาก') return { name: 'ดอกเบี้ยเงินฝาก', key: 'interest' }
  if (isCashDeposit(tx)) return { name: 'ฝากเงินสด', key: 'cash-deposit' }

  const edc = /EDC(\d+)/.exec(tx.detail)
  if (tx.kind === 'ชำระด้วยบัตรเดบิต' || edc) {
    return { name: edc ? `บัตรเดบิต EDC${edc[1]}` : 'บัตรเดบิต', key: 'debit-card' }
  }

  let s = tx.detail
  // ตัดส่วนที่เป็นชื่อเต็มทางกฎหมาย/รหัสอ้างอิงที่ต่อท้ายหลังเครื่องหมายตัดคำ
  s = s.replace(/\s*\(\s*(ชื่อ\s*บัญชี|ODD).*$/, '').replace(/\s*\(?\+\+.*$/, '')
  s = s.replace(/^(โอนไป|จาก|เพื่อชำระ)\s*/, '')
  s = s.replace(/พร้อมเพย์/g, '').replace(/Ref\s+\S+/gi, '').replace(BANK_CODES, '')
  const code = /\bX\d{4}\b/.exec(s)?.[0] ?? ''
  s = s.replace(/\bX\d{4}\b/g, '')
  s = s.replace(/\+/g, '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
  const name = s || tx.kind
  return { name, key: `${code}|${name}`.toLowerCase() }
}

const KEYWORDS: [RegExp, string][] = [
  [/7-?11|เซเว่น|7-eleven|ข้าว|อาหาร|ก๋วยเตี๋ยว|กาแฟ|cafe|coffee|line ?man|ไลน์แมน|grabfood|foodpanda|kfc|mcdonald|pizza|ครัว|บุฟเฟ่|ชานม/i, 'exp-food'],
  [/ปตท|ptt|บางจาก|bangchak|shell|esso|caltex|\bbts\b|\bmrt\b|grab|bolt|ทางด่วน|น้ำมัน|แท็กซี่|taxi|วินมอ/i, 'exp-travel'],
  [/\btrue\b|ทรู|\bais\b|dtac|3bb|triple t|\btot\b|ไฟฟ้า|ประปา|\bmea\b|\bpea\b|\bmwa\b|\bpwa\b|internet|เน็ต|broadband/i, 'exp-bills'],
  [/shopee|ช้อปปี้|lazada|ลาซาด้า|tiktok|amazon|central|โลตัส|lotus|big ?c|makro|แม็คโคร|uniqlo|ikea/i, 'exp-shopping'],
  [/netflix|spotify|youtube|steam|major|sf cinema|disney|playstation|nintendo|เกม/i, 'exp-fun'],
  [/โรงพยาบาล|รพ\.|คลินิก|clinic|hospital|ร้านยา|เภสัช|boots|watsons|ทันตกรรม/i, 'exp-health'],
  [/หอพัก|ค่าเช่า|ค่าห้อง|apartment|condo|คอนโด|นิติบุคคล/i, 'exp-home'],
]

const RULES_KEY = 'importRules'
const MAX_RULES = 500

function loadRules(): Record<string, Choice> {
  try {
    return JSON.parse(getPref(RULES_KEY) ?? '{}')
  } catch {
    return {}
  }
}

/** จำว่าผู้ใช้จัดคู่ค้าไหนเข้าหมวดไหน ครั้งหน้าจะได้เดาถูก */
export function rememberChoices(entries: { key: string; choice: Choice }[]) {
  const rules = loadRules()
  for (const { key, choice } of entries) {
    delete rules[key]
    rules[key] = choice
  }
  const keys = Object.keys(rules)
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_RULES))) delete rules[k]
  setPref(RULES_KEY, JSON.stringify(rules))
}

export function suggestChoice(
  tx: StatementTx,
  cp: Counterparty,
  ctx: { walletId: string; wallets: Wallet[]; categories: Category[]; rules?: Record<string, Choice> },
): Choice {
  const rules = ctx.rules ?? loadRules()
  const hasCat = (id: string, type: 'expense' | 'income') => ctx.categories.some((c) => c.id === id && c.type === type)
  const others = ctx.wallets.filter((w) => w.id !== ctx.walletId)

  const learned = rules[cp.key]
  if (learned) {
    if (learned.type === 'transfer' && others.some((w) => w.id === learned.walletId)) return learned
    if (learned.type !== 'transfer' && learned.type === (tx.direction === 'in' ? 'income' : 'expense')) {
      return { type: learned.type, categoryId: hasCat(learned.categoryId, learned.type) ? learned.categoryId : '' }
    }
  }

  // ชื่อคู่ค้าตรงกับชื่อกระเป๋าอื่นของเรา (เช่น เติม TrueMoney) -> น่าจะเป็นการโอน
  // เทียบแบบไม่สนช่องว่างและจุด เพื่อให้ "TrueMoney" จับ "TRUE MONEY CO., LTD" ได้
  const hay = `${tx.detail} ${cp.name}`.toLowerCase()
  const squashed = squash(hay)
  const wallet = others.find((w) => squash(w.name).length >= 3 && squashed.includes(squash(w.name)))
  if (wallet) return { type: 'transfer', walletId: wallet.id }

  if (isCashDeposit(tx)) {
    const cash = others.find((w) => w.type === 'cash')
    if (cash) return { type: 'transfer', walletId: cash.id }
  }

  if (tx.direction === 'in') {
    return { type: 'income', categoryId: hasCat('inc-other', 'income') ? 'inc-other' : '' }
  }
  for (const [re, id] of KEYWORDS) {
    if (re.test(hay) && hasCat(id, 'expense')) return { type: 'expense', categoryId: id }
  }
  return { type: 'expense', categoryId: '' }
}
