import { monthRange, todayISO, type DateRange } from '../lib/dates'

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
}: {
  value: RangeValue
  onChange: (v: RangeValue) => void
  showAll?: boolean
}) {
  const modes = MODES.filter((m) => showAll || m.mode !== 'all')
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="ช่วงเวลา" className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
        {modes.map((m) => (
          <button
            key={m.mode}
            type="button"
            role="radio"
            aria-checked={value.mode === m.mode}
            onClick={() => onChange({ ...value, mode: m.mode })}
            className={`min-h-10 flex-1 rounded-lg text-sm font-medium ${
              value.mode === m.mode ? 'bg-teal-700 text-white' : 'text-slate-600'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {value.mode === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-600">
            ตั้งแต่
            <input
              type="date"
              className="field mt-1"
              value={value.custom.from}
              max={value.custom.to}
              onChange={(e) => e.target.value && onChange({ ...value, custom: { ...value.custom, from: e.target.value } })}
            />
          </label>
          <label className="text-xs text-slate-600">
            ถึง
            <input
              type="date"
              className="field mt-1"
              value={value.custom.to}
              min={value.custom.from}
              onChange={(e) => e.target.value && onChange({ ...value, custom: { ...value.custom, to: e.target.value } })}
            />
          </label>
        </div>
      )}
    </div>
  )
}
