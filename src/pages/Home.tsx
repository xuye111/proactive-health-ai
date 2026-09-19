import { Link } from 'react-router-dom'
import { AssistantAvatar } from '../components/AssistantAvatar'
import { ChecklistItem } from '../components/ChecklistItem'
import { ScoreRing } from '../components/ScoreRing'
import { SectionTitle } from '../components/SectionTitle'
import { IconActivity, IconChevronRight, IconSleep } from '../components/icons'
import insights from '../data/insights.json'
import profile from '../data/profile.json'
import { useTodayPlan } from '../lib/agentRules'
import { useAgentState } from '../lib/agentStore'
import { ASSISTANT_NAME } from '../lib/assistant'
import {
  averageOf,
  consecutiveDaysBelow,
  declinePct,
  formatDateCn,
  formatNumber,
  formatSleepShort,
  greeting,
  previousDays,
  recentDays,
  records,
  seriesOf,
  sleepBaselineHours,
  today,
  weekdayCn,
} from '../lib/derive'
import { useTodayActions } from '../lib/useTodayActions'

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

/**
 * 首页的主角是「小满主动做了什么」，不是健康分。
 * 分数打头就变成被动健康产品的仪表盘了；这里把小满的动作与待你确认的事情放在第一屏，
 * 分数与指标退到后面，作为小满判断的依据。
 */
