import type { DailyObservation } from '../lib/healthStore'

/** 小满第一版作息目标：专业资料确定方向，具体步幅只是待验证的产品规则。 */
export const SLEEP_GUIDANCE = {
  title: '全国爱卫办《睡眠健康核心信息及释义》',
  url: 'https://www.nhc.gov.cn/guihuaxxs/c100133/202503/70d5836afe804a858b899ee951a24a13.shtml',
  note: '规律作息是健康睡眠建议；具体目标需结合个人近期记录和生活约束。',
} as const

export type SleepPreferences = { wakeConstraint?: string; barrier?: string; acceptedTarget?: string; acceptedAt?: string }
export type SleepConflict = {
  date: string
  deviceTime: string
  reportedTime: string
  confirmations: 1 | 2
  status: '待再次核对' | '尊重本人反馈'
  firstConfirmedAt: string
}

export const clockMinutes = (time: string | undefined): number | null => {
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}
const nightMinutes = (time: string): number | null => {
  const value = clockMinutes(time)
  return value === null ? null : value < 720 ? value + 1440 : value
}
const formatTime = (minutes: number): string => {
  const value = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}
/** 目标前一小时是演示提醒时间，不是要求用户在此刻入睡。 */
export const sleepPreparationTime = (target: string | null): string | null => {
  const minutes = clockMinutes(target ?? undefined)
  return minutes === null ? null : formatTime(minutes - 60)
}
/** 仅在目标前一小时的窗口给出应用内准备提示；跨午夜后不补发昨晚的提示。 */
export function preparationDue(target: string | null, now: Date): boolean {
  const goal = clockMinutes(target ?? undefined)
  if (goal === null) return false
  const preparation = (goal - 60 + 1440) % 1440
  const current = now.getHours() * 60 + now.getMinutes()
  return preparation <= goal ? current >= preparation && current < goal : current >= preparation
}

/** 次晨设备显示已醒来后才询问；晚间不把反馈问题当成催睡提醒。 */
export function morningFeedbackDue(wakeTime: string | undefined, now: Date): boolean {
  const wake = clockMinutes(wakeTime)
  const current = now.getHours() * 60 + now.getMinutes()
  return wake !== null && current >= wake && current < 20 * 60
}
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const center = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[center] : Math.round((sorted[center - 1] + sorted[center]) / 2)
}

/** 最近 14 个自然日的可解释摘要；模拟读数只能形成演示预览。 */
export function twoWeekSleepSummary(records: DailyObservation[], date: string, conflicts: SleepConflict[] = [], feedback: Array<{ date: string; skipped: boolean }> = []) {
  const lastDay = Date.parse(`${date}T00:00:00Z`)
  const inWindow = (value: string): boolean => { const day = Date.parse(`${value}T00:00:00Z`); return day <= lastDay && day > lastDay - 14 * 86400000 }
  const recent = usableRecords(records, conflicts).filter((record) => {
    return inWindow(record.date) && clockMinutes(record.bedTime) !== null && clockMinutes(record.wakeTime) !== null
  })
  const personalNights = recent.filter((record) => !record.simulatedFields?.includes('bedTime') && !record.simulatedFields?.includes('wakeTime'))
  const enough = recent.length >= 14
  return {
    observedNights: recent.length,
    personalNights: personalNights.length,
    reviewedMornings: new Set(feedback.filter((item) => !item.skipped && inWindow(item.date)).map((item) => item.date)).size,
    simulated: recent.length !== personalNights.length,
    usualBedTime: enough ? formatTime(median(recent.map((record) => nightMinutes(record.bedTime as string) as number))) : null,
    usualWakeTime: enough ? formatTime(median(recent.map((record) => clockMinutes(record.wakeTime) as number))) : null,
  }
}

export function sleepConflict(deviceTime: string | undefined, reportedTime: string | undefined): boolean {
  const device = deviceTime ? nightMinutes(deviceTime) : null
  const reported = reportedTime ? nightMinutes(reportedTime) : null
  // 45 分钟是演示交互阈值，不是医学判定标准。
  return device !== null && reported !== null && Math.abs(device - reported) >= 45
}

const usableRecords = (records: DailyObservation[], conflicts: SleepConflict[]) =>
  records.filter((record) => !conflicts.some((item) => item.date === record.date && item.status === '待再次核对'))

