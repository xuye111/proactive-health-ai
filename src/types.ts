/** 一天的健康记录（方案 §7 / §17）。 */
export interface DailyRecord {
  date: string
  sleepHours: number
  sleepScore: number
  bedTime: string
  wakeTime: string
  steps: number
  activeMinutes: number
  /** 可选设备/手动观测；当前只展示，不参与生活状态分。 */
  restingHeartRate?: number
  bloodPressureSystolic?: number
  bloodPressureDiastolic?: number
  meals: {
    breakfast: boolean
    lunch: boolean
    dinner: boolean
  }
  waterMl: number
  caffeineCups: number
  /** 1–5，主观状态不可只依赖传感器数据（方案 §7.4） */
  energy: number
  stress: number
  mood: number
  weightKg: number
}

/** 健康档案（方案 §10）。 */
export interface HealthProfile {
  name: string
  age: number
  gender: string
  heightCm: number
  weightKg: number
  background: {
    history: string
    family: string
    medications: string
    allergies: string
  }
  lifestyle: {
    sleep: string
    diet: string
    exercise: string
    habits: string
  }
  goals: Array<{ id: string; label: string; detail: string }>
}

/** 一条今日行动（方案 §9）。 */
export interface TodayAction {
  id: string
  text: string
  /** 为什么给这条建议——健康建议必须带依据。 */
  reason: string
}

/** 一条本周目标；metric 指向今日数据里的对应指标，用于「计划 vs 实际」。 */
export interface PlanGoal {
  id: string
  area: string
  title: string
  detail: string
  progress: number
  target: string
  metric: 'sleep' | 'activity' | 'caffeine'
}

export interface HealthPlan {
  weekOf: string
  goals: PlanGoal[]
  todayActions: TodayAction[]
}

/** AI 主动追问的一个选项。exclusive 表示与其它选项互斥（如「没有明显感觉」）。 */
export interface FollowUpOption {
  id: string
  label: string
  exclusive?: boolean
}

/** 第一阶段外壳的展示用断言，全部来自 Mock（方案 §13 / §14 的结构预演）。 */
export interface Insights {
  healthScore: number
  scoreLabel: string
  scoreNote: string
  known: string[]
  finding: {
    summary: string
    detail: string
    suggestion: string
  }
  followUp: {
    question: string
    options: FollowUpOption[]
  }
  trendNarrative: string
  context: {
    population: string
    personal: string
    trend: string
    events: string
  }
}

/** 用户主动提出的一个问题（自主交互路径）。key 是入库时的粗粒度路由标签，权威路由见 Trace。 */
export interface AskedMessage {
  key: string
  text: string
}

/** 输出分级定义在 AI 层，这里转发一次，避免出现第二份定义。 */
export type { OutputLevel } from './ai/types'
