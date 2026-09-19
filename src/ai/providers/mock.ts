import type { ProviderResult } from '../provider'
import type { AgentProvider } from '../provider'
import type { AgentDecision, AgentRequest } from '../types'

/**
 * 测试与评测用的假 provider。
 *
 * 它存在的意义不是「占位」，而是**在没有 API key 的前提下验证守门层**：
 * 用 `createMockProvider(越界的决策)` 直接喂一个违规输出，
 * 断言守门层拦住了它、并降级到了安全结论。
 */

/** 直接返回预设结论（绕过 schema 校验），用于测试守门层。 */
export function createMockProvider(decisions: AgentDecision[], id = 'mock'): AgentProvider {
  let cursor = 0
  return {
    id,
    kind: 'mock',
    model: 'scripted',
    async complete(_request: AgentRequest): Promise<ProviderResult> {
      const decision = decisions[Math.min(cursor, decisions.length - 1)]
      cursor += 1
      return { decision, tokens: { prompt: 120, completion: 60 } }
    },
  }
}

/** 模拟一个「总是失败」的 provider，用于验证降级路径。 */
export function createFailingProvider(message = '模型服务不可用', id = 'llm-failing'): AgentProvider {
  return {
    id,
    kind: 'llm',
    model: 'failing-model',
    async complete(): Promise<ProviderResult> {
      throw new Error(message)
    },
  }
}

/** 模拟一个「返回非法结构化输出」的 provider，用于验证 schema 校验 + 降级。 */
export function createMalformedProvider(raw: string, id = 'llm-malformed'): AgentProvider {
  return {
    id,
    kind: 'llm',
    model: 'malformed-model',
    async complete(): Promise<ProviderResult> {
      const { parseDecision } = await import('../schema')
      return { decision: parseDecision(raw), tokens: { prompt: 100, completion: 20 } }
    },
  }
}
