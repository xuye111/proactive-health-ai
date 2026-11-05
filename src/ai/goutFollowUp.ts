import type { FollowUp, FollowUpEvent } from './followUps'
import { isGoutActivityAssessment, type GoutActivityAssessment } from './goutActivity'

export type GoutStart = { kind: 'resolved'; resolvedOn: string; note?: string } | { kind: 'scheduled'; dueOn: string }
export type GoutEvent =
  | { kind: 'plan'; dueOn: string }
  | { kind: 'visit_plan'; visitOn: string }
  | { kind: 'no_plan'; reviewOn?: string }
  | { kind: 'not_tested'; reviewOn: string; note?: string }
  | { kind: 'waiting_report'; reviewOn: string }
  | { kind: 'report'; sampledOn: string; urate: number; unit: 'µmol/L' | 'mg/dL'; source: string; confirmEarly?: boolean }
  | { kind: 'defer'; reviewOn: string }
  | { kind: 'close' }

export interface GoutData {
  phase: 'unknown_plan' | 'no_plan' | 'scheduled' | 'not_tested' | 'waiting_report' | 'received' | 'closed'
  resolvedOn?: string
  note?: string
  dueOn?: string
  visitOn?: string
  report?: { sampledOn: string; urate: number; unit: 'µmol/L' | 'mg/dL'; source: string }
  activity?: GoutActivityAssessment
}
export type GoutFollowUp = FollowUp & { gout: GoutData }

/** 从本人已确认的事项取观察起点，日期使用化验采样日和本人确认的缓解日。 */
export function goutBaseline(items: readonly GoutFollowUp[]) {
  const reports = items.flatMap(({ gout }) => gout.report ? [gout.report] : [])
    .sort((a, b) => a.sampledOn.localeCompare(b.sampledOn))
  const resolvedDates = items.flatMap(({ gout }) => gout.resolvedOn ? [gout.resolvedOn] : []).sort()

  return {
    firstReport: reports.at(0),
    latestReport: reports.at(-1),
    firstResolvedOn: resolvedDates.at(0),
    latestResolvedOn: resolvedDates.at(-1),
  }
}

const validDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value

const requireDate = (value: unknown, label: string): string => {
  if (!validDate(value)) throw new Error(`${label}必须是有效日期（YYYY-MM-DD）`)
  return value
}

const validReport = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) return false
  const report = value as Record<string, unknown>
  return validDate(report.sampledOn) && typeof report.urate === 'number' && Number.isFinite(report.urate) && report.urate > 0 &&
    (report.unit === 'µmol/L' || report.unit === 'mg/dL') && typeof report.source === 'string' && report.source.trim().length > 0
}

/** 持久化入口也使用此守卫，旧通用事项不受专病字段校验影响。 */
export function isGoutFollowUp(item: FollowUp): item is GoutFollowUp {
  const data = item.gout
  if (data === undefined || data === null || typeof data !== 'object') return false
  if (!['unknown_plan', 'no_plan', 'scheduled', 'not_tested', 'waiting_report', 'received', 'closed'].includes(data.phase)) return false
  if (data.resolvedOn !== undefined && !validDate(data.resolvedOn)) return false
  if (data.note !== undefined && typeof data.note !== 'string') return false
  if (data.dueOn !== undefined && !validDate(data.dueOn)) return false
  if (data.visitOn !== undefined && !validDate(data.visitOn)) return false
  if (data.report !== undefined && !validReport(data.report)) return false
  if (data.activity !== undefined && (!isGoutActivityAssessment(data.activity) || data.report === undefined ||
    data.activity.assessedOn < data.report.sampledOn)) return false
  if (data.phase === 'unknown_plan' && data.resolvedOn === undefined) return false
  if (['scheduled', 'not_tested', 'waiting_report', 'received'].includes(data.phase) && data.dueOn === undefined) return false
  if (data.phase === 'received' && data.report === undefined) return false
  if (data.phase !== 'received' && data.report !== undefined) return false
  return true
}

