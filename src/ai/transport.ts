/**
 * 传输层：把「怎么发出去」与「发什么」分开。
 *
 * 这样做的直接好处是**不需要 API key 也能测模型适配器**：
 * `createScriptedTransport()` 可以返回任意（包括故意越界的）模型输出，
 * 用来验证守门层是否真的拦得住。
 *
 * 生产注意：浏览器直连模型服务会暴露 API key，真实部署应走服务端代理（BFF），
 * 客户端只与本服务的接口通信。这里保留 transport 接缝就是为了将来替换成代理调用。
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface TokenUsage {
  prompt: number
  completion: number
}

export interface LlmResponse {
  text: string
  usage?: TokenUsage
}

export interface LlmTransport {
  send(request: LlmRequest): Promise<LlmResponse>
}

export class LlmTransportError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'LlmTransportError'
  }
}

export interface FetchTransportOptions {
  apiKey: string
  baseUrl?: string
  timeoutMs?: number
}

/** OpenAI 兼容协议的 HTTP 实现（DeepSeek / OpenAI / 兼容网关都适用）。 */
export function createFetchTransport(options: FetchTransportOptions): LlmTransport {
  const baseUrl = options.baseUrl ?? 'https://api.deepseek.com'
  const timeoutMs = options.timeoutMs ?? 20_000

  return {
    async send(request) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${options.apiKey}`,
          },
          body: JSON.stringify({
            model: request.model,
            messages: request.messages,
            temperature: request.temperature ?? 0.2,
            max_tokens: request.maxTokens ?? 800,
            response_format: { type: 'json_object' },
          }),
          signal: request.signal ?? controller.signal,
        })

        if (!response.ok) {
          throw new LlmTransportError(`模型服务返回 HTTP ${response.status}`, response.status)
        }

        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>
          usage?: { prompt_tokens?: number; completion_tokens?: number }
        }
        const text = payload.choices?.[0]?.message?.content
        if (typeof text !== 'string' || text.trim() === '') {
          throw new LlmTransportError('模型返回内容为空')
        }
        return {
          text,
          usage: {
            prompt: payload.usage?.prompt_tokens ?? 0,
            completion: payload.usage?.completion_tokens ?? 0,
          },
        }
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

/**
 * 脚本化 transport：按顺序返回预设输出，用于测试与评测。
 * 传入 Error 实例表示模拟一次传输失败（用于验证降级路径）。
 */
export function createScriptedTransport(responses: Array<string | Error>): LlmTransport {
  let cursor = 0
  return {
    async send() {
      const next = responses[Math.min(cursor, responses.length - 1)]
      cursor += 1
      if (next instanceof Error) throw next
      return { text: next, usage: { prompt: 0, completion: 0 } }
    },
  }
}
