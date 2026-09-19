import {
  FORBIDDEN_PATTERNS,
  MAX_ACTIONS_PER_DAY,
  MAX_ANSWER_LENGTH,
  RED_FLAG_RULES,
  SAFE_FALLBACK_ANSWER,
  checkForbidden,
} from './safety'
import type {
  AgentDecision,
  GuardrailVerdict,
  GuardrailViolation,
  HealthContext,
  OutputLevel,
} from './types'
import { OUTPUT_LEVELS } from './types'

/**
 * 守门层：与生成层分离的强制层。
 *
 * 这是整个架构里最重要的一层。**提示词是「请求」，守门是「保证」**：
 * 无论结论来自规则表还是来自某个模型，都必须先过这里才能出门。
 * 因此它不认识 provider，也不关心输出的语气，只做四件事：
 *   校验分级 → 强制急症升级 → 拦禁区表述 → 补齐依据/收敛行动数
 *
 * 任何**致命违规**（fatal）都会把结论整体替换为安全结论（fail-closed），
 * 而不是「删掉那句话」——医疗场景里，被污染的结论不能局部修补后继续使用。
 */

export const GUARDRAIL_CODES = {
  LEVEL_INVALID: 'LEVEL_INVALID',
  RED_FLAG_NOT_ESCALATED: 'RED_FLAG_NOT_ESCALATED',
  FORBIDDEN_CLAIM: 'FORBIDDEN_CLAIM',
  MISSING_EVIDENCE: 'MISSING_EVIDENCE',
  ACTION_OVERLOAD: 'ACTION_OVERLOAD',
  ANSWER_TOO_LONG: 'ANSWER_TOO_LONG',
  UNKNOWN_CITATION: 'UNKNOWN_CITATION',
  MISSING_ACTIONS: 'MISSING_ACTIONS',
} as const

/** 安全结论：所有降级路径的最终落点，保证「答不了」也是安全的。 */
export function safeDecision(context: HealthContext, reason: string): AgentDecision {
  if (context.redFlag !== undefined) {
    const rule = RED_FLAG_RULES.find((item) => item.id === context.redFlag)
    if (rule !== undefined) {
      return {
        level: 'escalation',
        answer: rule.escalationText,
        evidence: rule.evidence,
        reasoning: `守门层强制升级：${reason}`,
      }
    }
  }
  return {
    level: 'information',
    answer: SAFE_FALLBACK_ANSWER,
    evidence:
      context.signals.length > 0
        ? context.signals.flatMap((signal) => signal.evidence).slice(0, 3)
        : [`今日睡眠 ${context.recent.sleepHours} 小时`],
    reasoning: `守门层兜底：${reason}`,
  }
}

export interface GuardrailInput {
  decision: AgentDecision
  context: HealthContext
}

