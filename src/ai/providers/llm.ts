import { buildAnswerMessages, buildDailyMessages } from '../prompts'
import type { AgentProvider } from '../provider'
import type { AgentRequest } from '../types'
import type { ProviderResult } from '../provider'
import { parseDecision } from '../schema'
import { createFetchTransport, type LlmTransport } from '../transport'

/**
 * LLM provider：真实模型适配器。
 *
 * 这个实现不依赖 API key 也存在、也能被测试：
 * 它的行为完全由注入的 transport 决定，评测可以用脚本化 transport 喂它
 * **故意越界的输出**，从而验证守门层与降级路径。
 */

export interface LlmProviderConfig {
  model: string
  transport: LlmTransport
  /** 打点用：真实部署里不应把 key 放进客户端。 */
  label?: string
}

export function createLlmProvider(config: LlmProviderConfig): AgentProvider {
  return {
    id: config.label ?? 'llm',
    kind: 'llm',
    model: config.model,
    async complete(request: AgentRequest): Promise<ProviderResult> {
      const messages =
        request.kind === 'daily'
          ? buildDailyMessages(request.context, request.answers)
          : buildAnswerMessages(request.context, request.question)

      const response = await config.transport.send({
        model: config.model,
        messages,
        temperature: 0.2,
      })

      // 校验失败会抛 DecisionSchemaError → 编排层降级到规则 provider
      return {
        decision: parseDecision(response.text),
        ...(response.usage === undefined ? {} : { tokens: response.usage }),
      }
    },
  }
}

const readEnv = (key: string): string | undefined => {
  const fromVite = (import.meta as { env?: Record<string, string | undefined> }).env?.[key]
  if (typeof fromVite === 'string' && fromVite !== '') return fromVite
  const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.[key]
  return typeof nodeEnv === 'string' && nodeEnv !== '' ? nodeEnv : undefined
}

/**
 * 从环境变量构造真实 provider：
 *   LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
 * 未配置时抛错——由调用方决定是否退回 rules，而不是静默降级。
 */
export function createLlmProviderFromEnv(): AgentProvider {
  const apiKey = readEnv('LLM_API_KEY')
  const baseUrl = readEnv('LLM_BASE_URL')
  const model = readEnv('LLM_MODEL') ?? 'deepseek-chat'
  if (apiKey === undefined) {
    throw new Error(
      '未配置 LLM_API_KEY：真实模型 provider 需要 key。评测与本地演示请使用 rules provider，或用脚本化 transport 测试。',
    )
  }
  return createLlmProvider({
    model,
    transport: createFetchTransport({
      apiKey,
      ...(baseUrl === undefined ? {} : { baseUrl }),
    }),
  })
}
