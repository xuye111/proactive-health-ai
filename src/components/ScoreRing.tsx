interface ScoreRingProps {
  score: number
  max?: number
  label: string
  note?: string
}

/** 首页「今日健康状态」的环形分数。 */
export function ScoreRing({ score, max = 100, label, note }: ScoreRingProps) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const ratio = Math.min(Math.max(score / max, 0), 1)

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-[116px] shrink-0">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--color-line)" strokeWidth="9" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[30px] leading-none font-semibold tracking-tight text-ink">
            {score}
          </span>
          <span className="mt-1 text-[10px] text-muted">/ {max}</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-ink">{label}</p>
        {note !== undefined && (
          <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{note}</p>
        )}
      </div>
    </div>
  )
}
