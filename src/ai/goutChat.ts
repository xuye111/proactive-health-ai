import { goutSummary, isGoutFollowUp } from './goutFollowUp'
import type { GoutFollowUp } from './goutFollowUp'
import type { FollowUp, SafetyEscalation } from './followUps'
import { matchGoutKnowledge } from './goutKnowledge'
import { redFlagFor } from './safety'

export type GoutChatAction = { kind: 'openTasks'; itemId?: string }

const openTasks = (itemId?: string): GoutChatAction => ({ kind: 'openTasks', itemId })
const itemDate = (item: GoutFollowUp) => item.gout.dueOn ?? item.gout.resolvedOn ?? item.firstDetectedAt.slice(0, 10)
const itemLabel = (item: GoutFollowUp) => `${item.topic}（${itemDate(item)}）`
const confirmItem = (items: GoutFollowUp[]) => ({
  answer: items.length > 1
    ? `找到多轮可能相关的事项：${items.map(itemLabel).join('、')}。请打开对应事项，或说明完整日期后再问。`
    : '还不能确定你指的是哪一轮。请打开对应事项，或说明完整日期后再问。',
  evidence: ['本机痛风随访：需要确认对应事项'], escalation: false, action: openTasks(),
})

/** 日期优先于页面焦点；相对提问只在可确定对应轮次时定位。 */
function selectItem(question: string, gout: GoutFollowUp[], focusedId?: string | null): { item?: GoutFollowUp; needsConfirmation: boolean; unmatchedDate?: string } {
  const dates = [...question.matchAll(/(\d{4})[-年/.](\d{1,2})[-月/.](\d{1,2})[日号]?|(\d{1,2})月(\d{1,2})[日号]?/g)]
  if (dates.length > 1) return { needsConfirmation: true }
  const dateMatch = dates[0]
  if (dateMatch) {
    const [, year, fullMonth, fullDay, shortMonth, shortDay] = dateMatch
    const monthDay = `${(fullMonth ?? shortMonth).padStart(2, '0')}-${(fullDay ?? shortDay).padStart(2, '0')}`
    const date = year ? `${year}-${monthDay}` : monthDay
    const matches = gout.filter((item) => [item.gout.resolvedOn, item.gout.dueOn, item.gout.visitOn, item.gout.report?.sampledOn]
      .some((value) => value && (year ? value === date : value.slice(5) === date)))
    return {
      item: matches.length === 1 ? matches[0] : undefined,
      needsConfirmation: matches.length !== 1,
      unmatchedDate: matches.length === 0 ? (year ? date : dateMatch[0]) : undefined,
    }
  }
  const sorted = [...gout].sort((a, b) => itemDate(a).localeCompare(itemDate(b)) || a.id.localeCompare(b.id))
  const focus = focusedId ? gout.find((item) => item.id === focusedId) : undefined
  const relative = /上次|上一轮|下次|下一轮|下一次/.exec(question)?.[0]
  const current = /这次|本次|当前/.test(question)
  if (!focusedId && !relative && !current) return { needsConfirmation: false }
  if (focusedId && !focus) return { needsConfirmation: true }
  const active = gout.filter((item) => item.status !== '已结束' && item.status !== '建议就医')
  const anchor = focus ?? (active.length === 1 ? active[0] : undefined)
  if (relative) {
    if (!anchor) return { needsConfirmation: true }
    const neighbors = sorted.filter((item) => relative.startsWith('上') ? itemDate(item) < itemDate(anchor) : itemDate(item) > itemDate(anchor))
    const neighbor = relative.startsWith('上') ? neighbors.at(-1) : neighbors[0]
    const date = neighbor && itemDate(neighbor)
    const matches = neighbors.filter((item) => itemDate(item) === date)
    return { item: matches.length === 1 ? matches[0] : undefined, needsConfirmation: matches.length !== 1 }
  }
  if (current && !anchor) return { needsConfirmation: true }
  return { item: anchor, needsConfirmation: false }
}

