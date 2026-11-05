import type { Signal } from './types'
import type { GoutData } from './goutFollowUp'

/** 用户端持续事项：只保存已发生的信号、用户反馈和安全层升级结果，不自行做医疗判断。 */
export type FollowUpStatus = '待确认' | '进行中' | '待回访' | '已结束' | '建议就医'
export type FollowUpEventKind =
  | 'detected'
  | 'evidence_updated'
  | 'confirmed'
  | 'deferred'
  | 'action_set'
  | 'action_outcome'
  | 'follow_up_due'
  | 'reviewed'
  | 'closed'
  | 'escalated'

export interface FollowUpEvidence {
  source: 'signal' | 'safety'
  capturedAt: string
  label: string
  details: string[]
  rule?: string
  severity?: Signal['severity']
}

export interface FollowUpEvent {
  id: string
  kind: FollowUpEventKind
  at: string
  note?: string
}

export interface FollowUpAction {
  text: string
  setAt: string
  outcome?: '完成' | '未完成' | '不适用'
  outcomeReason?: string
}

export interface FollowUp {
  /** 稳定主题键也是同一主题的事项 id，供跨次信号合并。 */
  id: string
  themeKey: string
  topic: string
  firstDetectedAt: string
  status: FollowUpStatus
  evidence: FollowUpEvidence[]
  events: FollowUpEvent[]
  action?: FollowUpAction
  nextReviewAt?: string
  gout?: GoutData
}

export interface SafetyEscalation {
  ruleId: string
  label: string
  evidence: string[]
  message?: string
}

export interface FollowUpReminder {
  item: FollowUp
  kind: 'follow_up_due' | 'safety_escalation'
  priority: 'normal' | 'safety'
}

const active = (item: FollowUp): boolean => item.status !== '已结束' && item.status !== '建议就医'
const event = (kind: FollowUpEventKind, at: string, note?: string): FollowUpEvent => ({
  id: `${kind}:${at}`,
  kind,
  at,
  ...(note === undefined ? {} : { note }),
})

/** 信号类型是唯一的主题来源，避免用显示文案或数值造成重复事项。 */
export const followUpThemeKey = (signal: Pick<Signal, 'type'>): string => `signal:${signal.type}`

const signalEvidence = (signal: Signal, capturedAt: string): FollowUpEvidence => ({
  source: 'signal', capturedAt, label: signal.label, details: [...signal.evidence], rule: signal.rule, severity: signal.severity,
})

const sameEvidence = (left: FollowUpEvidence, right: FollowUpEvidence): boolean =>
  left.capturedAt.slice(0, 10) === right.capturedAt.slice(0, 10) &&
  left.source === right.source && left.label === right.label && left.rule === right.rule &&
  left.severity === right.severity && left.details.length === right.details.length &&
  left.details.every((detail, index) => detail === right.details[index])

export function createFollowUpFromSignal(signal: Signal, at: string): FollowUp {
  const themeKey = followUpThemeKey(signal)
  return {
    id: `follow-up:${themeKey}:${at}`,
    themeKey,
    topic: signal.label,
    firstDetectedAt: at,
    status: '待确认',
    evidence: [signalEvidence(signal, at)],
    events: [event('detected', at)],
  }
}

/** 合并同一未结束主题的新证据；相同证据不会更新事项或重复写入事件。 */
export function upsertFollowUpFromSignal(items: FollowUp[], signal: Signal, at: string): { items: FollowUp[]; changed: boolean } {
  const themeKey = followUpThemeKey(signal)
  const index = items.findIndex((item) => item.themeKey === themeKey && active(item))
  if (index < 0) {
    const latest = items.filter((item) => item.themeKey === themeKey).at(-1)
    const lastEvent = latest?.events.at(-1)
    if (lastEvent && ['closed', 'escalated'].includes(lastEvent.kind) && lastEvent.at.slice(0, 10) === at.slice(0, 10))
      return { items, changed: false }
    return { items: [...items, createFollowUpFromSignal(signal, at)], changed: true }
  }

  const nextEvidence = signalEvidence(signal, at)
  const current = items[index]
  if (current.evidence.some((item) => sameEvidence(item, nextEvidence))) return { items, changed: false }
  const updated: FollowUp = {
    ...current,
    topic: signal.label,
    evidence: [...current.evidence, nextEvidence],
    events: [...current.events, event('evidence_updated', at)],
  }
  return { items: items.map((item, itemIndex) => itemIndex === index ? updated : item), changed: true }
}

export const confirmFollowUp = (item: FollowUp, at: string): FollowUp => ({
  ...item, status: item.status === '待确认' ? '进行中' : item.status,
  events: item.status === '待确认' ? [...item.events, event('confirmed', at)] : item.events,
})

