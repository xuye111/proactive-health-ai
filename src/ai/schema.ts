import { OUTPUT_LEVELS } from './types'
import type { AgentDecision, OutputLevel, TodayAction } from './types'

/**
 * 结构化输出校验（方案 §14：AI 输出尽量采用结构化 JSON，让前端直接消费）。
 *
 * 校验失败一律**抛出**，由编排层回退到规则 provider——
 * 宁可降级到确定的安全实现，也不能把一段不受约束的自然语言丢进 UI。
 */

export class DecisionSchemaError extends Error {
  constructor(message: string, readonly raw: string) {
    super(message)
    this.name = 'DecisionSchemaError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** 去掉模型习惯性添加的 Markdown 代码块围栏。 */
function stripFences(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('```')) return trimmed
  return trimmed
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/```$/, '')
    .trim()
}

const stringArray = (value: unknown): string[] | undefined => {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is string => typeof item === 'string')
}

const parseActions = (value: unknown): TodayAction[] | undefined => {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return undefined
  return value.flatMap((item, index): TodayAction[] => {
    if (!isRecord(item)) return []
    const text = item.text
    if (typeof text !== 'string' || text.trim() === '') return []
    return [
      {
        id: typeof item.id === 'string' && item.id !== '' ? item.id : `llm-action-${index + 1}`,
        text,
        reason: typeof item.reason === 'string' ? item.reason : '模型未给出依据',
      },
    ]
  })
}

/** 解析并校验模型输出；任何不符合契约的地方都抛 DecisionSchemaError。 */
export function parseDecision(raw: string): AgentDecision {
  const cleaned = stripFences(raw)

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new DecisionSchemaError('输出不是合法 JSON', cleaned.slice(0, 200))
  }

  if (!isRecord(parsed)) throw new DecisionSchemaError('输出不是 JSON 对象', cleaned.slice(0, 200))

  const level = parsed.level
  if (typeof level !== 'string' || !OUTPUT_LEVELS.includes(level as OutputLevel)) {
    throw new DecisionSchemaError(
      `level 必须是 ${OUTPUT_LEVELS.join(' / ')} 之一，实际为 ${String(level)}`,
      cleaned.slice(0, 200),
    )
  }

  const answer = parsed.answer
  if (answer !== undefined && typeof answer !== 'string') {
    throw new DecisionSchemaError('answer 必须是字符串', cleaned.slice(0, 200))
  }

  const evidence = stringArray(parsed.evidence)
  if (evidence === undefined) {
    // 依据缺失是医疗场景的硬错误：不接受「模型没写依据」的输出
    throw new DecisionSchemaError('evidence 必须是字符串数组（可为空数组，但不能缺失）', cleaned.slice(0, 200))
  }

  return {
    level: level as OutputLevel,
    ...(answer === undefined ? {} : { answer }),
    ...(parseActions(parsed.actions) === undefined ? {} : { actions: parseActions(parsed.actions) }),
    ...(stringArray(parsed.changes) === undefined ? {} : { changes: stringArray(parsed.changes) }),
    ...(stringArray(parsed.understanding) === undefined
      ? {}
      : { understanding: stringArray(parsed.understanding) }),
    evidence,
    ...(stringArray(parsed.memoryNotes) === undefined ? {} : { memoryNotes: stringArray(parsed.memoryNotes) }),
    ...(stringArray(parsed.citations) === undefined ? {} : { citations: stringArray(parsed.citations) }),
    ...(typeof parsed.reasoning === 'string' ? { reasoning: parsed.reasoning } : {}),
  }
}
