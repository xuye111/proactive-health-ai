import { Link } from 'react-router-dom'
import { AssistantAvatar } from '../../components/AssistantAvatar'
import { ChecklistItem } from '../../components/ChecklistItem'
import { DotScale } from '../../components/DotScale'
import { SectionTitle } from '../../components/SectionTitle'
import { StageNotice } from '../../components/StageNotice'
import {
  IconActivity,
  IconChevronRight,
  IconDiet,
  IconMood,
  IconSleep,
} from '../../components/icons'
import plan from '../../data/plan.json'
import { useTodayPlan } from '../../lib/agentRules'
import { setSubjective, useAgentState } from '../../lib/agentStore'
import { ASSISTANT_NAME } from '../../lib/assistant'
import {
  formatDateCn,
  formatNumber,
  formatSleep,
  formatSleepShort,
  SUBJECTIVE_LABELS,
  today,
} from '../../lib/derive'
import { useTodayActions } from '../../lib/useTodayActions'

const MEAL_LABELS: Array<{ key: 'breakfast' | 'lunch' | 'dinner'; label: string }> = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
]

/** 今日实际值 vs 目标的对应指标，构成「计划 vs 实际」的对照。
 *  注意口径：本周目标多为周维度（如每周 4 次），这里比的是今天的单次/单日目标。 */
const TODAY_METRIC: Record<
  'sleep' | 'activity' | 'caffeine',
  { actual: string; target: string; met: boolean }
> = {
  sleep: { actual: formatSleepShort(today.sleepHours), target: '单日目标 7h00m', met: today.sleepHours >= 7 },
  activity: {
    actual: `${today.activeMinutes} 分钟`,
    target: '单次目标 30 分钟',
    met: today.activeMinutes >= 30,
  },
  caffeine: {
    actual: `${today.caffeineCups} 杯`,
    target: '单日目标 ≤ 1 杯',
    met: today.caffeineCups <= 1,
  },
}

/** 闭环（方案 §9）：计划必须来自判断，执行结果还要回到判断。 */
const LOOP = [`${ASSISTANT_NAME}判断`, '生成行动', '用户执行', '记录结果', '评估效果', '重新规划']