export default function Home() {
  const { submitted } = useAgentState()
  const interpretation = useTodayPlan()

  const daysBelowBaseline = consecutiveDaysBelow(
    seriesOf(records, (record) => record.sleepHours),
    sleepBaselineHours,
  )
  const previousSteps = averageOf(previousDays(7), (record) => record.steps)
  const stepDecline = declinePct(today.steps, previousSteps)
  const last3Average = mean(recentDays(3).map((record) => record.sleepHours))
  const prior3Average = mean(records.slice(-6, -3).map((record) => record.sleepHours))

  const actionIds = interpretation.actions.map((action) => action.id)
  const { done, toggle, completed, total } = useTodayActions(today.date, actionIds)

  const watchItems = [
    {
      id: 'sleep',
      Icon: IconSleep,
      label: '睡眠',
      value: formatSleepShort(today.sleepHours),
      note: `连续 ${daysBelowBaseline} 天低于个人平均值`,
    },
    {
      id: 'activity',
      Icon: IconActivity,
      label: '活动',
      value: `${formatNumber(today.steps)} 步`,
      note: `较过去 7 日下降 ${Math.round(stepDecline)}%`,
    },
  ]

  // 小满今天的动作：发现 → 判断 → 生成/调整（+ 记忆）。状态变化全部来自真实 store。
  const planLine = submitted
    ? interpretation.changes.length > 0
      ? interpretation.changes.join('；')
      : '已按你的反馈更新判断'
    : `生成今日 ${interpretation.actions.length} 条行动，其中 1 条针对晚间节律`

  const timeline = [
    {
      kind: '发现',
      when: '今早',
      text: `近 3 日睡眠 ${recentDays(3).map((r) => r.sleepHours.toFixed(1)).join(' / ')} 小时，连续 ${daysBelowBaseline} 天低于个人基线 ${sleepBaselineHours.toFixed(1)} 小时`,
    },
    { kind: '判断', when: '今早', text: insights.finding.summary },
    { kind: submitted ? '调整' : '生成', when: submitted ? '刚刚' : '今早', text: planLine },
    ...(submitted && interpretation.memoryNotes.length > 0
      ? [{ kind: '记忆', when: '刚刚', text: `已写入：${interpretation.memoryNotes.join('；')}` }]
      : []),
  ]

  return (
    <>
      <header className="safe-top px-5 pt-6 pb-4">
        <p className="text-[12px] text-muted">
          {formatDateCn(today.date)} · {weekdayCn(today.date)}
        </p>
        <h1 className="mt-1 text-[22px] leading-tight font-semibold tracking-tight">
          {greeting(new Date().getHours())}，{profile.name}
        </h1>
        <p className="mt-1.5 text-[12.5px] leading-snug text-ink-soft">
          {ASSISTANT_NAME}今天已发现 {watchItems.length} 处变化，
          {submitted ? '并已按你的反馈调整了计划' : '有 1 件事需要你确认'}
        </p>
      </header>

      <div className="space-y-5 px-4">
        {/* 主动横幅：小满找你，而不是你找它 */}
        <Link
          to="/agent"
          className={`block rounded-2xl border p-4 ${
            submitted ? 'border-line bg-surface' : 'border-brand/30 bg-brand-soft/30'
          }`}
        >
          <div className="flex items-center gap-2">
            <AssistantAvatar size={26} online={!submitted} />
            <span className="text-[12px] font-medium text-ink">{ASSISTANT_NAME}</span>
            <span className="text-[10px] text-muted">主动追问</span>
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${
                submitted ? 'bg-brand-soft text-brand-deep' : 'bg-brand text-white'
              }`}
            >
              {submitted ? '已完成' : '需要你确认'}
            </span>
          </div>
          <p className="mt-2.5 text-[15px] leading-snug font-medium text-ink">
            {submitted
              ? '已按你的反馈调整今天的计划'
              : `最近三天平均睡眠从 ${prior3Average.toFixed(1)} 小时降到 ${last3Average.toFixed(1)} 小时`}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-ink-soft">
            {submitted
              ? (interpretation.changes[0] ?? '判断已更新，今日行动同步调整')
              : '最近是否出现：入睡困难 / 夜间醒来 / 工作较晚 / 情绪压力'}
          </p>
          <span className="mt-2.5 inline-flex items-center gap-0.5 text-[12px] font-medium text-brand">
            {submitted ? `查看${ASSISTANT_NAME}的判断` : '现在回答'}
            <IconChevronRight className="size-3.5" />
          </span>
        </Link>

        {/* 小满今天的动作 */}
        <section>
          <SectionTitle title={`${ASSISTANT_NAME}今天的动作`} hint="发现 → 判断 → 行动，不需要你发起" />
          <div className="card p-4">
            <ol className="relative space-y-3.5 pl-5">
              <span aria-hidden className="absolute top-1.5 bottom-1.5 left-[5px] w-px bg-line" />
              {timeline.map((item) => (
                <li key={`${item.kind}-${item.text}`} className="relative">
                  <span
                    aria-hidden
                    className="absolute top-[5px] -left-5 size-[9px] rounded-full border-2 border-surface bg-brand"
                  />
                  <p className="text-[10px] tracking-wide text-muted">
                    {item.kind} · {item.when}
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-ink">{item.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 今日行动：AI 判断的结果，今天要做的事 */}
        <section>
          <SectionTitle
            title="今日行动"
            hint={`已完成 ${completed} / ${total}`}
            action={{ label: '全部', to: '/record' }}
          />
          <ul className="card divide-y divide-line-soft overflow-hidden">
            {interpretation.actions.map((action) => (
              <ChecklistItem
                key={action.id}
                checked={done[action.id] === true}
                onToggle={() => toggle(action.id)}
                title={action.text}
                reason={action.reason}
              />
            ))}
          </ul>
        </section>

        {/* 今日状态：AI 判断的依据（原来这里是首页的主角，现在退到后面） */}
        <section>
          <SectionTitle
            title="今日状态"
            hint={`${ASSISTANT_NAME}判断的依据`}
            action={{ label: '趋势', to: '/trends' }}
          />
          <div className="card p-4">
            <ScoreRing
              score={insights.healthScore}
              label={insights.scoreLabel}
              note={insights.scoreNote}
            />
          </div>
          <div className="card mt-3 divide-y divide-line-soft">
            {watchItems.map(({ id, Icon, label, value, note }) => (
              <div key={id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-soft">
                  <Icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-muted">{label}</p>
                  <p className="text-[15px] font-medium text-ink">{value}</p>
                </div>
                <p className="max-w-[46%] text-right text-[11px] leading-snug text-warn">{note}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="px-2 pb-2 text-center text-[10px] leading-relaxed text-muted">
          演示数据 · 未接入真实设备与医疗机构系统
        </p>
      </div>
    </>
  )
}
