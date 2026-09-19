/**
 * AI 层的领域类型。
 *
 * 这一层不依赖 React、不依赖任何 provider：把「判断」这件事的输入输出固定下来，
 * 规则实现与模型实现都只是它的一个 provider。
 */

export type OutputLevel = 'lifestyle' | 'information' | 'alert' | 'escalation'

export const OUTPUT_LEVELS: OutputLevel[] = ['lifestyle', 'information', 'alert', 'escalation']

/** 一条今日行动（方案 §9）。 */
export interface TodayAction {
  id: string
  text: string
  /** 为什么给这条建议——健康建议必须带依据。 */
  reason: string
}

export type SignalType =
  | 'sleep_decline'
  | 'bedtime_delay'
  | 'activity_decline'
  | 'stress_increase'
  | 'caffeine_late'
  | 'low_energy'

/**
 * 结构化信号（方案 §12）：不把原始数据直接交给模型自由判断，
 * 中间先落一层可解释、可测试的信号。
 */
export interface Signal {
  type: SignalType
  label: string
  severity: 'info' | 'watch' | 'alert'
  /** 触发这条信号的数据依据。 */
  evidence: string[]
  /** 阈值描述，让信号可被复核。 */
  rule: string
}

export interface Baseline {
  sleepHours: number
  steps: number
  sampleDays: number
}

export interface RecalledMemory {
  id: string
  date: string
  type: string
  text: string
  source: string
  /** 相关性分数（0–1），用于解释「为什么想起了这条」。 */
  score: number
  /** 命中原因，展示在 Trace 里。 */
  reason: string
}

export interface KnowledgeRef {
  id: string
  title: string
  review: string
}

/**
 * 交给 provider 的结构化 Context（方案 §13）。
 * 注意：不含任何「完整数据库」，只含判断需要的最小结构化信息。
 */
export interface HealthContext {
  date: string
  profile: {
    age: number
    gender: string
    goals: string[]
    /** 与判断相关的档案要点（如家族史），用于个体化引用。 */
    riskNotes: string[]
  }
  baseline: Baseline
  recent: {
    sleepHours: number
    sleepScore: number
    bedTime: string
    wakeTime: string
    steps: number
    activeMinutes: number
    caffeineCups: number
    waterMl: number
    energy: number
    stress: number
    mood: number
  }
  trend: {
    sleep7d: number[]
    last3dAverage: number
    prior3dAverage: number
    stepDeclinePct: number
    sleepBelowBaselineDays: number
  }
  signals: Signal[]
  memories: RecalledMemory[]
  knowledge: KnowledgeRef[]
  plan: {
    weekOf: string
    goals: Array<{ id: string; area: string; title: string; target: string; metric: string }>
    baseActions: TodayAction[]
  }
  /** 自主路径的问题（daily 请求为空）。 */
  question?: string
  /**
   * 命中急症/越界规则时的 id。
   * 由安全层给出，生成层与守门层共用同一个判断，避免两处规则漂移。
   */
  redFlag?: string
}

/** provider 的输出：必须结构化（方案 §14）。 */
export interface AgentDecision {
  level: OutputLevel
  /** 日程类：今日行动（含替换后的版本）。 */
  actions?: TodayAction[]
  /** 相对默认计划的变更说明，用于展示「你的反馈改变了什么」。 */
  changes?: string[]
  /** 面向用户的正文：问答类为回答，日程类为判断说明。 */
  answer?: string
  /** 依据：数据事实或知识条目。 */
  evidence: string[]
  /** 会写入长期记忆的事实（方案 §15）。 */
  memoryNotes?: string[]
  /** 更新后的「已经了解」标签。 */
  understanding?: string[]
  /** 判断理由，只进 Trace，不给用户看。 */
  reasoning?: string
  /** 引用的知识条目 id。 */
  citations?: string[]
}

export type AgentRequest =
  | { kind: 'daily'; context: HealthContext; answers: string[] }
  | { kind: 'answer'; context: HealthContext; question: string }

export interface TokenUsage {
  prompt: number
  completion: number
}

/** 守门层的一次判定。 */
export interface GuardrailViolation {
  code: string
  detail: string
}

export interface GuardrailVerdict {
  passed: boolean
  violations: GuardrailViolation[]
  /** 是否发生了强制修复或降级。 */
  repaired: boolean
  /** 修复后的最终结论（可能已被替换）。 */
  decision: AgentDecision
  notes: string[]
}

export interface TraceStage {
  id: string
  label: string
  ms: number
  detail?: string
}

/**
 * Trace 是一等公民：每一步的输入、耗时、依据与守门判定都要能被展示，
 * 既是可观测性，也是「为什么给这条建议」的产品可信度。
 */
export interface AgentTrace {
  runId: string
  at: number
  /** 判断层版本：让「某条建议由哪个版本给出」可回溯（见 version.ts）。 */
  layerVersion: string
  kind: AgentRequest['kind']
  providerId: string
  providerKind: 'rules' | 'llm' | 'mock'
  model?: string
  stages: TraceStage[]
  signals: Signal[]
  recalled: RecalledMemory[]
  citations: string[]
  guardrails: {
    passed: boolean
    repaired: boolean
    violations: GuardrailViolation[]
    notes: string[]
  }
  /** 从哪个 provider 降级而来（模型失败时）。 */
  fallbackFrom?: string
  tokens: TokenUsage | null
  latencyMs: number
}

export interface AgentRun {
  kind: AgentRequest['kind']
  decision: AgentDecision
  trace: AgentTrace
}
