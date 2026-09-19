import {
  averageOf,
  consecutiveDaysBelow,
  declinePct,
  formatNumber,
  formatSleepShort,
  previousDays,
  recentDays,
  records as allRecords,
  today,
} from '../lib/derive'
import type { Baseline, Signal } from './types'

/**
 * 信号识别（方案 §12）。
 *
 * 为什么要有这一层：把「原始数据 → 结论」之间插入一层结构化、可解释、可测试的信号，
 * 模型只面对信号而不是原始数据，判断就变得可复核（每条信号都带阈值说明）。
 * 所有阈值都是显式常量，改阈值即改行为，且评测能立刻发现影响。
 */

export const SIGNAL_THRESHOLDS = {
  /** 近 3 日均值低于个人基线的比例 */
  sleepAlert: 0.9,
  sleepWatch: 0.95,
  /** 今日步数相比过去 7 日均值 */
  stepAlert: 0.75,
  stepWatch: 0.9,
  /** 主观压力 */
  stressWatch: 4,
  /** 当日咖啡因杯数 */
  caffeineWatch: 3,
  caffeineInfo: 2,
  /** 主观精力 */
  energyWatch: 2,
  /** 入睡时点连续推迟的最少天数 */
  bedtimeDelayDays: 3,
} as const

export interface SignalInput {
  energy: number
  stress: number
  mood: number
}

/** 个人基线：睡眠与步数。样本不足时返回样本天数供上层判断可信度。 */
export function computeBaseline(sampleDays = allRecords.length): Baseline {
  const window = allRecords.slice(-sampleDays)
  return {
    sleepHours: averageOf(window, (record) => record.sleepHours),
    steps: averageOf(window, (record) => record.steps),
    sampleDays: window.length,
  }
}

const clockToMinutes = (clock: string): number => {
  const [hour, minute] = clock.split(':').map(Number)
  return hour * 60 + minute
}

/** 入睡时点连续推迟天数（跨零点，按「越晚越大」归一化后比较）。 */
function bedtimeDelayStreak(): number {
  const days = recentDays(SIGNAL_THRESHOLDS.bedtimeDelayDays + 1)
  const normalised = days.map((record) => {
    const minutes = clockToMinutes(record.bedTime)
    // 00:42 → 42；23:50 → -10（更早）。以 12:00 为分界归一化，保证「越晚值越大」
    return minutes < 12 * 60 ? minutes : minutes - 24 * 60
  })
  let streak = 0
  for (let i = normalised.length - 1; i > 0; i -= 1) {
    if (normalised[i] > normalised[i - 1]) streak += 1
    else break
  }
  return streak
}