export function answerGoutChat(question: string, items: FollowUp[], focusedId?: string | null): {
  answer: string; evidence: string[]; escalation: boolean; safety?: SafetyEscalation; knowledgeId?: string; action?: GoutChatAction
} {
  const flag = redFlagFor(question)
  if (flag) return {
    answer: flag.escalationText,
    evidence: flag.evidence,
    escalation: true,
    safety: { ruleId: flag.id, label: flag.label, evidence: flag.evidence, message: flag.escalationText },
  }
  const knowledge = matchGoutKnowledge(question)
  if (knowledge) {
    const { from, label, to } = knowledge.edge
    return {
      answer: knowledge.answer,
      evidence: [`${from} → ${label} → ${to}`],
      knowledgeId: knowledge.id,
      escalation: false,
    }
  }
  const unsupported = {
    answer: '这个问题缺少足够依据。我可以核对你的随访记录，或解释有来源的痛风常识。个人症状、检验结果和治疗安排请与医生确认。',
    evidence: ['暂无适用的知识条目或可回答此问题的个人记录'],
    escalation: false,
  }
  if (/(?:正常吗|算高吗|达标|是不是痛风|要不要复查|该不该复查|多久复查|何时复查|何时就医)/.test(question)) return unsupported
  const reportQuestion = /报告|检查结果|检验结果|(?:上次|这次|本次|我的|最近).*(?:结果|尿酸)/.test(question)
  const followUpQuestion = /复查|复诊|随访|进度|记录|安排/.test(question)
  const entryQuestion = /录报告|(?:录入|补录|上传|登记).*(?:报告|化验|血尿酸)|(?:报告|化验).*(?:怎么录|如何录|在哪里录)|(?:新增|新建|创建).*(?:事项|任务|随访)|记录.*(?:缓解|发作)/.test(question)
  if (!reportQuestion && !followUpQuestion && !entryQuestion) return unsupported
  const gout = items.filter(isGoutFollowUp)
  const selected = selectItem(question, gout, focusedId)
  if (selected.needsConfirmation) return selected.unmatchedDate ? {
    answer: `本机没有找到与 ${selected.unmatchedDate} 关联的痛风随访事项或报告。请核对日期，或打开对应事项后再问。`,
    evidence: ['本机痛风随访：指定日期无匹配'], escalation: false, action: openTasks(),
  } : confirmItem(gout)
  if (entryQuestion) return {
    answer: reportQuestion
      ? '打开对应的随访任务，选择「已有报告，核对录入」，然后填写报告上的采样日期、数值、单位和来源。'
      : '可以到「记录 → 随访任务」填写并确认。保存后，我会按你确认的日期和进度继续跟进。',
    evidence: [], escalation: false, action: openTasks(selected.item?.id),
  }
  if (reportQuestion) {
    const target = selected.item ?? gout.filter((item) => item.gout.report)
      .sort((a, b) => (b.gout.report?.sampledOn ?? '').localeCompare(a.gout.report?.sampledOn ?? ''))[0]
    return target?.gout.report ? {
      answer: `${selected.item ? `对应事项“${itemLabel(target)}”` : `最近一份已关联报告属于“${target.topic}”`}：${goutSummary(target)}。这里保留报告原始数值和单位，不判断是否达标；请与医生核对结果及后续安排。`,
      evidence: ['依据：你在本机确认并关联到该事项的报告'], escalation: false,
    } : {
      answer: `${selected.item ? `“${itemLabel(selected.item)}”这次报告尚未录入。` : '本机还没有关联到本次随访的报告。'}若已拿到报告，可以到随访任务核对并录入。结果解读请咨询医生。`,
      evidence: ['本机痛风随访：对应事项暂无已关联报告'], escalation: false, action: openTasks(selected.item?.id),
    }
  }
  const target = selected.item ?? [...gout].sort((a, b) => b.firstDetectedAt.localeCompare(a.firstDetectedAt))[0]
  return target ? {
    answer: `${selected.item ? `对应事项“${itemLabel(target)}”` : '最近一件随访'}：${goutSummary(target)}。可以到对应的随访任务更新进度。具体复查时间以医生安排为准。`,
    evidence: ['依据：你在本机确认的痛风随访记录'], escalation: false, action: openTasks(target.id),
  } : {
    answer: '本机还没有痛风随访事项。如果你本人已由医生确诊痛风，可以到随访任务记录本次缓解或已约复查。',
    evidence: ['本机痛风随访：暂无记录'], escalation: false, action: openTasks(),
  }
}
