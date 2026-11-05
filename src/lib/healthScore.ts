/**
 * 可复核的演示用生活状态分。分数不代表医学评估或临床阈值。
 * 输入保持宽松，便于直接接收 DailyRecord 的局部编辑结果。
 */
export type HealthScoreRecord = {
  date?: string
  sleepHours?: number
  bedTime?: string
  steps?: number
  activeMinutes?: number
  energy?: number
  stress?: number
  mood?: number
}

export type HealthScoreGoals = {
  sleepHours?: number
  activeMinutes?: number
}

export type ScorePartKey =
  | 'sleepDuration'
  | 'sleepRegularity'
  | 'steps'
  | 'activeMinutes'
  | 'energy'
  | 'stress'
  | 'mood'

export type ScorePart = {
  score: number | null
  weight: number
  target?: number
  baseline?: number
  historyDates?: string[]
}

export type HealthScoreResult = {
  score: number | null
  parts: Record<ScorePartKey, ScorePart>
  /** 已获得输入的原始权重百分比，缺失项不会被当作 0。 */
  coverage: number
  provisional: boolean
  missing: ScorePartKey[]
  version: 'score-v0.1'
}

export type HealthScoreSeriesPoint = HealthScoreResult & { date?: string }

const VERSION = 'score-v0.1' as const

const PARTS: Array<{ key: ScorePartKey; weight: number }> = [
  { key: 'sleepDuration', weight: 0.25 },
  { key: 'sleepRegularity', weight: 0.15 },
  { key: 'steps', weight: 0.15 },
  { key: 'activeMinutes', weight: 0.15 },
  { key: 'energy', weight: 0.1 },
  { key: 'stress', weight: 0.1 },
  { key: 'mood', weight: 0.1 },
]

const clamp = (value: number): number => Math.max(0, Math.min(100, value))
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const median = (values: number[]): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

const toMinutes = (value: unknown): number | null => {
  if (typeof value !== 'string') return null
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null
}

const nearClock = (value: number, anchor: number): number => {
  const delta = value - anchor
  return delta > 720 ? value - 1440 : delta < -720 ? value + 1440 : value
}

const datedHistory = (history: HealthScoreRecord[], pick: (record: HealthScoreRecord) => number | null) =>
  history.flatMap((record) => {
    const value = pick(record)
    return value === null ? [] : [{ value, date: record.date }]
  })

const emptyParts = (): Record<ScorePartKey, ScorePart> =>
  Object.fromEntries(PARTS.map(({ key, weight }) => [key, { score: null, weight }])) as Record<
    ScorePartKey,
    ScorePart
  >

/** 计算单日分数；history 必须是不含当前记录的有效历史。 */
export const healthScore = (
  record: HealthScoreRecord,
  history: HealthScoreRecord[] = [],
  goals: HealthScoreGoals = {},
): HealthScoreResult => {
  const parts = emptyParts()

  if (isFiniteNumber(record.sleepHours) && isFiniteNumber(goals.sleepHours) && goals.sleepHours > 0) {
    parts.sleepDuration = {
      score: clamp(100 - (Math.abs(record.sleepHours - goals.sleepHours) / 0.5) * 10),
      weight: 0.25,
      target: goals.sleepHours,
    }
  }

  const bedtimeHistory = datedHistory(history, (item) => toMinutes(item.bedTime))
  const bedTime = toMinutes(record.bedTime)
  if (bedTime !== null && bedtimeHistory.length >= 3) {
    const anchor = bedtimeHistory[0].value
    const baseline = median(bedtimeHistory.map((item) => nearClock(item.value, anchor)))
    if (baseline !== null) {
      parts.sleepRegularity = {
        score: clamp(100 - (Math.abs(nearClock(bedTime, baseline) - baseline) / 15) * 10),
        weight: 0.15,
        baseline: ((baseline % 1440) + 1440) % 1440,
        historyDates: bedtimeHistory.map((item) => item.date).filter((date): date is string => Boolean(date)),
      }
    }
  }

  const stepsHistory = datedHistory(history, (item) =>
    isFiniteNumber(item.steps) && item.steps >= 0 ? item.steps : null,
  )
  if (isFiniteNumber(record.steps) && record.steps >= 0 && stepsHistory.length >= 7) {
    const baseline = median(stepsHistory.map((item) => item.value))
    if (baseline !== null && baseline > 0) {
      parts.steps = {
        score: clamp((record.steps / baseline) * 100),
        weight: 0.15,
        baseline,
        historyDates: stepsHistory.map((item) => item.date).filter((date): date is string => Boolean(date)),
      }
    }
  }

  if (isFiniteNumber(record.activeMinutes) && record.activeMinutes >= 0 && isFiniteNumber(goals.activeMinutes) && goals.activeMinutes > 0) {
    parts.activeMinutes = {
      score: clamp((record.activeMinutes / goals.activeMinutes) * 100),
      weight: 0.15,
      target: goals.activeMinutes,
    }
  }

  if (isFiniteNumber(record.energy) && record.energy >= 1 && record.energy <= 5) {
    parts.energy = { score: (record.energy - 1) * 25, weight: 0.1 }
  }
  if (isFiniteNumber(record.stress) && record.stress >= 1 && record.stress <= 5) {
    parts.stress = { score: (5 - record.stress) * 25, weight: 0.1 }
  }
  if (isFiniteNumber(record.mood) && record.mood >= 1 && record.mood <= 5) {
    parts.mood = { score: (record.mood - 1) * 25, weight: 0.1 }
  }

  const available = PARTS.filter(({ key }) => parts[key].score !== null)
  const availableWeight = available.reduce((total, { weight }) => total + weight, 0)
  const missing = PARTS.filter(({ key }) => parts[key].score === null).map(({ key }) => key)
  const hasRequiredInputs =
    parts.sleepDuration.score !== null &&
    (parts.steps.score !== null || parts.activeMinutes.score !== null) &&
    [parts.energy, parts.stress, parts.mood].filter((part) => part.score !== null).length >= 2
  const score = hasRequiredInputs && availableWeight >= 0.6
    ? Math.round(available.reduce((total, { key, weight }) => total + (parts[key].score ?? 0) * weight, 0) / availableWeight)
    : null

  return {
    score,
    parts,
    coverage: Math.round(availableWeight * 100),
    provisional: missing.length > 0,
    missing,
    version: VERSION,
  }
}

/** 为每条记录只使用它之前的记录，防止未来数据进入个人基线。 */
export const scoreSeries = (
  records: HealthScoreRecord[],
  goals: HealthScoreGoals = {},
): HealthScoreSeriesPoint[] =>
  records.map((record, index) => ({ date: record.date, ...healthScore(record, records.slice(0, index), goals) }))
