interface ScoreRingProps {
  score: number | null
  max?: number
  label: string
  note?: string
  tone?: 'default' | 'inverse'
}

/** 首页「今日健康状态」的环形分数。 */
export function ScoreRing({ score, max = 100, label, note, tone = 'default' }: ScoreRingProps) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const ratio = score === null ? 0 : Math.min(Math.max(score / max, 0), 1)

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-[116px] shrink-0">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke={tone === 'inverse' ? 'rgba(255,255,255,.2)' : 'var(--color-line)'} strokeWidth="9" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={tone === 'inverse' ? '#b9f3dc' : 'var(--color-brand)'}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-[30px] leading-none font-semibold tracking-tight ${tone === 'inverse' ? 'text-white' : 'text-ink'}`}>
            {score ?? '—'}
          </span>
          <span className={`mt-1 text-[10px] ${tone === 'inverse' ? 'text-white/70' : 'text-muted'}`}>/ {max}</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className={`text-[15px] font-semibold ${tone === 'inverse' ? 'text-white' : 'text-ink'}`}>{label}</p>
        {note !== undefined && (
          <p className={`mt-1 text-[12px] leading-relaxed ${tone === 'inverse' ? 'text-white/80' : 'text-ink-soft'}`}>{note}</p>
        )}
      </div>
    </div>
  )
}
