import { createRulesProvider } from './providers/rules'
import type { AgentDecision, AgentRequest, TokenUsage } from './types'

/**
 * Provider 接缝。
 *
 * 这是整个 AI 层唯一与「用什么实现判断」相关的地方。规则实现、模型实现、
 * 测试用的假模型都实现同一个接口，于是：
 *   - 评测可以对两套实现跑同一批断言；
 *   - 守门层不需要知道输出从哪来；
 *   - 模型服务故障时可以回退到规则实现（降级路径）。
 */
/** provider 的返回：结论 + 可选的 token 用量（可观测性）。 */
export interface ProviderResult {
  decision: AgentDecision
  tokens?: TokenUsage
}

export interface AgentProvider {
  id: string
  kind: 'rules' | 'llm' | 'mock'
  model?: string
  complete(request: AgentRequest): Promise<ProviderResult>
}

/** 单次调用的硬超时：超过即视为 provider 失败，走降级。 */
export const PROVIDER_TIMEOUT_MS = 8000

export class ProviderTimeoutError extends Error {
  constructor(providerId: string, ms: number) {
    super(`provider "${providerId}" 超时（>${ms}ms）`)
    this.name = 'ProviderTimeoutError'
  }
}

/** 给 provider 调用套一层超时，超时抛错交给编排层降级。 */
export async function withTimeout<T>(
  providerId: string,
  promise: Promise<T>,
  ms: number = PROVIDER_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ProviderTimeoutError(providerId, ms)), ms)
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

export interface ProviderConfig {
  /** provider id：rules / llm / mock。默认 rules。 */
  id?: string
  /** 已构造好的实例（测试与评测直接注入）。 */
  instance?: AgentProvider
}

/**
 * 配置驱动的 provider 解析。
 * 默认返回规则实现：离线可跑、可复现，也是评测的基线。
 */
export async function resolveProvider(config: ProviderConfig = {}): Promise<AgentProvider> {
  if (config.instance !== undefined) return config.instance
  const id = config.id ?? 'rules'
  // 规则实现是默认 provider，也是降级路径的兜底：静态引入，不进独立 chunk
  if (id === 'rules') return createRulesProvider()
  if (id === 'llm') {
    const { createLlmProviderFromEnv } = await import('./providers/llm')
    return createLlmProviderFromEnv()
  }
  throw new Error(`未知的 provider id：「${id}」（可选：rules / llm）`)
}