export function createGoutFollowUp(start: GoutStart, at: string): GoutFollowUp {
  const seed = start.kind === 'resolved' ? requireDate(start.resolvedOn, '缓解日期') : requireDate(start.dueOn, '复查日期')
  if (start.kind === 'resolved' && seed > requireDate(at.slice(0, 10), '记录日期')) throw new Error('缓解日期不能在未来')
  const themeKey = `gout:${start.kind}:${seed}`
  const note = start.kind === 'resolved' ? start.note?.trim() : undefined
  return {
    id: themeKey, themeKey, topic: start.kind === 'resolved' ? '痛风本次发作随访' : '痛风复查随访',
    firstDetectedAt: at, status: '待确认',
    evidence: [{ source: 'signal', capturedAt: at, label: start.kind === 'resolved' ? '用户确认本次症状缓解' : '用户确认复查安排',
      details: [seed, ...(note ? [note] : [])] }],
    events: [{ id: `detected:${at}`, kind: 'detected', at, note: start.kind === 'resolved' ? `用户确认缓解：${seed}` : `用户确认复查：${seed}` }],
    nextReviewAt: seed,
    gout: start.kind === 'resolved' ? { phase: 'unknown_plan', resolvedOn: seed, ...(note ? { note } : {}) } : { phase: 'scheduled', dueOn: seed },
  }
}

export function goutPrompt(item: GoutFollowUp, date: string): string | null {
  if (item.gout.phase === 'closed' || item.gout.phase === 'received' || item.status === '建议就医' || item.status === '已结束') return null
  if (!item.nextReviewAt || date < item.nextReviewAt) return null
  switch (item.gout.phase) {
    case 'unknown_plan': return `你在 ${item.gout.resolvedOn} 确认本次症状已缓解。医生有和你约下一次复查或复诊吗？`
    case 'no_plan': return '上次你说还没有明确的后续安排。现在有新的复查或复诊安排吗？'
    case 'scheduled': return `你确认的复查日 ${item.gout.dueOn} 已到。这次还没检查，还是已检查在等报告？`
    case 'not_tested': return `上次你说这次复查还没检查。现在完成检查了吗？`
    case 'waiting_report': return '上次你说已检查、在等报告。现在拿到这次的报告了吗？'
  }
}

export function goutSummary(item: GoutFollowUp): string {
  const data = item.gout
  const parts = [data.resolvedOn ? `本次症状于 ${data.resolvedOn} 确认缓解` : '治疗中的复查跟进']
  if (data.note) parts.push(`用户描述：${data.note}`)
  if (data.dueOn) parts.push(`用户确认的复查日：${data.dueOn}`)
  if (data.visitOn) parts.push(`用户确认的复诊日：${data.visitOn}`)
  if (data.report) parts.push(`本次关联报告：${data.report.sampledOn} 采样，血尿酸 ${data.report.urate} ${data.report.unit}，来源：${data.report.source}`)
  else parts.push(`当前进度：${({ unknown_plan: '待核对安排', no_plan: '暂无明确安排', scheduled: '待检查进度', not_tested: '尚未检查', waiting_report: '已检查待报告', received: '已收报告', closed: '已结束' })[data.phase]}`)
  return parts.join('；')
}

const addEvent = (item: GoutFollowUp, kind: FollowUpEvent['kind'], at: string, note: string): FollowUpEvent[] =>
  [...item.events, { id: `${kind}:${at}`, kind, at, note }]

