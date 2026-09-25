import { Plus, Trash2, Wand2 } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import type { AppData } from '../hooks/useData'
import {
  clearLearnedRules,
  deleteLearnedRule,
  describeRuleKey,
  loadKeywordRules,
  loadLearnedRules,
  saveKeywordRules,
  type Choice,
  type KeywordRule,
} from '../lib/statement/classify'
import { useConfirm, useToast } from './ui'

function decode(v: string): Choice {
  const [type, id = ''] = v.split(':')
  return type === 'transfer' ? { type, walletId: id } : { type: type as 'expense' | 'income', categoryId: id }
}

function ChoiceOptions({ data }: { data: AppData }) {
  const group = (type: 'expense' | 'income', label: string) => (
    <optgroup label={label}>
      <option value={`${type}:`}>{label} · ไม่ระบุหมวด</option>
      {data.categories
        .filter((c) => c.type === type)
        .map((c) => (
          <option key={c.id} value={`${type}:${c.id}`}>
            {c.name}
          </option>
        ))}
    </optgroup>
  )
  return (
    <>
      {group('expense', 'รายจ่าย')}
      {group('income', 'รายรับ')}
      {data.wallets.length > 0 && (
        <optgroup label="โอนกับกระเป๋า">
          {data.wallets.map((w) => (
            <option key={w.id} value={`transfer:${w.id}`}>
              โอนกับ {w.name}
            </option>
          ))}
        </optgroup>
      )}
    </>
  )
}

function ChoiceLabel({ choice, data }: { choice: Choice; data: AppData }): ReactNode {
  if (choice.type === 'transfer') return `โอนกับ ${data.walletMap.get(choice.walletId)?.name ?? '(กระเป๋าถูกลบ)'}`
  const label = choice.type === 'income' ? 'รายรับ' : 'รายจ่าย'
  if (!choice.categoryId) return `${label} · ไม่ระบุหมวด`
  return `${label} · ${data.categoryMap.get(choice.categoryId)?.name ?? '(หมวดถูกลบ)'}`
}

/** จัดการกฎที่ใช้เดาหมวดตอนนำเข้า statement: กฎคำที่ตั้งเอง และกฎที่จำจากการนำเข้าครั้งก่อน */
export function ImportRules({ data }: { data: AppData }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [keywords, setKeywords] = useState<KeywordRule[]>(loadKeywordRules)
  const [learned, setLearned] = useState<Record<string, Choice>>(loadLearnedRules)
  const [pattern, setPattern] = useState('')
  const [choice, setChoice] = useState(`expense:${data.categories.find((c) => c.type === 'expense')?.id ?? ''}`)
  const [showAll, setShowAll] = useState(false)

  const learnedEntries = Object.entries(learned).reverse() // ล่าสุดก่อน
  const LIMIT = 12

  function addKeyword(e: FormEvent) {
    e.preventDefault()
    const p = pattern.trim()
    if (!p) return
    const next = [...keywords.filter((k) => k.pattern.toLowerCase() !== p.toLowerCase()), { pattern: p, choice: decode(choice) }]
    setKeywords(next)
    saveKeywordRules(next)
    setPattern('')
    toast(`เพิ่มกฎ “${p}” แล้ว`)
  }

  function removeKeyword(i: number) {
    const next = keywords.filter((_, j) => j !== i)
    setKeywords(next)
    saveKeywordRules(next)
  }

  function removeLearned(key: string) {
    deleteLearnedRule(key)
    setLearned(loadLearnedRules())
  }

  async function clearAll() {
    const ok = await confirm({
      title: 'ล้างกฎที่จำไว้ทั้งหมด?',
      message: <p>การนำเข้าครั้งต่อไปจะเดาหมวดจากกฎคำและกฎในตัวเท่านั้น จนกว่าจะเลือกใหม่</p>,
      confirmLabel: 'ล้างทั้งหมด',
      danger: true,
    })
    if (!ok) return
    clearLearnedRules()
    setLearned({})
  }

  return (
    <section className="card p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand" aria-hidden>
          <Wand2 size={20} />
        </span>
        <div>
          <h2 className="card-title">กฎจัดหมวดตอนนำเข้า statement</h2>
          <p className="text-xs text-muted">ลำดับที่ใช้: กฎที่จำไว้ → กฎคำของคุณ → ชื่อตรงกับกระเป๋า → กฎในตัว</p>
        </div>
      </div>

      {/* กฎคำที่ตั้งเอง */}
      <h3 className="mt-5 text-sm font-semibold">กฎคำของคุณ</h3>
      <form onSubmit={addKeyword} className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <input
          className="field min-h-10 text-sm"
          placeholder="ถ้ารายละเอียดมีคำว่า… เช่น กาแฟ"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          aria-label="คำที่ต้องมี"
          maxLength={60}
        />
        <select className="field min-h-10 text-sm" value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="ให้เป็น">
          <ChoiceOptions data={data} />
        </select>
        <button type="submit" className="btn-secondary min-h-10 px-3 text-sm" disabled={!pattern.trim()}>
          <Plus size={16} aria-hidden /> เพิ่มกฎ
        </button>
      </form>
      {keywords.length === 0 ? (
        <p className="mt-2 text-xs text-muted">ยังไม่มี · ตัวอย่าง: “7-11” → อาหาร, “ค่าเช่า” → บ้าน, “ทรูมันนี่” → โอนกับ TrueMoney</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {keywords.map((k, i) => (
            <li key={k.pattern} className="flex items-center gap-2 rounded-xl bg-sunken px-3 py-1.5 text-sm">
              <span className="font-medium">“{k.pattern}”</span>
              <span className="text-muted">→</span>
              <span className="min-w-0 flex-1 truncate text-ink-2">
                <ChoiceLabel choice={k.choice} data={data} />
              </span>
              <button className="icon-btn h-8 w-8 hover:text-expense" onClick={() => removeKeyword(i)} aria-label={`ลบกฎ ${k.pattern}`}>
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* กฎที่จำจากการนำเข้า */}
      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          กฎที่จำจากการนำเข้า <span className="font-normal text-muted">({learnedEntries.length})</span>
        </h3>
        {learnedEntries.length > 0 && (
          <button className="text-xs font-medium text-expense hover:underline" onClick={clearAll}>
            ล้างทั้งหมด
          </button>
        )}
      </div>
      {learnedEntries.length === 0 ? (
        <p className="mt-2 text-xs text-muted">จะถูกจำอัตโนมัติทุกครั้งที่นำเข้า ตามหมวดที่คุณเลือกให้แต่ละคู่ค้า</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-line/70 rounded-xl border border-line">
            {(showAll ? learnedEntries : learnedEntries.slice(0, LIMIT)).map(([key, c]) => (
              <li key={key} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate" title={key}>
                  {describeRuleKey(key)}
                </span>
                <span className="max-w-[45%] truncate text-xs text-ink-2">
                  <ChoiceLabel choice={c} data={data} />
                </span>
                <button className="icon-btn h-8 w-8 hover:text-expense" onClick={() => removeLearned(key)} aria-label={`ลบกฎ ${describeRuleKey(key)}`}>
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
          {learnedEntries.length > LIMIT && (
            <button className="mt-2 text-xs font-medium text-brand hover:underline" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'แสดงน้อยลง' : `แสดงทั้งหมด ${learnedEntries.length} กฎ`}
            </button>
          )}
        </>
      )}
    </section>
  )
}
