import { formatDateShort, monthRange, todayISO, type DateRange } from '../lib/dates'

export type RangeMode = 'today' | 'month' | 'all' | 'custom'

export interface RangeValue {
  mode: RangeMode
  custom: DateRange
}

export function resolveRange(v: RangeValue): Partial<DateRange> | undefined {
  switch (v.mode) {
    case 'today':
      return { from: todayISO(), to: todayISO() }
    case 'month':
      return monthRange()
    case 'all':
      return undefined
    case 'custom':
      return v.custom
  }
}

export function defaultRange(mode: RangeMode = 'month'): RangeValue {
  return { mode, custom: monthRange() }
}

/** ข้อความช่วงวันที่ เช่น "1 ก.ย. 69 – 30 ก.ย. 69" */
export function rangeLabel(range: Partial<DateRange> | undefined): string {
  if (!range?.from || !range.to) return 'ทุกช่วงเวลา'
  if (range.from === range.to) return formatDateShort(range.from)
  return `${formatDateShort(range.from)} – ${formatDateShort(range.to)}`
}

const MODES: { mode: RangeMode; label: string }[] = [
  { mode: 'today', label: 'วันนี้' },
  { mode: 'month', label: 'เดือนนี้' },
  { mode: 'all', label: 'ทั้งหมด' },
  { mode: 'custom', label: 'กำหนดเอง' },
]

export function RangePicker({
  value,
  onChange,
  showAll = false,
  className = '',
}: {
  value: RangeValue
  onChange: (v: RangeValue) => void
  showAll?: boolean
  className?: string
}) {
  const modes = MODES.filter((m) => showAll || m.mode !== 'all')
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div role="radiogroup" aria-label="ช่วงเวลา" className="segmented w-full sm:w-auto">
        {modes.map((m) => (
          <button
            key={m.mode}
            type="button"
            role="radio"
            aria-checked={value.mode === m.mode}
            onClick={() => onChange({ ...value, mode: m.mode })}
          >
            {m.label}
          </button>
        ))}
      </div>
      {value.mode === 'custom' && (
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <label className="sr-only" htmlFor="range-from">
            ตั้งแต่
          </label>
          <input
            id="range-from"
            type="date"
            className="field min-h-10 text-sm"
            value={value.custom.from}
            max={value.custom.to}
            onChange={(e) => e.target.value && onChange({ ...value, custom: { ...value.custom, from: e.target.value } })}
          />
          <label className="sr-only" htmlFor="range-to">
            ถึง
          </label>
          <input
            id="range-to"
            type="date"
            className="field min-h-10 text-sm"
            value={value.custom.to}
            min={value.custom.from}
            onChange={(e) => e.target.value && onChange({ ...value, custom: { ...value.custom, to: e.target.value } })}
          />
        </div>
      )}
    </div>
  )
}