export function applyGoutEvent(item: GoutFollowUp, event: GoutEvent, at: string): GoutFollowUp {
  if (!isGoutFollowUp(item)) throw new Error('痛风随访记录无效')
  const today = requireDate(at.slice(0, 10), '操作日期')
  if (item.gout.phase === 'closed' || item.gout.phase === 'received') throw new Error('本轮随访已结束，不能继续操作')
  const data = item.gout
  switch (event.kind) {
    case 'plan': {
      const dueOn = requireDate(event.dueOn, '复查日期')
      return { ...item, status: '进行中', nextReviewAt: dueOn, gout: { ...data, phase: 'scheduled', dueOn }, events: addEvent(item, 'action_set', at, `用户确认复查安排：${dueOn}`) }
    }
    case 'visit_plan': {
      if (!['unknown_plan', 'no_plan'].includes(data.phase)) throw new Error('当前事项已有复查安排，不能改为仅约复诊')
      const visitOn = requireDate(event.visitOn, '复诊日期')
      return { ...item, status: '已结束', nextReviewAt: undefined, gout: { ...data, phase: 'closed', visitOn },
        events: addEvent(item, 'closed', at, `用户确认仅约复诊：${visitOn}；本轮安排核对结束`) }
    }
    case 'no_plan': {
      if (!['unknown_plan', 'no_plan'].includes(data.phase)) throw new Error('已有复查安排，不能标为尚无安排')
      const reviewOn = event.reviewOn === undefined ? undefined : requireDate(event.reviewOn, '下次回访日期')
      if (reviewOn !== undefined && reviewOn <= today) throw new Error('下次回访日期必须晚于今天')
      return { ...item, status: '待回访', nextReviewAt: reviewOn, gout: { ...data, phase: 'no_plan' }, events: addEvent(item, 'reviewed', at, `用户确认暂无安排${reviewOn ? `；约定 ${reviewOn} 再跟进` : ''}`) }
    }
    case 'not_tested': {
      if (!data.dueOn) throw new Error('尚无复查安排，不能记录检查进度')
      const reviewOn = requireDate(event.reviewOn, '下次回访日期')
      if (reviewOn <= today) throw new Error('下次回访日期必须晚于今天')
      return { ...item, status: '待回访', nextReviewAt: reviewOn, gout: { ...data, phase: 'not_tested' },
        events: addEvent(item, 'reviewed', at, `用户确认尚未检查；${event.note?.trim() ?? '未说明原因'}；约定 ${reviewOn} 再跟进`) }
    }
    case 'waiting_report': {
      if (!data.dueOn) throw new Error('尚无复查安排，不能记录报告进度')
      const reviewOn = requireDate(event.reviewOn, '报告回访日期')
      if (reviewOn <= today) throw new Error('报告回访日期必须晚于今天')
      return { ...item, status: '待回访', nextReviewAt: reviewOn, gout: { ...data, phase: 'waiting_report' }, events: addEvent(item, 'reviewed', at, `用户确认已检查待报告；约定 ${reviewOn} 再跟进`) }
    }
    case 'report': {
      if (!data.dueOn) throw new Error('尚无复查安排，不能关联报告')
      const sampledOn = requireDate(event.sampledOn, '采样日期')
      if (sampledOn > today) throw new Error('采样日期不能在未来')
      if (data.resolvedOn && sampledOn < data.resolvedOn) throw new Error('旧报告早于本轮症状缓解记录，请核对本次复查报告')
      if (sampledOn < data.dueOn && event.confirmEarly !== true) throw new Error('报告早于约定复查日，请用户确认是否提前完成本次检查')
      if (typeof event.urate !== 'number' || !Number.isFinite(event.urate) || event.urate <= 0) throw new Error('血尿酸数值必须有效')
      if (event.unit !== 'µmol/L' && event.unit !== 'mg/dL') throw new Error('报告单位必须明确')
      if (typeof event.source !== 'string' || !event.source.trim()) throw new Error('报告来源必须明确')
      const report = { sampledOn, urate: event.urate, unit: event.unit, source: event.source.trim() }
      return { ...item, status: '已结束', nextReviewAt: undefined, gout: { ...data, phase: 'received', report },
        events: addEvent(item, 'closed', at, `用户将报告关联本次复查；采样 ${sampledOn}；血尿酸 ${report.urate} ${report.unit}；来源 ${report.source}${event.confirmEarly ? '；用户确认提前检查' : ''}`) }
    }
    case 'defer': {
      const reviewOn = requireDate(event.reviewOn, '下次回访日期')
      if (reviewOn <= today) throw new Error('下次回访日期必须晚于今天')
      return { ...item, nextReviewAt: reviewOn, events: addEvent(item, 'deferred', at, `用户选择稍后处理：${reviewOn}`) }
    }
    case 'close': return { ...item, status: '已结束', nextReviewAt: undefined, gout: { ...data, phase: 'closed' }, events: addEvent(item, 'closed', at, '用户明确结束本轮跟进') }
  }
}