/** 稍后处理保留事项和到期日，提醒端据此避免在到期前重复打扰。 */
export const deferFollowUp = (item: FollowUp, reviewDate: string, at: string): FollowUp => ({
  ...item,
  nextReviewAt: reviewDate,
  events: [...item.events, event('deferred', at, reviewDate)],
})

export const setFollowUpAction = (item: FollowUp, text: string, at: string, reviewDate?: string): FollowUp => ({
  ...item,
  status: '进行中',
  action: { text, setAt: at },
  ...(reviewDate === undefined ? {} : { nextReviewAt: reviewDate }),
  events: [...item.events, event('action_set', at, text)],
})

export const recordFollowUpActionOutcome = (
  item: FollowUp,
  outcome: FollowUpAction['outcome'],
  reason: string | undefined,
  at: string,
  reviewDate: string,
): FollowUp => ({
  ...item,
  status: '待回访',
  nextReviewAt: reviewDate,
  ...(item.action === undefined ? {} : { action: { ...item.action, outcome, ...(reason === undefined ? {} : { outcomeReason: reason }) } }),
  events: [...item.events, event('action_outcome', at, reason ?? outcome)],
})

export const markFollowUpDue = (item: FollowUp, at: string): FollowUp => ({
  ...item,
  events: item.events.some((itemEvent) => itemEvent.kind === 'follow_up_due' && itemEvent.at.slice(0, 10) === at.slice(0, 10))
    ? item.events
    : [...item.events, event('follow_up_due', at)],
})

export const closeFollowUp = (item: FollowUp, reason: string, at: string): FollowUp => ({
  ...item, status: '已结束', nextReviewAt: undefined,
  events: [...item.events, event('closed', at, reason)],
})

/** 只接收已由 safety.ts 命中的结果；这里不复制任何红旗词或阈值。 */
export const escalateFollowUp = (item: FollowUp, safety: SafetyEscalation, at: string): FollowUp => ({
  ...item,
  status: '建议就医',
  evidence: [...item.evidence, { source: 'safety', capturedAt: at, label: safety.label, details: [...safety.evidence], rule: safety.ruleId }],
  events: [...item.events, event('escalated', at, safety.ruleId)],
})

/** 安全层命中时直接生成最高优先级事项，同一规则只保留一项。 */
export function upsertSafetyFollowUp(items: FollowUp[], safety: SafetyEscalation, at: string): { items: FollowUp[]; changed: boolean } {
  const themeKey = `safety:${safety.ruleId}`
  if (items.some((item) => item.themeKey === themeKey)) return { items, changed: false }
  const item: FollowUp = {
    id: `follow-up:${themeKey}`,
    themeKey,
    topic: safety.label,
    firstDetectedAt: at,
    status: '建议就医',
    evidence: [{ source: 'safety', capturedAt: at, label: safety.label, details: [...(safety.message ? [safety.message] : []), ...safety.evidence], rule: safety.ruleId }],
    events: [event('escalated', at, safety.ruleId)],
  }
  return { items: [...items, item], changed: true }
}

/** 安静时段只压制普通事项；安全层升级始终作为最高优先级返回。 */
export function remindersFor(items: FollowUp[], onDate: string, quietHours: boolean): FollowUpReminder[] {
  return items.flatMap((item): FollowUpReminder[] => {
    if (item.status === '建议就医') return [{ item, kind: 'safety_escalation', priority: 'safety' }]
    if (!active(item) || quietHours || item.nextReviewAt === undefined || item.nextReviewAt > onDate) return []
    return [{ item, kind: 'follow_up_due', priority: 'normal' }]
  }).sort((left, right) => left.priority === right.priority ? 0 : left.priority === 'safety' ? -1 : 1)
}

/** 回访只比较后续记录里是否仍出现同主题信号；不把变化归因于某项行动。 */
export function assessFollowUp(item: FollowUp, signals: Signal[], hasLaterRecord: boolean): {
  kind: 'missing_new_record' | 'still_present' | 'not_seen_in_new_record'
  text: string
} {
  if (!hasLaterRecord) return { kind: 'missing_new_record', text: '还没有行动后的新记录，先补录再回访。' }
  if (signals.some((signal) => followUpThemeKey(signal) === item.themeKey))
    return { kind: 'still_present', text: '新记录中仍可见同类变化，建议继续观察；若有明显不适请咨询专业人员。' }
  return { kind: 'not_seen_in_new_record', text: '新记录暂未再出现同类变化，可由你决定结束或继续观察；不能据此证明行动有效。' }
}