/** 「今天」视图：行动 → 数据 → 目标达成 → 闭环。 */
export default function TodayPanel() {
  const { submitted, subjective } = useAgentState()
  const interpretation = useTodayPlan()
  const actionIds = interpretation.actions.map((action) => action.id)
  const { done, toggle, completed, total } = useTodayActions(today.date, actionIds)

  return (
    <div className="space-y-5 px-4 pt-4">
      {/* 1. 今日行动（计划部分） */}
      <section>
        <SectionTitle
          title="今日行动"
          hint={
            interpretation.answered
              ? `已按你的反馈调整 · 已完成 ${completed} / ${total}`
              : `${formatDateCn(today.date)} · 已完成 ${completed} / ${total}`
          }
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
        {!submitted && (
          <Link
            to="/agent"
            className="mt-2 flex items-center justify-between rounded-xl border border-dashed border-line px-3 py-2 text-[12px] text-ink-soft"
          >
            <span className="flex items-center gap-1.5">
              <AssistantAvatar size={20} />
              {ASSISTANT_NAME}想确认一个问题，回答后会调整这些行动
            </span>
            <IconChevronRight className="size-3.5 text-muted" />
          </Link>
        )}
      </section>

      {/* 2. 今日数据（记录部分） */}
      <section className="space-y-3">
        <SectionTitle title="今日数据" />

        <article className="card p-4">
          <div className="flex items-center gap-2 text-sleep">
            <IconSleep className="size-4" />
            <h3 className="text-[13px] font-semibold">睡眠</h3>
            <span className="ml-auto rounded-full bg-canvas px-2 py-0.5 text-[11px] text-ink-soft">
              评分 {today.sleepScore}
            </span>
          </div>
          <p className="mt-3 text-[26px] leading-none font-semibold tracking-tight">
            {formatSleep(today.sleepHours)}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line-soft pt-3">
            <div>
              <dt className="text-[11px] text-muted">入睡时间</dt>
              <dd className="text-[14px] text-ink">{today.bedTime}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">起床时间</dt>
              <dd className="text-[14px] text-ink">{today.wakeTime}</dd>
            </div>
          </dl>
        </article>

        <article className="card p-4">
          <div className="flex items-center gap-2 text-activity">
            <IconActivity className="size-4" />
            <h3 className="text-[13px] font-semibold">运动</h3>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[26px] leading-none font-semibold tracking-tight">
                {formatNumber(today.steps)}
              </p>
              <p className="mt-1 text-[11px] text-muted">步数</p>
            </div>
            <div>
              <p className="text-[26px] leading-none font-semibold tracking-tight">
                {today.activeMinutes}
                <span className="ml-0.5 text-[13px] font-normal text-muted">min</span>
              </p>
              <p className="mt-1 text-[11px] text-muted">活动时间</p>
            </div>
          </div>
        </article>

        <article className="card p-4">
          <div className="flex items-center gap-2 text-diet">
            <IconDiet className="size-4" />
            <h3 className="text-[13px] font-semibold">饮食</h3>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {MEAL_LABELS.map(({ key, label }) => {
              const eaten = today.meals[key]
              return (
                <span
                  key={key}
                  className={`rounded-full border px-2.5 py-1 text-[12px] ${
                    eaten
                      ? 'border-diet/30 bg-diet/10 text-diet'
                      : 'border-line bg-canvas text-muted line-through'
                  }`}
                >
                  {label}
                </span>
              )
            })}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line-soft pt-3">
            <div>
              <dt className="text-[11px] text-muted">饮水量</dt>
              <dd className="text-[14px] text-ink">{formatNumber(today.waterMl)} ml</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">咖啡因</dt>
              <dd className="text-[14px] text-ink">{today.caffeineCups} 杯</dd>
            </div>
          </dl>
        </article>

        <article className="card p-4">
          <div className="flex items-center gap-2 text-mind">
            <IconMood className="size-4" />
            <h3 className="text-[13px] font-semibold">主观状态</h3>
            <span className="ml-auto text-[11px] text-muted">今天感觉如何</span>
          </div>
          <div className="mt-2 divide-y divide-line-soft">
            <DotScale
              label={SUBJECTIVE_LABELS.energy}
              value={subjective.energy}
              onChange={(value) => setSubjective({ energy: value })}
            />
            <DotScale
              label={SUBJECTIVE_LABELS.stress}
              value={subjective.stress}
              tone="warn"
              onChange={(value) => setSubjective({ stress: value })}
            />
            <DotScale
              label={SUBJECTIVE_LABELS.mood}
              value={subjective.mood}
              tone="mind"
              onChange={(value) => setSubjective({ mood: value })}
            />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            主观状态不能只依赖传感器数据，这里可以手动校准，改动已保存在本机。
          </p>
        </article>
      </section>

      {/* 3. 本周目标与达成 */}
      <section>
        <SectionTitle title="本周目标与达成" hint={`本周自 ${plan.weekOf} 起`} />
        <div className="space-y-3">
          {plan.goals.map((goal) => {
            const metric = TODAY_METRIC[goal.metric as keyof typeof TODAY_METRIC]
            return (
              <article key={goal.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted">{goal.area}</p>
                    <h3 className="text-[14px] leading-snug font-medium text-ink">{goal.title}</h3>
                  </div>
                  <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-[11px] text-ink-soft">
                    {goal.target}
                  </span>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line-soft">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${goal.progress}%` }} />
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-2.5">
                  <span className="text-[12px] text-ink-soft">
                    今日 <span className="font-medium text-ink">{metric.actual}</span>
                    <span className="mx-1 text-muted">vs</span>
                    {metric.target}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      metric.met ? 'bg-brand-soft/70 text-brand-deep' : 'bg-warn-soft text-warn'
                    }`}
                  >
                    {metric.met ? '达标' : '未达标'}
                  </span>
                </div>

                <p className="mt-2 text-[11px] text-muted">{goal.detail}</p>
              </article>
            )
          })}
        </div>
      </section>

      {/* 4. 闭环 */}
      <section>
        <SectionTitle title="计划闭环" hint="先完成产品闭环，再逐渐增加判断能力" />
        <ol className="card flex flex-wrap items-center gap-x-1.5 gap-y-2 p-4">
          {LOOP.map((step, index) => (
            <li key={step} className="flex items-center gap-1.5">
              <span
                className={`rounded-full px-2 py-1 text-[11px] ${
                  index === 5 ? 'bg-brand-soft/70 text-brand-deep' : 'bg-canvas text-ink-soft'
                }`}
              >
                {step}
              </span>
              {index < LOOP.length - 1 && <span className="text-[10px] text-muted">→</span>}
            </li>
          ))}
        </ol>
      </section>

      <StageNotice>
        数据录入与编辑、设备同步（Apple Health / Health Connect）属于第二阶段；勾选与主观状态当前保存在本机。
      </StageNotice>
    </div>
  )
}
