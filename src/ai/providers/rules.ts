import type { TodayAction } from '../../types'
import { redFlagFor } from '../safety'
import type { ProviderResult } from '../provider'
import type { AgentProvider } from '../provider'
import type { AgentDecision, AgentRequest, HealthContext } from '../types'

/**
 * 规则 provider：默认实现，离线可跑、完全可复现。
 *
 * 它承担两个角色：
 *   1. 第一阶段的判断实现（评测的基线）；
 *   2. **降级路径的兜底**——模型超时、报错或结构化校验失败时，编排层回退到这里。
 * 所以它的输出必须永远安全、永远有依据。
 */

interface FollowUpOutcome {
  chip: string
  memory: string
  lead: string
  action?: TodayAction
  replaces?: string
}

const FOLLOW_UP_OUTCOMES: Record<string, FollowUpOutcome> = {
  'difficulty-falling-asleep': {
    chip: '入睡困难',
    memory: '入睡困难与晚间咖啡因、睡前屏幕使用相关',
    lead: '你把入睡困难点了出来。相对睡眠时长，入睡时点更值得先调。',
    action: {
      id: 'act-sleep-hygiene',
      text: '睡前 1 小时不喝咖啡、放下手机',
      reason: '你反馈最近入睡困难',
    },
  },
  'night-waking': {
    chip: '夜间醒来',
    memory: '存在夜间醒来，需要观察睡眠连续性',
    lead: '夜间醒来会打断睡眠连续性，先固定起床时间比强行早睡更有效。',
    action: {
      id: 'act-wake-routine',
      text: '固定起床时间，白天补觉不超过 20 分钟',
      reason: '你反馈夜间会醒来',
    },
  },
  'late-work': {
    chip: '晚间工作结束较晚',
    memory: '最近睡眠不足与工作日晚间加班相关',
    lead: '最近几次睡眠不足都出现在工作日晚间加班之后。今天不再只建议「早点睡」，而是先提前安排工作结束的时间。',
    action: {
      id: 'act-sleep-work',
      text: '提前安排今晚工作结束时间',
      reason: '你反馈最近工作较晚',
    },
    replaces: 'act-sleep',
  },
  stress: {
    chip: '压力与情绪同期',
    memory: '近期压力偏高，与睡眠下降同期出现',
    lead: '压力和睡眠下降是同期出现的，先把睡前那一段放松下来。',
    action: {
      id: 'act-stress',
      text: '睡前 10 分钟呼吸放松',
      reason: '你反馈近期情绪压力较大',
    },
  },
  'no-obvious': {
    chip: '无主观不适',
    memory: '未报告主观不适，按生活节律变化继续观察',
    lead: '你没有感觉到明显不适，那更可能是生活节律的变化，先按观察处理，不额外加任务。',
  },
}

interface Intent {
  id: string
  keywords: string[]
  build: (context: HealthContext) => AgentDecision
}

const pct = (value: number): string => `${Math.round(value)}%`

