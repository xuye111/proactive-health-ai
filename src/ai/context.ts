import plan from '../data/plan.json'
import profile from '../data/profile.json'
import type { MemoryEntry } from '../lib/memory'
import {
  averageOf,
  consecutiveDaysBelow,
  declinePct,
  previousDays,
  recentDays,
  records,
  today,
} from '../lib/derive'
import { KNOWLEDGE } from '../lib/knowledge'
import { recallMemories } from './memory-recall'
import { redFlagFor } from './safety'
import { computeBaseline, detectSignals } from './signals'
import type { HealthContext, RecalledMemory, Signal } from './types'

/**
 * Context Builder（方案 §13）。
 *
 * 生成层不直接读数据库：先在这里把「判断需要的最小结构化信息」组装好——
 * 档案要点、个人基线、当日与近期数据、信号、召回的记忆、可引用的知识条目。
 * 这样换 provider 时，模型看到的东西与规则看到的东西完全一致。
 */

export interface AssembleContextInput {
  subjective: { energy: number; stress: number; mood: number }
  /** 由上游流水线算好的信号与记忆，组装阶段不重复计算。 */
  signals: Signal[]
  recalled: RecalledMemory[]
  /** 自主路径的问题原文。 */
  question?: string
}

/**
 * 纯粹的组装：不计算信号、不召回记忆。
 * 拆开是为了让编排层能分别给「算基线 / 识别信号 / 召回记忆 / 组装上下文」计时（Trace 需要）。
 */
export function assembleContext(input: AssembleContextInput): HealthContext {
  const baseline = computeBaseline()
  const { signals, recalled } = input

  const last3 = recentDays(3)
  const prior3 = records.slice(-6, -3)
  const previousSteps = averageOf(previousDays(7), (record) => record.steps)

  const context: HealthContext = {
    date: today.date,
    profile: {
      age: profile.age,
      gender: profile.gender,
      goals: profile.goals.map((goal) => goal.label),
      // 与建议安全相关的档案要点（个体化引用用）
      riskNotes: [`家族史：${profile.background.family}`, `过敏史：${profile.background.allergies}`],
    },
    baseline,
    recent: {
      sleepHours: today.sleepHours,
      sleepScore: today.sleepScore,
      bedTime: today.bedTime,
      wakeTime: today.wakeTime,
      steps: today.steps,
      activeMinutes: today.activeMinutes,
      caffeineCups: today.caffeineCups,
      waterMl: today.waterMl,
      energy: input.subjective.energy,
      stress: input.subjective.stress,
      mood: input.subjective.mood,
    },
    trend: {
      sleep7d: recentDays(7).map((record) => record.sleepHours),
      last3dAverage: Math.round(averageOf(last3, (record) => record.sleepHours) * 100) / 100,
      prior3dAverage: Math.round(averageOf(prior3, (record) => record.sleepHours) * 100) / 100,
      stepDeclinePct: Math.round(declinePct(today.steps, previousSteps)),
      sleepBelowBaselineDays: consecutiveDaysBelow(
        records.map((record) => record.sleepHours),
        baseline.sleepHours,
      ),
    },
    signals,
    memories: recalled,
    knowledge: KNOWLEDGE.map((entry) => ({
      id: entry.id,
      title: entry.title,
      review: entry.review,
    })),
    plan: {
      weekOf: plan.weekOf,
      goals: plan.goals.map((goal) => ({
        id: goal.id,
        area: goal.area,
        title: goal.title,
        target: goal.target,
        metric: goal.metric,
      })),
      baseActions: plan.todayActions,
    },
    ...(input.question === undefined ? {} : { question: input.question }),
  }

  // 急症/越界判定与生成层共用同一个实现，避免两处规则漂移
  if (input.question !== undefined) {
    const flag = redFlagFor(input.question)
    if (flag !== undefined) context.redFlag = flag.id
  }

  return context
}

export interface BuildContextInput {
  subjective: { energy: number; stress: number; mood: number }
  memories: MemoryEntry[]
  question?: string
}

/** 便捷入口：一次跑完「基线 → 信号 → 召回 → 组装」，供测试与文档使用。 */
export function buildContext(input: BuildContextInput): {
  context: HealthContext
  signals: Signal[]
  recalled: RecalledMemory[]
} {
  const baseline = computeBaseline()
  const signals = detectSignals(input.subjective, baseline)
  const recalled = recallMemories(input.memories, {
    signals,
    ...(input.question === undefined ? {} : { question: input.question }),
  })
  return {
    context: assembleContext({
      subjective: input.subjective,
      signals,
      recalled,
      ...(input.question === undefined ? {} : { question: input.question }),
    }),
    signals,
    recalled,
  }
}
