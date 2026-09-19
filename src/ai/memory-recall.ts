import { today } from '../lib/derive'
import type { MemoryEntry } from '../lib/memory'
import type { RecalledMemory, Signal, SignalType } from './types'

/**
 * 记忆召回（方案 §15 / §23）。
 *
 * 第一阶段只做「写入」，召回能力缺失，导致记忆不参与判断。这里补上最小可用的召回：
 * **关键词相关性 + 时间衰减 + 类型权重**，并给出命中原因，让「为什么想起了这条」可解释。
 * 第三阶段可替换为向量召回，接口不变。
 */

/** 每类信号对应的召回关键词。 */
const SIGNAL_KEYWORDS: Record<SignalType, string[]> = {
  sleep_decline: ['睡', '入睡', '夜间', '节律', '加班', '晚', '失眠'],
  bedtime_delay: ['入睡', '晚', '加班', '咖啡因', '屏幕'],
  activity_decline: ['步', '活动', '运动', '走', '懒', '感冒', '休息'],
  stress_increase: ['压力', '情绪', '焦虑', '工作', '交付', '加班'],
  caffeine_late: ['咖啡', '咖啡因', '下午'],
  low_energy: ['精力', '疲劳', '累', '困'],
}

/** 类型权重：用户亲口给的信息比系统观察更值得引用。 */
const TYPE_WEIGHT: Record<string, number> = {
  feedback: 1,
  preference: 0.95,
  interest: 0.85,
  event: 0.8,
  behavior: 0.7,
  adherence: 0.7,
}

const DAY_MS = 24 * 60 * 60 * 1000

export interface RecallOptions {
  /** 召回条数上限。 */
  limit?: number
  /** 相关性下限。 */
  minScore?: number
}

export interface RecallQuery {
  signals: Signal[]
  /** 用户主动提问的原文（自主路径）。 */
  question?: string
}

/**
 * 相关性 = 0.6 × 关键词命中 + 0.25 × 时间衰减 + 0.15 × 类型权重。
 * 权重是产品假设，需要在真实使用中校准（见 docs/metrics.md 的「记忆命中率」）。
 */
export function recallMemories(
  memories: MemoryEntry[],
  query: RecallQuery,
  options: RecallOptions = {},
): RecalledMemory[] {
  const { limit = 3, minScore = 0.3 } = options

  const keywords = new Set<string>()
  for (const signal of query.signals) {
    for (const keyword of SIGNAL_KEYWORDS[signal.type] ?? []) keywords.add(keyword)
  }
  if (query.question !== undefined) {
    for (const char of query.question.replace(/[，。？！,?!\s]/g, '')) keywords.add(char)
  }

  const todayTime = new Date(`${today.date}T00:00:00Z`).getTime()

  const scored = memories.map((memory) => {
    const hits = [...keywords].filter((keyword) => memory.text.includes(keyword))
    const keywordScore = keywords.size === 0 ? 0 : Math.min(hits.length / 2, 1)
    const ageDays = Math.max(0, (todayTime - new Date(`${memory.date}T00:00:00Z`).getTime()) / DAY_MS)
    const recencyScore = 1 / (1 + ageDays / 14)
    const typeScore = TYPE_WEIGHT[memory.type] ?? 0.7
    const score = 0.6 * keywordScore + 0.25 * recencyScore + 0.15 * typeScore
    const reasons: string[] = []
    if (hits.length > 0) reasons.push(`命中关键词「${hits.slice(0, 3).join('、')}」`)
    if (ageDays <= 7) reasons.push(`${Math.round(ageDays)} 天内`)
    return {
      id: memory.id,
      date: memory.date,
      type: memory.type,
      text: memory.text,
      source: memory.source,
      score: Math.round(score * 100) / 100,
      reason: reasons.length > 0 ? reasons.join(' · ') : '类型相关',
    } satisfies RecalledMemory
  })

  return scored
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