const INTENTS: Intent[] = [
  {
    id: 'hrv-boundary',
    keywords: ['心率变异性', 'HRV', 'hrv'],
    build: () => ({
      level: 'information',
      answer: '心率变异性不在当前覆盖的指标范围内，单凭这次读数不能在这里判断是否正常。请带着测量记录咨询医生。',
      evidence: ['能力边界：当前没有心率变异性的个人基线和经过医学复核的解释规则'],
      reasoning: '指标术语优先匹配，避免被「心率」误路由到血压解释。',
    }),
  },
  {
    id: 'pressure',
    keywords: ['血压', '高血压', '心率'],
    build: (context) => ({
      level: 'information',
      answer: `先说边界：这是健康知识解释，不是对你个人的判断。一般规律是，长期睡眠不足与血压升高相关，但偶尔一两晚睡不好不会直接造成高血压。你的档案里记着${context.profile.riskNotes[0]?.replace('家族史：', '') ?? '相关家族史'}，所以这一项值得长期关注。如果你测到血压多次偏高，建议带着记录去看医生评估——这不在本产品的能力范围内。`,
      evidence: [
        context.profile.riskNotes[0] ?? '档案：无相关家族史',
        `近 3 日睡眠均值 ${context.trend.last3dAverage} 小时`,
        `今日主观压力 ${context.recent.stress}/5`,
      ],
      citations: ['sleep', 'stress'],
      reasoning: '涉及血压与心血管风险，按知识解释处理并给就医路径，不给个体结论。',
    }),
  },
  {
    id: 'exercise',
    keywords: ['运动', '跑步', '走路', '锻炼', '健身', '步'],
    build: (context) => ({
      level: 'lifestyle',
      answer: `今天可以动，但适合低强度：步数 ${context.recent.steps.toLocaleString('en-US')}、活动 ${context.recent.activeMinutes} 分钟，比过去 7 日均值低 ${pct(context.trend.stepDeclinePct)}，说明今天的活动量本来就欠着。把「午饭后步行 20 分钟」做完就够了，不要加高强度训练——昨晚只睡了 ${context.recent.sleepHours} 小时，睡眠不足当天加量，恢复会更慢。`,
      evidence: [
        `今日步数 ${context.recent.steps.toLocaleString('en-US')}`,
        `活动 ${context.recent.activeMinutes} 分钟`,
        `睡眠 ${context.recent.sleepHours} 小时`,
      ],
      citations: ['exercise', 'sleep'],
      reasoning: '活动量下降但主诉是睡眠不足，按低强度处理并引用当日数据。',
    }),
  },
  {
    id: 'dinner',
    // 不用裸「吃」：过宽的关键词会把「我该吃什么药」这类问题抢过来（评测集 C-02）
    keywords: ['晚饭', '晚餐', '饮食', '三餐', '咖啡', '喝水'],
    build: (context) => ({
      level: 'lifestyle',
      answer: `正常吃，重点不在吃什么而在咖啡因：今天已经 ${context.recent.caffeineCups} 杯，16:00 之后不要再喝。你的本周目标里有「减少晚间咖啡因」，而入睡时间 ${context.recent.bedTime} 也偏晚。饮水目前 ${context.recent.waterMl.toLocaleString('en-US')} ml，晚上可以再补一些。`,
      evidence: [
        `咖啡因 ${context.recent.caffeineCups} 杯`,
        `饮水 ${context.recent.waterMl.toLocaleString('en-US')} ml`,
        `入睡 ${context.recent.bedTime}`,
      ],
      citations: ['nutrition', 'sleep'],
      reasoning: '饮食问题里真正影响睡眠的是咖啡因，落到可执行项。',
    }),
  },
  {
    id: 'tired',
    keywords: ['累', '疲劳', '困', '没精神', '乏力', '精力'],
    build: (context) => ({
      level: 'information',
      answer: `从今天记录看：睡眠 ${context.recent.sleepHours} 小时（个人基线 ${context.baseline.sleepHours.toFixed(1)} 小时）、主观精力 ${context.recent.energy}/5、压力 ${context.recent.stress}/5。这几项同时偏低时，疲劳通常来自睡眠不足与压力叠加，而不是单一原因。先按这两天的行动调整观察一周；如果两周以上没有改善，建议找医生评估，不要一直自行调整。`,
      evidence: [
        `睡眠 ${context.recent.sleepHours} 小时`,
        `主观精力 ${context.recent.energy}/5`,
        `主观压力 ${context.recent.stress}/5`,
      ],
      citations: ['sleep', 'stress'],
      reasoning: '疲劳是多因素叠加，给解释与就医阈值，不给结论。',
    }),
  },
  {
    id: 'night-waking',
    keywords: ['半夜醒', '夜里醒', '夜间醒', '凌晨醒'],
    build: (context) => ({
      level: 'lifestyle',
      answer: `${FOLLOW_UP_OUTCOMES['night-waking'].lead}今天先试着固定起床时间，并记录夜间醒来的情况。`,
      evidence: [`今日睡眠 ${context.recent.sleepHours} 小时`, `个人基线 ${context.baseline.sleepHours.toFixed(1)} 小时`],
      citations: ['sleep'],
      reasoning: '夜间醒来优先复用追问反馈的行动建议。',
    }),
  },
  {
    id: 'sleep',
    keywords: ['睡', '失眠', '入睡'],
    build: (context) => ({
      level: 'lifestyle',
      answer: `先把入睡时点固定下来，比强行延长睡眠更有效：你最近几天入睡时间已经推到 ${context.recent.bedTime}，睡眠时长同步下降。今天先做到两件事——16:00 后不摄入咖啡因，睡前 1 小时放下手机。`,
      evidence: [
        `今日入睡 ${context.recent.bedTime}`,
        `睡眠 ${context.recent.sleepHours} 小时`,
        `基线 ${context.baseline.sleepHours.toFixed(1)} 小时`,
      ],
      citations: ['sleep'],
      reasoning: '入睡时点持续推迟，优先调节律而非延长时长。',
    }),
  },
]