export function suggestSleepPlan(records: DailyObservation[], preferences: SleepPreferences = {}, conflicts: SleepConflict[] = []) {
  const usable = usableRecords(records, conflicts)
  const recent = usable.filter((record) => record.bedTime && clockMinutes(record.bedTime) !== null).slice(-7)
  if (recent.length < 3) return {
    target: null, nextTarget: null, baseline: null, wake: preferences.wakeConstraint ?? null,
    count: recent.length, source: '资料不足' as const,
    reason: '需要至少 3 晚入睡时间，才能提出基于近期作息的初始建议。',
    action: '先记录近期入睡与起床情况。',
  }
  const baseline = median(recent.map((record) => nightMinutes(record.bedTime as string) as number))
  const wakeRows = usable.filter((record) => record.wakeTime && clockMinutes(record.wakeTime) !== null).slice(-7)
  const wake = preferences.wakeConstraint ?? (wakeRows.length >= 3 ? formatTime(median(wakeRows.map((record) => clockMinutes(record.wakeTime) as number))) : null)
  // 以近期入睡中位数为起点；只有在已知起床约束且睡眠窗口不足时，先试探性提前 15 分钟。
  const wakeWindow = wake ? (clockMinutes(wake) as number) + 1440 - baseline : null
  const proposed = wakeWindow !== null && wakeWindow < 7 * 60 ? baseline - 15 : baseline
  const target = preferences.acceptedTarget ?? formatTime(proposed)
  const acceptedDate = preferences.acceptedAt?.slice(0, 10)
  const afterAcceptance = acceptedDate ? usable.filter((record) => record.date > acceptedDate) : []
  const acceptedMinutes = preferences.acceptedTarget ? nightMinutes(preferences.acceptedTarget) : null
  const recentAfterAcceptance = afterAcceptance.filter((record) => record.bedTime && nightMinutes(record.bedTime) !== null).slice(-7)
  const nearAccepted = acceptedMinutes === null ? 0 : recentAfterAcceptance.filter((record) => Math.abs((nightMinutes(record.bedTime as string) as number) - acceptedMinutes) <= 30).length
  const acceptedWindow = acceptedMinutes !== null && wake ? (clockMinutes(wake) as number) + 1440 - acceptedMinutes : null
  const nextTarget = recentAfterAcceptance.length >= 7 && nearAccepted >= 4 && acceptedWindow !== null && acceptedWindow < 7 * 60
    ? formatTime((acceptedMinutes as number) - 15) : null
  const barrierAction: Record<string, string> = {
    '睡前事务': '今晚先为睡前事务留出结束时间。',
    '使用手机': '今晚先选一个放下手机的提醒时间。',
    '到了时间不困': '到计划时间仍不困时，先做安静的睡前准备，不强迫自己入睡。',
  }
  const latestBarrier = [...usable].reverse().find((record) => record.sleepBarrier)?.sleepBarrier
  return {
    target, nextTarget, baseline: formatTime(baseline), wake, count: recent.length,
    source: preferences.acceptedTarget ? '已确认目标' as const : '小满建议' as const,
    reason: `参考最近 ${recent.length} 晚入睡时间的中间水平（约 ${formatTime(baseline)}）${wake ? `和 ${wake} 的起床安排` : ''}，先从可执行的时间开始。${proposed !== baseline ? '提前 15 分钟是演示阶段的渐进步幅，不是专家共识规定的数值。' : ''}`,
    action: barrierAction[latestBarrier ?? preferences.barrier ?? ''] ?? '今晚先按目标时间安排睡前准备。',
  }
}

/** 最近七晚接近已建议目标的比例；30 分钟容差是产品展示规则，不是医学阈值。 */
export function sleepPlanProgress(records: DailyObservation[], target: string | null, conflicts: SleepConflict[] = []) {
  const targetMinutes = target ? nightMinutes(target) : null
  const nights = usableRecords(records, conflicts).filter((record) => record.bedTime && nightMinutes(record.bedTime) !== null).slice(-7)
  if (targetMinutes === null || nights.length < 3) return { score: null, near: 0, count: nights.length, simulated: false }
  const near = nights.filter((record) => Math.abs((nightMinutes(record.bedTime as string) as number) - targetMinutes) <= 30).length
  return { score: Math.round(near / nights.length * 100), near, count: nights.length, simulated: nights.some((record) => record.simulatedFields?.includes('bedTime')) }
}
