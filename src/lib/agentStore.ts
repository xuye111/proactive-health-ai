import { useSyncExternalStore } from 'react'
import type { AskedMessage } from '../types'
import { today } from './derive'

/**
 * AI 追问的反馈与主观状态：跨页面共享、按日期存本机。
 *
 * 为什么需要它：AI 页的回答必须真的改变「今日行动」，而今日行动在记录页与首页都要用。
 * 第一阶段没有后端，so 用一个模块级 store + localStorage 代替服务端状态。
 */

export interface SubjectiveState {
  energy: number
  stress: number
  mood: number
}

export interface AgentState {
  /** 已选中的追问选项 id。 */
  answers: string[]
  /** 用户是否已经提交（未提交不得影响判断）。 */
  submitted: boolean
  /** 用户主动提出的问题（自主交互路径），按时间顺序。 */
  asked: AskedMessage[]
  subjective: SubjectiveState
}

const storageKey = `pha.agent.v1.${today.date}`

const fallback = (): AgentState => ({
  answers: [],
  submitted: false,
  asked: [],
  subjective: { energy: today.energy, stress: today.stress, mood: today.mood },
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

function load(): AgentState {
  const base = fallback()
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw === null) return base
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return base
    const answers = Array.isArray(parsed.answers)
      ? parsed.answers.filter((item): item is string => typeof item === 'string')
      : []
    const asked = Array.isArray(parsed.asked)
      ? parsed.asked.flatMap((item): AskedMessage[] => {
          if (!isRecord(item) || typeof item.text !== 'string') return []
          return [{ key: typeof item.key === 'string' ? item.key : 'unmatched', text: item.text }]
        })
      : []
    const subjective = isRecord(parsed.subjective) ? parsed.subjective : {}
    const pick = (key: keyof SubjectiveState): number => {
      const value = subjective[key]
      return typeof value === 'number' && value >= 1 && value <= 5 ? value : base.subjective[key]
    }
    return {
      answers,
      submitted: parsed.submitted === true,
      asked,
      subjective: { energy: pick('energy'), stress: pick('stress'), mood: pick('mood') },
    }
  } catch {
    return base
  }
}

let state: AgentState = load()
const listeners = new Set<() => void>()

function commit(next: AgentState): void {
  state = next
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    /* 隐私模式下写入失败不影响使用 */
  }
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = (): AgentState => state

export function useAgentState(): AgentState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** 覆盖选中项；互斥逻辑（「没有明显感觉」）由调用方按选项定义处理。 */
export function setAnswers(answers: string[]): void {
  commit({ ...state, answers, submitted: false })
}

export function submitAnswers(): void {
  if (state.answers.length === 0) return
  commit({ ...state, submitted: true })
}

/** 清空反馈与自主提问，回到默认判断——演示时方便反复走一遍闭环。 */
export function resetFeedback(): void {
  commit({ ...state, answers: [], submitted: false, asked: [] })
}

/** 记录一次用户主动提问（key 由调用方用 matchIntent 解析后传入）。 */
export function askQuestion(entry: AskedMessage): void {
  if (entry.text.trim() === '') return
  commit({ ...state, asked: [...state.asked, entry] })
}

export function setSubjective(patch: Partial<SubjectiveState>): void {
  commit({ ...state, subjective: { ...state.subjective, ...patch } })
}
