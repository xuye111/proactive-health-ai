import rawRecords from '../data/healthRecords.json'
import type { DailyRecord } from '../types'
import type { DailyObservation, HealthState } from './healthStore'

/** 30 天演示数据，按日期升序（方案 §17）。 */
export const records: DailyRecord[] = rawRecords

export const today: DailyRecord = records[records.length - 1]

const average = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

/** 个人历史基线：全部演示数据的睡眠均值（方案 §29.1 Personal Baseline）。 */
export const sleepBaselineHours = average(records.map((record) => record.sleepHours))

/** 近 N 天（含今日）。 */
export const recentDays = (count: number): DailyRecord[] => records.slice(-count)

/** 过去 N 天，不含今日——用于「较过去 7 日」这类对比。 */
export const previousDays = (count: number): DailyRecord[] => records.slice(-(count + 1), -1)

export const seriesOf = (days: DailyRecord[], pick: (record: DailyRecord) => number): number[] =>
  days.map(pick)

export const averageOf = (days: DailyRecord[], pick: (record: DailyRecord) => number): number =>
  average(seriesOf(days, pick))

/** 跌幅百分比（正数表示下降）。 */
export const declinePct = (current: number, base: number): number =>
  base === 0 ? 0 : ((base - current) / base) * 100

/** 从最后一天往前数，连续低于阈值的天数。 */
export const consecutiveDaysBelow = (values: number[], threshold: number): number => {
  let count = 0
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (values[i] >= threshold) break
    count += 1
  }
  return count
}

export const formatSleep = (hours: number): string => {
  const total = Math.round(hours * 60)
  return `${Math.floor(total / 60)} 小时 ${String(total % 60).padStart(2, '0')} 分钟`
}

export const formatSleepShort = (hours: number): string => {
  const total = Math.round(hours * 60)
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}m`
}

export const formatNumber = (value: number): string => value.toLocaleString('en-US')

export const formatHours = (hours: number): string => `${hours.toFixed(1)} 小时`

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export const formatDateCn = (date: string): string => {
  const [, month, day] = date.split('-')
  return `${Number(month)} 月 ${Number(day)} 日`
}

export const weekdayCn = (date: string): string =>
  WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]

export const greeting = (hour: number): string => {
  if (hour < 5) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 13) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

/** 本人模式最近 7 个日历日的目标执行情况，缺失数据不算未达标。 */
export function personalGoalSummary(days: DailyObservation[], date: string, goals: HealthState['goals']) {
  const end = Date.parse(`${date}T12:00:00Z`)
  const window = days.filter((day) => {
    const at = Date.parse(`${day.date}T12:00:00Z`)
    return at <= end && at > end - 7 * 86400000
  })
  const sleep = window.filter((day) => typeof day.sleepHours === 'number')
  const activity = window.filter((day) => typeof day.activeMinutes === 'number')
  return {
    sleep: { recorded: sleep.length, met: sleep.filter((day) => (day.sleepHours ?? 0) >= goals.sleepHours).length, target: goals.sleepHours },
    activity: { recorded: activity.length, met: activity.filter((day) => (day.activeMinutes ?? 0) >= goals.activeMinutes).length, target: goals.activeMinutes },
  }
}

/** 主观状态标签（1–5）。 */
export const SUBJECTIVE_LABELS: Record<'energy' | 'stress' | 'mood', string> = {
  energy: '精力',
  stress: '压力',
  mood: '情绪',
}