/** 日程分支：把反馈映射为「理解标签 + 行动变更 + 记忆」。 */
function decideDaily(context: HealthContext, answers: string[]): AgentDecision {
  const baseActions = context.plan.baseActions
  const actions = [...baseActions]
  const understanding = context.signals.slice(0, 3).map((signal) => signal.label)
  const memoryNotes: string[] = []
  const changes: string[] = []
  const leads: string[] = []

  for (const id of answers) {
    const outcome = FOLLOW_UP_OUTCOMES[id]
    if (outcome === undefined) continue
    if (!understanding.includes(outcome.chip)) understanding.push(outcome.chip)
    memoryNotes.push(outcome.memory)
    leads.push(outcome.lead)
    if (outcome.action === undefined) continue

    const replaceAt =
      outcome.replaces === undefined
        ? -1
        : actions.findIndex((action) => action.id === outcome.replaces)
    if (replaceAt >= 0) {
      changes.push(`行动调整：${actions[replaceAt].text} → ${outcome.action.text}`)
      actions[replaceAt] = outcome.action
    } else if (!actions.some((action) => action.id === outcome.action?.id)) {
      changes.push(`新增行动：${outcome.action.text}`)
      actions.push(outcome.action)
    }
  }

  const answered = answers.length > 0
  const answer = answered
    ? `${leads.join('')}已按你的反馈更新今日行动（${actions.length} 条）。`
    : ''

  return {
    level: 'lifestyle',
    actions,
    changes,
    answer,
    understanding: understanding.slice(0, 6),
    memoryNotes,
    evidence: context.signals.flatMap((signal) => signal.evidence).slice(0, 4),
    reasoning: answered
      ? `反馈命中 ${answers.length} 条规则：${answers.join('、')}`
      : '未提交反馈，保持默认计划',
  }
}

/** 问答分支：先查急症/越界（与守门层共用 safety 模块），再走意图表。 */
function decideAnswer(context: HealthContext, question: string): AgentDecision {
  const flag = redFlagFor(question)
  if (flag !== undefined) {
    return {
      level: 'escalation',
      answer: flag.escalationText,
      evidence: flag.evidence,
      reasoning: `命中急症/越界规则「${flag.id}」，停止普通建议`,
    }
  }

  const intent = INTENTS.find((item) =>
    item.keywords.some((keyword) => question.includes(keyword)) ||
    (item.id === 'night-waking' && /(半夜|夜里|夜间|凌晨).{0,8}醒/.test(question)),
  )
  if (intent !== undefined) {
    return { ...intent.build(context), reasoning: intent.build(context).reasoning }
  }

  return {
    level: 'information',
    answer:
      '这条我用规则表答不了。当前的判断是规则实现（非 LLM），只能回答与你的睡眠、活动、饮食、压力相关的问题，接入 LLM 之后才能回答任意问题。可以点下面的快捷提问试试。',
    evidence:
      context.signals.length > 0
        ? context.signals.flatMap((signal) => signal.evidence).slice(0, 4)
        : [`今日睡眠 ${context.recent.sleepHours} 小时`],
    reasoning: '未命中任何意图，给出能力边界说明而不是编造答案',
  }
}

export function createRulesProvider(): AgentProvider {
  return {
    id: 'rules',
    kind: 'rules',
    async complete(request: AgentRequest): Promise<ProviderResult> {
      const decision =
        request.kind === 'daily'
          ? decideDaily(request.context, request.answers)
          : decideAnswer(request.context, request.question)
      // 规则实现没有 token 概念，显式返回 0，让 Trace 的字段形状保持一致
      return { decision, tokens: { prompt: 0, completion: 0 } }
    },
  }
}
