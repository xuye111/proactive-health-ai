interface DotScaleProps {
  label: string
  value: number
  max?: number
  tone?: 'brand' | 'warn' | 'mind'
  /** 传入 onChange 即为可交互（记录页用于补录主观状态）。 */
  onChange?: (value: number) => void
}

const TONE_VAR: Record<'brand' | 'warn' | 'mind', string> = {
  brand: 'var(--color-brand)',
  warn: 'var(--color-warn)',
  mind: 'var(--color-mind)',
}

/** 主观状态的五格量表（方案 §7.4）。 */
export function DotScale({ label, value, max = 5, tone = 'brand', onChange }: DotScaleProps) {
  const interactive = onChange !== undefined

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-[13px] text-ink-soft">{label}</span>
      <div className="flex items-center gap-2" role={interactive ? 'radiogroup' : 'img'} aria-label={`${label} ${value}/${max}`}>
        {Array.from({ length: max }, (_, index) => {
          const filled = index < value
          const dot = (
            <span
              className="block size-[13px] rounded-full border transition-colors"
              style={{
                background: filled ? TONE_VAR[tone] : 'transparent',
                borderColor: filled ? TONE_VAR[tone] : 'var(--color-line)',
              }}
            />
          )
          return interactive ? (
            <button
              key={index}
              type="button"
              role="radio"
              aria-checked={value === index + 1}
              aria-label={`${label} ${index + 1}`}
              onClick={() => onChange(index + 1)}
              className="p-0.5"
            >
              {dot}
            </button>
          ) : (
            <span key={index}>{dot}</span>
          )
        })}
      </div>
    </div>
  )
}
