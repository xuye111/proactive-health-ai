export interface BarPoint {
  label: string
  value: number
  /** 该点是否为「今日」，用满饱和度强调。 */
  emphasis?: boolean
}

interface BarChartProps {
  points: BarPoint[]
  /** 个人基线：画一条虚线，低于基线的柱子换色，让结论看得见。 */
  baseline?: number
  baselineLabel?: string
  formatValue: (value: number) => string
  /** 基线以上的柱子颜色。 */
  tone: 'sleep' | 'activity'
  /** 基线以下的柱子颜色（睡眠用橙、步数用红，避免与主色混淆）。 */
  lowTone: 'warn' | 'danger'
  /** 柱子上方是否标数值（7 天视图用；30 天视图会挤）。 */
  showValues?: boolean
  /** 每隔几个点显示一次横轴标签（30 天视图用，避免重叠）。 */
  labelEvery?: number
  minBarPct?: number
}

const TONE_VAR = {
  sleep: 'var(--color-sleep)',
  activity: 'var(--color-activity)',
} as const

const LOW_TONE_VAR = {
  warn: 'var(--color-warn)',
  danger: 'var(--color-danger)',
} as const

/** 纯 CSS/SVG 柱状图，不引第三方图表库。 */
export function BarChart({
  points,
  baseline,
  baselineLabel,
  formatValue,
  tone,
  lowTone,
  showValues = false,
  labelEvery = 1,
  minBarPct = 6,
}: BarChartProps) {
  const max = Math.max(...points.map((point) => point.value), baseline ?? 0)
  const axisMax = max === 0 ? 1 : max * 1.12
  const baselinePct = baseline === undefined ? undefined : (baseline / axisMax) * 100
  const gapClass = points.length > 14 ? 'gap-[3px]' : 'gap-1.5'
  const lastIndex = points.length - 1

  return (
    <div>
      <div className={`relative ${showValues ? 'h-[152px]' : 'h-[132px]'}`}>
        {baselinePct !== undefined && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink/25"
            style={{ bottom: `${baselinePct}%` }}
          >
            {baselineLabel !== undefined && (
              <span className="absolute -top-[9px] right-0 bg-surface px-1 text-[9px] text-ink-soft">
                {baselineLabel}
              </span>
            )}
          </div>
        )}
        <div className={`flex h-full items-end ${gapClass}`}>
          {points.map((point) => {
            const below = baseline !== undefined && point.value < baseline
            const fill = below ? LOW_TONE_VAR[lowTone] : TONE_VAR[tone]
            const opacity = point.emphasis ? 1 : below ? 0.72 : 0.26
            return (
              <div
                key={point.label}
                className="flex h-full flex-1 flex-col justify-end gap-1"
                title={`${point.label} ${formatValue(point.value)}`}
              >
                {showValues && (
                  <span
                    className={`text-center text-[9px] leading-none ${
                      point.emphasis || below ? 'text-ink-soft' : 'text-muted'
                    }`}
                  >
                    {formatValue(point.value)}
                  </span>
                )}
                <div
                  className="w-full rounded-t-[6px]"
                  style={{
                    height: `${Math.max((point.value / axisMax) * 100, minBarPct)}%`,
                    background: fill,
                    opacity,
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div className={`mt-2 flex ${gapClass}`}>
        {points.map((point, index) => {
          const shows = index % labelEvery === 0 || index === lastIndex
          return (
            <span
              key={point.label}
              className={`flex-1 text-center text-[10px] ${
                point.emphasis ? 'font-medium text-ink' : 'text-muted'
              }`}
            >
              {shows ? point.label : ''}
            </span>
          )
        })}
      </div>
    </div>
  )
}