export function detectSignals(input: SignalInput, baseline: Baseline = computeBaseline()): Signal[] {
  const signals: Signal[] = []
  const last3 = recentDays(3)
  const last3Sleep = last3.map((record) => record.sleepHours)
  const last3Average = averageOf(last3, (record) => record.sleepHours)
  const previousSteps = averageOf(previousDays(7), (record) => record.steps)
  const stepDecline = declinePct(today.steps, previousSteps)
  const belowDays = consecutiveDaysBelow(
    allRecords.map((record) => record.sleepHours),
    baseline.sleepHours,
  )
  const delayStreak = bedtimeDelayStreak()

  const sleepRatio = baseline.sleepHours === 0 ? 1 : last3Average / baseline.sleepHours
  if (sleepRatio < SIGNAL_THRESHOLDS.sleepAlert) {
    signals.push({
      type: 'sleep_decline',
      label: '睡眠下降',
      severity: 'alert',
      evidence: [
        `近 3 日睡眠 ${last3Sleep.map((value) => value.toFixed(1)).join(' / ')} 小时`,
        `个人基线 ${baseline.sleepHours.toFixed(1)} 小时`,
      ],
      rule: `近 3 日均值 < 个人基线 × ${SIGNAL_THRESHOLDS.sleepAlert}`,
    })
  } else if (sleepRatio < SIGNAL_THRESHOLDS.sleepWatch) {
    signals.push({
      type: 'sleep_decline',
      label: '睡眠轻微下降',
      severity: 'watch',
      evidence: [`近 3 日均值 ${last3Average.toFixed(1)} 小时`, `个人基线 ${baseline.sleepHours.toFixed(1)} 小时`],
      rule: `近 3 日均值 < 个人基线 × ${SIGNAL_THRESHOLDS.sleepWatch}`,
    })
  }

  if (belowDays >= 3) {
    signals.push({
      type: 'sleep_decline',
      label: `连续 ${belowDays} 天低于个人基线`,
      severity: belowDays >= 5 ? 'alert' : 'watch',
      evidence: [`基线 ${baseline.sleepHours.toFixed(1)} 小时`, `连续 ${belowDays} 天低于基线`],
      rule: `连续 ≥ 3 天低于个人基线`,
    })
  }

  if (delayStreak >= SIGNAL_THRESHOLDS.bedtimeDelayDays) {
    signals.push({
      type: 'bedtime_delay',
      label: '入睡时点持续推迟',
      severity: 'watch',
      evidence: [
        `最近 ${delayStreak + 1} 天入睡：${recentDays(delayStreak + 1)
          .map((record) => record.bedTime)
          .join(' → ')}`,
      ],
      rule: `入睡时点连续推迟 ≥ ${SIGNAL_THRESHOLDS.bedtimeDelayDays} 天`,
    })
  }

  const stepRatio = previousSteps === 0 ? 1 : today.steps / previousSteps
  if (stepRatio < SIGNAL_THRESHOLDS.stepAlert) {
    signals.push({
      type: 'activity_decline',
      label: '活动量明显下降',
      severity: 'alert',
      evidence: [`今日 ${formatNumber(today.steps)} 步`, `过去 7 日均值 ${formatNumber(Math.round(previousSteps))} 步`],
      rule: `今日步数 < 过去 7 日均值 × ${SIGNAL_THRESHOLDS.stepAlert}`,
    })
  } else if (stepRatio < SIGNAL_THRESHOLDS.stepWatch) {
    signals.push({
      type: 'activity_decline',
      label: '活动量下降',
      severity: 'watch',
      evidence: [`今日 ${formatNumber(today.steps)} 步（下降 ${Math.round(stepDecline)}%）`],
      rule: `今日步数 < 过去 7 日均值 × ${SIGNAL_THRESHOLDS.stepWatch}`,
    })
  }

  if (input.stress >= SIGNAL_THRESHOLDS.stressWatch) {
    signals.push({
      type: 'stress_increase',
      label: '压力水平偏高',
      severity: input.stress >= 5 ? 'alert' : 'watch',
      evidence: [`今日主观压力 ${input.stress}/5`],
      rule: `主观压力 ≥ ${SIGNAL_THRESHOLDS.stressWatch}`,
    })
  }

  if (today.caffeineCups >= SIGNAL_THRESHOLDS.caffeineWatch) {
    signals.push({
      type: 'caffeine_late',
      label: '咖啡因摄入偏多',
      severity: 'watch',
      evidence: [`今日 ${today.caffeineCups} 杯`],
      rule: `当日咖啡因 ≥ ${SIGNAL_THRESHOLDS.caffeineWatch} 杯`,
    })
  } else if (today.caffeineCups >= SIGNAL_THRESHOLDS.caffeineInfo) {
    signals.push({
      type: 'caffeine_late',
      label: '有咖啡因摄入',
      severity: 'info',
      evidence: [`今日 ${today.caffeineCups} 杯`],
      rule: `当日咖啡因 ≥ ${SIGNAL_THRESHOLDS.caffeineInfo} 杯`,
    })
  }

  if (input.energy <= SIGNAL_THRESHOLDS.energyWatch) {
    signals.push({
      type: 'low_energy',
      label: '自评精力偏低',
      severity: 'watch',
      evidence: [`今日主观精力 ${input.energy}/5`],
      rule: `主观精力 ≤ ${SIGNAL_THRESHOLDS.energyWatch}`,
    })
  }

  return signals
}

/** 信号摘要：给 Context 与 Trace 用的一行话。 */
export function summariseSignals(signals: Signal[]): string {
  if (signals.length === 0) return '今天没有需要关注的信号'
  const alerts = signals.filter((signal) => signal.severity === 'alert')
  const head = alerts.length > 0 ? alerts : signals
  return head
    .slice(0, 3)
    .map((signal) => signal.label)
    .join('、')
}

/** 今日睡眠的一句话，供上下文与文案复用。 */
export const sleepSummary = (): string => formatSleepShort(today.sleepHours)
