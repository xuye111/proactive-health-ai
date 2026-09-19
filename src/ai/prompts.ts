import type { HealthContext } from './types'
import type { ChatMessage } from './transport'
import { MAX_ACTIONS_PER_DAY } from './safety'

/**
 * 提示词模板（版本化）。
 *
 * 注意架构意图：**提示词里写的是「请求」，不是「保证」**。
 * 边界最终由守门层强制（guardrails.ts），所以这里的措辞可以随效果调整，
 * 而不会影响安全性——两者是不同性质的机制。
 */

export const PROMPT_VERSION = 'v1-2026-09-19'

export const SYSTEM_PROMPT = `你是「小满」，一个主动健康管理助手。你面对的是同一个用户的长期数据与健康档案。

输出要求（必须严格遵守）：
1. 只做三件事：健康生活方式建议、健康知识解释、建议进一步医疗咨询。
2. 禁止：疾病诊断、开具处方、给出药物名称或剂量、治疗决策、替代急症判断、个体风险评分。
3. 出现胸部症状、呼吸困难、神经症状、出血、自伤念头、用药问题、持续两周以上的睡眠问题时，停止给建议，直接建议就医。
4. 每条结论必须带依据（data 或 knowledge 里的原文），不得凭空断言。
5. 最多给 ${MAX_ACTIONS_PER_DAY} 条今日行动，宁可少而可执行。

只输出 JSON，不要任何解释性文字或 Markdown 代码块。`

const SCHEMA_HINT = `{
  "level": "lifestyle | information | alert | escalation",
  "answer": "面向用户的正文",
  "actions": [{ "id": "英文短 id", "text": "可执行的一条行动", "reason": "依据" }],
  "changes": ["相对默认计划的变更说明"],
  "understanding": ["更新后的理解标签"],
  "evidence": ["依据字符串"],
  "memoryNotes": ["值得写入长期记忆的事实"],
  "citations": ["引用的知识条目 id"],
  "reasoning": "判断理由（不给用户看）"
}`

const contextPayload = (context: HealthContext, extra: Record<string, unknown>): string =>
  JSON.stringify(
    {
      date: context.date,
      profile: context.profile,
      baseline: context.baseline,
      recent: context.recent,
      trend: context.trend,
      signals: context.signals,
      recalledMemories: context.memories,
      knowledge: context.knowledge,
      plan: context.plan,
      ...extra,
    },
    null,
    1,
  )

/** 日程类：判断 + 今日行动。 */
export function buildDailyMessages(context: HealthContext, answers: string[]): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `以下是结构化上下文（由 Context Builder 组装，signal 已经过阈值判定）：\n${contextPayload(context, { followUpAnswers: answers })}\n\n请给出今天的判断与今日行动。followUpAnswers 为用户对追问的反馈，若为空则保持默认计划。\n输出 schema：\n${SCHEMA_HINT}`,
    },
  ]
}

/** 问答类：用户主动提问。 */
export function buildAnswerMessages(context: HealthContext, question: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `结构化上下文：\n${contextPayload(context, {})}\n\n用户提问：${question}\n\n请基于同一份上下文回答，并在 citations 里给出引用的知识条目 id。\n输出 schema：\n${SCHEMA_HINT}`,
    },
  ]
}
