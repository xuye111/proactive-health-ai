import { useEffect, useMemo, useState } from 'react'
import plan from '../data/plan.json'
import { useAgentState } from '../lib/agentStore'
import { allMemories, recallCorpus, type MemoryEntry } from '../lib/memory'
import type { TodayAction } from '../types'
import { runAgent, type AgentInput } from './agent'
import type { AgentRun, AgentTrace, OutputLevel } from './types'

/**
 * 异步会话层：把「跑一次 Agent」变成 UI 可以消费的状态。
 *
 * 为什么需要它：provider 现在是异步的（模型调用天然异步，规则实现只是恰好很快）。
 * 如果 UI 只支持同步取值，架构就退化成「只能离线跑」。这里做三件事：
 *   - 结果缓存：同一个输入只跑一次（避免模型被重复调用、白花钱）；
 *   - 进行中合并（inflight）：多个组件同时要同一个结果时只发一次请求；
 *   - 保留上一次结果：新一轮计算进行中时界面不闪空。
 */

export type RunStatus = 'idle' | 'running' | 'ready' | 'error'

export interface RunState {
  status: RunStatus
  run: AgentRun | null
  error: string | null
}

const cache = new Map<string, AgentRun>()
const inflight = new Map<string, Promise<AgentRun>>()

const keyOf = (kind: string, input: AgentInput): string =>
  JSON.stringify([
    kind,
    input.subjective,
    input.answers ?? [],
    input.question ?? '',
    input.memories.map((memory) => memory.id),
  ])

const message = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error)

function useRun(kind: 'daily' | 'answer', input: AgentInput): RunState {
  const key = useMemo(() => keyOf(kind, input), [kind, input])
  const [state, setState] = useState<RunState>(() => {
    const cached = cache.get(key)
    return cached === undefined
      ? { status: 'idle', run: null, error: null }
      : { status: 'ready', run: cached, error: null }
  })

  useEffect(() => {
    let alive = true
    const cached = cache.get(key)
    if (cached !== undefined) {
      setState({ status: 'ready', run: cached, error: null })
      return () => {
        alive = false
      }
    }

    // 保留上一次结果，避免计算期间界面闪空
    setState((previous) => ({ status: 'running', run: previous.run, error: null }))

    const pending =
      inflight.get(key) ??
      runAgent(input)
        .then((run) => {
          cache.set(key, run)
          inflight.delete(key)
          return run
        })
        .catch((error: unknown) => {
          inflight.delete(key)
          throw error
        })
    inflight.set(key, pending)

    pending
      .then((run) => {
        if (alive) setState({ status: 'ready', run, error: null })
      })
      .catch((error: unknown) => {
        if (alive) setState((previous) => ({ status: 'error', run: previous.run, error: message(error) }))
      })

    return () => {
      alive = false
    }
    // input 由 key 完整表达，这里只依赖 key，避免每次渲染都重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state
}

/** 日程类：小满的判断与今日行动。 */
export function useDailyRun(): RunState {
  const { answers, submitted, subjective, asked } = useAgentState()
  const input = useMemo<AgentInput>(
    () => ({
      subjective,
      memories: recallCorpus(asked),
      answers: submitted ? answers : [],
    }),
    [subjective, asked, answers, submitted],
  )
  return useRun('daily', input)
}

/** 问答类：针对一个用户问题跑一次（组件级调用，每条问题一个组件）。 */
export function useAnswerRun(question: string): RunState {
  const { subjective, asked } = useAgentState()
  const input = useMemo<AgentInput>(
    () => ({ subjective, memories: recallCorpus(asked), question }),
    [subjective, asked, question],
  )
  return useRun('answer', input)
}

const BASE_ACTIONS = plan.todayActions as TodayAction[]

/** 视图模型：给页面消费的日程结果（形状与旧版 Interpretation 兼容，另加 trace 与状态）。 */
export interface DailyPlanView {
  understanding: string[]
  actions: TodayAction[]
  changes: string[]
  judgment: string
  memoryNotes: string[]
  answered: boolean
  trace: AgentTrace | null
  status: RunStatus
}

export function useTodayPlan(): DailyPlanView {
  const { answers } = useAgentState()
  const { run, status } = useDailyRun()

  return useMemo(() => {
    const decision = run?.decision
    return {
      understanding: decision?.understanding ?? [],
      // 首次计算完成前回落到默认计划，避免界面出现空清单
      actions: decision?.actions ?? BASE_ACTIONS,
      changes: decision?.changes ?? [],
      judgment: decision?.answer ?? '',
      memoryNotes: decision?.memoryNotes ?? [],
      answered: answers.length > 0,
      trace: run?.trace ?? null,
      status,
    }
  }, [run, status, answers])
}

export interface AnswerView {
  level: OutputLevel
  text: string
  evidence: string[]
  trace: AgentTrace | null
  status: RunStatus
}

/** 视图模型：给页面消费的问答结果。 */
export function useAnswerView(question: string): AnswerView {
  const { run, status } = useAnswerRun(question)
  return useMemo(() => {
    const decision = run?.decision
    return {
      level: decision?.level ?? 'information',
      text: decision?.answer ?? (status === 'running' ? '正在结合今天的记录…' : ''),
      evidence: decision?.evidence ?? [],
      trace: run?.trace ?? null,
      status,
    }
  }, [run, status])
}

/** 长期记忆：历史 + 关注点 + 本次判断写下的记忆（随使用增长）。 */
export function useMemoryEntries(): MemoryEntry[] {
  const { asked } = useAgentState()
  const { run } = useDailyRun()
  return useMemo(
    () => allMemories(asked, run?.decision.memoryNotes ?? []),
    [asked, run?.decision.memoryNotes],
  )
}
