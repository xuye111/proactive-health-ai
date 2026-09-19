import seed from '../data/memories.json'
import { today } from './derive'

/**
 * 长期记忆（方案 §23）。
 *
 * 这里只放**纯数据与纯函数**：记忆类型、历史记忆、以及「把本次产生的记忆合并进来」。
 * React hook 放在 src/ai/hooks.ts，避免「记忆 → 判断 → 记忆」的循环依赖：
 * 召回只用判断之前已存在的记忆，本次判断新产生的记忆在判断之后才写入。
 */

export type MemoryType = 'behavior' | 'feedback' | 'preference' | 'adherence' | 'event' | 'interest'

export interface MemoryEntry {
  id: string
  date: string
  type: MemoryType
  text: string
  /** 这条记忆从哪来：数据观察 / 对话 / 计划执行 / 健康事件。 */
  source: string
}

export const MEMORY_TYPES: MemoryType[] = [
  'behavior',
  'feedback',
  'preference',
  'adherence',
  'event',
  'interest',
]

export const MEMORY_TYPE_LABEL: Record<MemoryType, string> = {
  behavior: '行为',
  feedback: '反馈',
  preference: '偏好',
  adherence: '计划完成',
  event: '健康事件',
  interest: '关注点',
}

export const MEMORY_TYPE_STYLE: Record<MemoryType, string> = {
  behavior: 'bg-calm text-ink-soft',
  feedback: 'bg-brand-soft/70 text-brand-deep',
  preference: 'bg-diet/10 text-diet',
  adherence: 'bg-activity/10 text-activity',
  event: 'bg-mind/10 text-mind',
  interest: 'bg-line-soft text-ink-soft',
}

export const SEED_MEMORIES: MemoryEntry[] = seed as MemoryEntry[]

/** 用户在会话里提过的问题 → 关注点记忆。 */
export function askMemories(asked: Array<{ text: string }>): MemoryEntry[] {
  return asked.map((entry, index) => ({
    id: `live-ask-${index}`,
    date: today.date,
    type: 'interest' as MemoryType,
    text: `问过「${entry.text}」`,
    source: '来自对话',
  }))
}

/** 判断产生的结论 → 反馈记忆（在判断之后写入，不参与本次召回）。 */
export function feedbackMemories(memoryNotes: string[]): MemoryEntry[] {
  return memoryNotes.map((text, index) => ({
    id: `live-feedback-${index}`,
    date: today.date,
    type: 'feedback' as MemoryType,
    text,
    source: '来自你的反馈',
  }))
}

/** 按日期倒序：刚产生的一定在最上面。 */
export const sortMemories = (entries: MemoryEntry[]): MemoryEntry[] =>
  [...entries].sort((a, b) => (a.date < b.date ? 1 : -1))

/** 召回的输入语料：历史记忆 + 关注点（不含本次判断新产生的记忆）。 */
export const recallCorpus = (asked: Array<{ text: string }>): MemoryEntry[] =>
  sortMemories([...askMemories(asked), ...SEED_MEMORIES])

/** 展示用：历史记忆 + 关注点 + 本次判断写下的记忆。 */
export const allMemories = (asked: Array<{ text: string }>, memoryNotes: string[]): MemoryEntry[] =>
  sortMemories([...feedbackMemories(memoryNotes), ...askMemories(asked), ...SEED_MEMORIES])