export function enforceGuardrails({ decision, context }: GuardrailInput): GuardrailVerdict {
  const violations: GuardrailViolation[] = []
  const notes: string[] = []
  let result: AgentDecision = { ...decision }

  // 1) 分级必须合法（模型可能返回自造的分级）
  if (!OUTPUT_LEVELS.includes(result.level as OutputLevel)) {
    violations.push({
      code: GUARDRAIL_CODES.LEVEL_INVALID,
      detail: `level「${String(result.level)}」不在四级之内`,
    })
    result = { ...result, level: 'information' }
    notes.push('分级非法，已修正为「健康知识解释」')
  }

  // 2) 急症/越界必须升级（最高优先级，致命）
  if (context.redFlag !== undefined && result.level !== 'escalation') {
    violations.push({
      code: GUARDRAIL_CODES.RED_FLAG_NOT_ESCALATED,
      detail: `命中急症/越界规则「${context.redFlag}」，但结论分级为「${result.level}」`,
    })
    return {
      passed: false,
      violations,
      repaired: true,
      decision: safeDecision(context, `命中 ${context.redFlag} 却未升级`),
      notes: [...notes, '已强制替换为升级流程文案'],
    }
  }

  // 3) 禁区表述（致命）：诊断断言、用药建议、剂量、疗效承诺、劝阻就医
  const corpus = [result.answer ?? '', ...(result.actions ?? []).map((a) => `${a.text} ${a.reason}`)].join('\n')
  const forbidden = checkForbidden(corpus)
  if (forbidden.length > 0) {
    violations.push({
      code: GUARDRAIL_CODES.FORBIDDEN_CLAIM,
      detail: forbidden.map((item) => `${item.why}（${item.pattern.source}）`).join('；'),
    })
    return {
      passed: false,
      violations,
      repaired: true,
      decision: safeDecision(context, `触碰禁区：${forbidden.map((item) => item.why).join('、')}`),
      notes: [...notes, '结论被整体替换为安全兜底，不做局部修补'],
    }
  }

  // 4) 依据不能为空（非致命：用信号里的数据事实补齐）
  if (result.evidence.length === 0) {
    const fallbackEvidence = context.signals.flatMap((signal) => signal.evidence).slice(0, 3)
    if (fallbackEvidence.length === 0) {
      violations.push({
        code: GUARDRAIL_CODES.MISSING_EVIDENCE,
        detail: '结论没有任何依据，且上下文里也没有可用的数据事实',
      })
      return {
        passed: false,
        violations,
        repaired: true,
        decision: safeDecision(context, '结论缺少依据'),
        notes: [...notes, '无依据可用，已降级'],
      }
    }
    violations.push({
      code: GUARDRAIL_CODES.MISSING_EVIDENCE,
      detail: '结论没有带依据',
    })
    result = { ...result, evidence: fallbackEvidence }
    notes.push('依据缺失，已用当日信号的数据事实补齐')
  }

  // 5) 行动超载：单日行动上限（护栏指标「过度干预率」的结构性约束）
  if (result.actions !== undefined && result.actions.length > MAX_ACTIONS_PER_DAY) {
    const kept = result.actions.slice(0, MAX_ACTIONS_PER_DAY)
    violations.push({
      code: GUARDRAIL_CODES.ACTION_OVERLOAD,
      detail: `给出 ${result.actions.length} 条行动，超过单日上限 ${MAX_ACTIONS_PER_DAY}`,
    })
    result = { ...result, actions: kept, changes: [...(result.changes ?? []), `已裁剪至 ${MAX_ACTIONS_PER_DAY} 条行动`] }
    notes.push(`行动裁剪至 ${MAX_ACTIONS_PER_DAY} 条`)
  }

  // 6) 日程类必须给出行动（非致命：回落到默认计划）
  if (context.question === undefined && (result.actions === undefined || result.actions.length === 0)) {
    violations.push({ code: GUARDRAIL_CODES.MISSING_ACTIONS, detail: '日程结论没有今日行动' })
    result = { ...result, actions: context.plan.baseActions }
    notes.push('已回落到默认计划')
  }

  // 7) 回答过长（非致命：按句截断）
  if (result.answer !== undefined && result.answer.length > MAX_ANSWER_LENGTH) {
    const cut = result.answer.slice(0, MAX_ANSWER_LENGTH)
    const lastStop = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('；'), cut.lastIndexOf('\n'))
    violations.push({
      code: GUARDRAIL_CODES.ANSWER_TOO_LONG,
      detail: `回答长度 ${result.answer.length}，超过上限 ${MAX_ANSWER_LENGTH}`,
    })
    result = { ...result, answer: lastStop > 0 ? cut.slice(0, lastStop + 1) : `${cut}…` }
    notes.push('回答已截断')
  }

  // 8) 引用必须真实存在（非致命：剥离不存在的引用）
  if (result.citations !== undefined && result.citations.length > 0) {
    const known = new Set(context.knowledge.map((entry) => entry.id))
    const unknown = result.citations.filter((id) => !known.has(id))
    if (unknown.length > 0) {
      violations.push({
        code: GUARDRAIL_CODES.UNKNOWN_CITATION,
        detail: `引用了不存在的知识条目：${unknown.join('、')}`,
      })
      result = { ...result, citations: result.citations.filter((id) => known.has(id)) }
      notes.push('已剥离不存在的知识引用')
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    repaired: notes.length > 0,
    decision: result,
    notes,
  }
}

/** 供文档与评测使用：当前登记的全部守门规则。 */
export const GUARDRAIL_RULES = [
  { code: GUARDRAIL_CODES.LEVEL_INVALID, fatal: false, label: '输出分级必须在四级之内' },
  { code: GUARDRAIL_CODES.RED_FLAG_NOT_ESCALATED, fatal: true, label: '命中急症/越界必须升级' },
  { code: GUARDRAIL_CODES.FORBIDDEN_CLAIM, fatal: true, label: '不得出现诊断/用药/剂量/疗效承诺' },
  { code: GUARDRAIL_CODES.MISSING_EVIDENCE, fatal: true, label: '结论必须带依据' },
  { code: GUARDRAIL_CODES.ACTION_OVERLOAD, fatal: false, label: `单日行动不超过 ${MAX_ACTIONS_PER_DAY} 条` },
  { code: GUARDRAIL_CODES.MISSING_ACTIONS, fatal: false, label: '日程结论必须有今日行动' },
  { code: GUARDRAIL_CODES.ANSWER_TOO_LONG, fatal: false, label: `回答不超过 ${MAX_ANSWER_LENGTH} 字` },
  { code: GUARDRAIL_CODES.UNKNOWN_CITATION, fatal: false, label: '引用必须指向存在的知识条目' },
]

export { FORBIDDEN_PATTERNS }
