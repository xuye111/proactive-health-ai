import { useState } from 'react'
import { BarChart, type BarPoint } from '../../components/BarChart'
import { SectionTitle } from '../../components/SectionTitle'
import { StageNotice } from '../../components/StageNotice'
import insights from '../../data/insights.json'
import {
  averageOf,
  formatNumber,
  formatSleepShort,
  previousDays,
  recentDays,
  sleepBaselineHours,
  weekdayCn,
} from '../../lib/derive'
import type { DailyRecord } from '../../types'

const RANGES = [7, 30] as const
type Range = (typeof RANGES)[number]

const pointsOf = (
  days: DailyRecord[],
  range: Range,
  pick: (record: DailyRecord) => number,
): BarPoint[] =>
  days.map((record, index) => ({
    label: range === 7 ? weekdayCn(record.date) : String(Number(record.date.slice(-2))),
    value: pick(record),
    emphasis: index === days.length - 1,
  }))

/** 「趋势」视图：长期变化 + 判断依据。 */
export default function TrendsPanel() {
  const [range, setRange] = useState<Range>(7)

  const days = range === 7 ? recentDays(7) : recentDays(30)
  const previousSteps = averageOf(previousDays(7), (record) => record.steps)

  const contextRows = [
    { label: '医学参考范围', value: insights.context.population },
    { label: '个人历史基线', value: insights.context.personal },
    { label: '短期变化趋势', value: insights.context.trend },
    { label: '生活事件', value: insights.context.events },
  ]

  return (
    <div className="space-y-5 px-4 pt-4">
      {/* 时间范围：与页面级的「今天 / 趋势」分段区分开，做成轻量的小控件 */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] text-muted">时间范围</span>
        <div className="flex gap-1 rounded-lg bg-line-soft p-0.5">
          {RANGES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              aria-pressed={range === option}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                range === option ? 'bg-surface text-ink shadow-sm' : 'text-muted'
              }`}
            >
              近 {option} 天
            </button>
          ))}
        </div>
      </div>

      {/* 睡眠 */}
      <section className="card p-4">
        <SectionTitle title="睡眠时长" hint={`个人基线 ${sleepBaselineHours.toFixed(1)} 小时`} />
        <BarChart
          points={pointsOf(days, range, (record) => record.sleepHours)}
          baseline={sleepBaselineHours}
          baselineLabel="基线"
          formatValue={formatSleepShort}
          tone="sleep"
          lowTone="warn"
          showValues={range === 7}
          labelEvery={range === 7 ? 1 : 5}
        />
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          低于基线的柱子标为橙色。近 {range} 天中有{' '}
          {days.filter((day) => day.sleepHours < sleepBaselineHours).length} 天低于个人基线。
        </p>
      </section>

      {/* 步数 */}
      <section className="card p-4">
        <SectionTitle
          title="步数"
          hint={`过去 7 日均值 ${formatNumber(Math.round(previousSteps))}`}
        />
        <BarChart
          points={pointsOf(days, range, (record) => record.steps)}
          baseline={previousSteps}
          baselineLabel="7 日均值"
          formatValue={(value) => formatNumber(Math.round(value))}
          tone="activity"
          lowTone="danger"
          showValues={range === 7}
          labelEvery={range === 7 ? 1 : 5}
        />
      </section>

      {/* AI 解释 */}
      <section>
        <SectionTitle title="趋势解读" />
        <div className="card p-4">
          <p className="text-[13px] leading-relaxed text-ink">{insights.trendNarrative}</p>
        </div>
      </section>

      {/* 四层判断结构 */}
      <section>
        <SectionTitle title="判断依据" hint="健康判断不能只看医学正常范围" />
        <dl className="card divide-y divide-line-soft">
          {contextRows.map((row) => (
            <div key={row.label} className="flex gap-3 px-4 py-3">
              <dt className="w-[88px] shrink-0 text-[12px] text-muted">{row.label}</dt>
              <dd className="min-w-0 flex-1 text-[13px] leading-snug text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <StageNotice>
        当前图表由 30 天演示数据直接计算。第二阶段会在这里加入 Health Signal
        规则识别（例如「近 3 日均值低于个人基线 15%」触发的结构化信号）。
      </StageNotice>
    </div>
  )
}
