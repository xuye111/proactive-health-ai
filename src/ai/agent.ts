import type { MemoryEntry } from '../lib/memory'
import { assembleContext } from './context'
import { enforceGuardrails } from './guardrails'
import { recallMemories } from './memory-recall'
import { resolveProvider, withTimeout, type AgentProvider } from './provider'
import { createRulesProvider } from './providers/rules'
import { computeBaseline, detectSignals } from './signals'
import type { AgentDecision, AgentRequest, AgentRun, AgentTrace, TraceStage } from './types'
import { AI_LAYER_VERSION } from './version'

/**
 * 编排层：Health Daily Agent Workflow（方案 §11）。
 *
 *  1 读取档案  2 读取数据  3 计算个人基线  4 识别结构化信号  5 召回长期记忆
 *  6 构建 Context  7 交给 Provider  8 安全守门  9 产出行动  10 输出 Trace  11 写记忆（由调用方）
 *
 * 三个关键设计：
 *  - provider 失败 → **降级到规则实现**，而不是答不出来（医疗产品不能因服务抖动失能）；
 *  - 输出永远先过守门层，守门层不认识 provider；
 *  - 每一步都记进 Trace，既是可观测性，也是「为什么给这条建议」的产品能力。
 */

export interface AgentInput {
  subjective: { energy: number; stress: number; mood: number }
  memories: MemoryEntry[]
  /** 日程类：用户对追问的反馈选项。 */
  answers?: string[]
  /** 问答类：用户问题原文。 */
  question?: string
  /** 本次提问之前、按时间顺序排列的问题；只用于省略式追问。 */
  previousQuestions?: string[]
}

export interface RunAgentOptions {
  /** 直接注入 provider（测试与评测用）。 */
  provider?: AgentProvider
  /** 或按 id 解析：rules / llm。 */
  providerId?: string
  timeoutMs?: number
}

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

const ms = (start: number): number => Math.round((now() - start) * 10) / 10

const stage = (id: string, label: string, started: number, detail?: string): TraceStage => ({
  id,
  label,
  ms: ms(started),
  ...(detail === undefined ? {} : { detail }),
})

const errorMessage = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error)

function makeRunId(): string {
  const random = globalThis.crypto?.randomUUID?.()
  return random ?? `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export async function runAgent(input: AgentInput, options: RunAgentOptions = {}): Promise<AgentRun> {
  const startedAt = now()
  const stages: TraceStage[] = []
  const kind: AgentRequest['kind'] = input.question === undefined ? 'daily' : 'answer'
  const previousQuestion = input.previousQuestions?.at(-1)?.trim()
  const question = input.question === undefined
    ? undefined
    : /^(?:(?:那|那么|所以)(?:今天|现在)?)?还?(?:可以|行|能)(?:吗|么|呢|？|\?)?$/.test(input.question.trim()) && previousQuestion
      ? `${previousQuestion}；${input.question}`
      : input.question

  // 3) 个人基线
  let mark = now()
  const baseline = computeBaseline()
  stages.push(stage('baseline', '计算个人基线', mark, `${baseline.sampleDays} 天样本`))

  // 4) 结构化信号（方案 §12）
  mark = now()
  const signals = detectSignals(input.subjective, baseline)
  stages.push(
    stage('signals', '识别结构化信号', mark, signals.length === 0 ? '无' : signals.map((s) => s.label).join('、')),
  )

  // 5) 记忆召回
  mark = now()
  const recalled = recallMemories(input.memories, {
    signals,
    ...(question === undefined ? {} : { question }),
  })
  stages.push(stage('recall', '召回长期记忆', mark, `${recalled.length} 条`))

  // 6) 构建结构化 Context（方案 §13）
  mark = now()
  const context = assembleContext({
    subjective: input.subjective,
    signals,
    recalled,
    ...(question === undefined ? {} : { question }),
  })
  stages.push(
    stage('context', '构建结构化上下文', mark, `${context.knowledge.length} 个知识条目可引用`),
  )

  const request: AgentRequest =
    input.question === undefined
      ? { kind: 'daily', context, answers: input.answers ?? [] }
      : { kind: 'answer', context, question: question ?? input.question }

  // 7) Provider
  const provider = options.provider ?? (await resolveProvider({ id: options.providerId }))
  mark = now()
  let decision: AgentDecision
  let tokens: AgentTrace['tokens'] = null
  let fallbackFrom: string | undefined

  try {
    const result = await withTimeout(provider.id, provider.complete(request), options.timeoutMs)
    decision = result.decision
    tokens = result.tokens ?? null
    stages.push(
      stage(
        'provider',
        `调用 provider「${provider.id}」`,
        mark,
        provider.model === undefined ? undefined : `model: ${provider.model}`,
      ),
    )
  } catch (error) {
    // 降级路径：模型超时 / 报错 / 结构化校验失败 → 回退到规则实现
    fallbackFrom = provider.id
    const rules = createRulesProvider()
    const result = await rules.complete(request)
    decision = result.decision
    tokens = result.tokens ?? null
    stages.push(
      stage('fallback', `provider「${provider.id}」失败，降级到规则实现`, mark, errorMessage(error)),
    )
  }

  // 8) 安全守门（与生成层分离的强制层）
  mark = now()
  const verdict = enforceGuardrails({ decision, context })
  stages.push(
    stage(
      'guardrails',
      '安全守门',
      mark,
      verdict.violations.length === 0
        ? '通过'
        : verdict.violations.map((violation) => violation.code).join('、'),
    ),
  )

  const trace: AgentTrace = {
    runId: makeRunId(),
    at: Date.now(),
    layerVersion: AI_LAYER_VERSION,
    kind,
    providerId: provider.id,
    providerKind: provider.kind,
    ...(provider.model === undefined ? {} : { model: provider.model }),
    stages,
    signals,
    recalled,
    citations: verdict.decision.citations ?? [],
    guardrails: {
      passed: verdict.passed,
      repaired: verdict.repaired,
      violations: verdict.violations,
      notes: verdict.notes,
    },
    ...(fallbackFrom === undefined ? {} : { fallbackFrom }),
    tokens,
    latencyMs: ms(startedAt),
  }

  // 9/10) 行动已在结论内，Trace 一并返回
  return { kind, decision: verdict.decision, trace }
}
