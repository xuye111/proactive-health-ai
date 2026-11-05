#!/usr/bin/env node
/**
 * 生成 30 天 Mock 健康数据（方案 §17）。
 *
 * 目标：让方案里的示例数字在数据里真实成立，UI 直接算得出来，不写死文案。
 *   - 今日睡眠 6.2h（= 6 小时 12 分）、睡眠评分 72、入睡 00:42 / 起床 07:16
 *   - 今日步数 3,241，较过去 7 日均值（4,500）下降 28%
 *   - 近 7 日睡眠 7.3 / 6.9 / 7.1 / 6.8 / 6.3 / 6.1 / 6.2（方案 §8）
 *   - 30 天个人基线 ≈ 7.03h，近 3 日 6.3 / 6.1 / 6.2 均低于基线
 *
 * 用法：node scripts/generate-mock-data.mjs
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'healthRecords.json')
const DAYS = 30
const TODAY = new Date('2026-09-19T00:00:00Z')
const LATENCY_MIN = 22 // 入睡潜伏期：睡眠时长 + 潜伏期 = 卧床时长

const SLEEP_HOURS = [
  // 前 23 天：个人基线区间，均值 ≈ 7.14
  7.4, 7.1, 6.8, 7.5, 7.2, 6.9, 7.6, 7.0, 7.3, 6.7, 7.2, 7.4, 6.8,
  7.1, 7.5, 6.9, 7.0, 7.3, 7.2, 6.6, 7.4, 7.1, 7.2,
  // 近 7 天：方案 §8 指定序列，尾部连续下滑
  7.3, 6.9, 7.1, 6.8, 6.3, 6.1, 6.2,
]

// 今日步数与「过去 7 日」（不含今日，即 idx 22–28）步数：过去 7 日均值恰好 4,500
const STEPS_RECENT = [4620, 4380, 4510, 4460, 4550, 4440, 4540]
const STEPS_TODAY = 3241
const ACTIVE_MINUTES_TODAY = 28

// 近 5 天主观状态：精力下滑、压力升高（与首页「近期压力较高」一致）
const SUBJECTIVE_RECENT = {
  energy: [4, 3, 3, 3, 3],
  stress: [3, 3, 4, 4, 4],
  mood: [4, 3, 3, 3, 3],
}

const round1 = (n) => Math.round(n * 10) / 10
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi)

function isoDay(offsetFromToday) {
  const d = new Date(TODAY)
  d.setUTCDate(d.getUTCDate() + offsetFromToday)
  return d.toISOString().slice(0, 10)
}

function minutesToClock(totalMinutes) {
  const m = ((totalMinutes % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** 由入睡时刻反推起床时刻：卧床 = 睡眠时长 + 潜伏期。 */
function wakeFrom(bedMinutes, sleepHours) {
  return minutesToClock(bedMinutes + Math.round((sleepHours + LATENCY_MIN / 60) * 60))
}

const records = []

for (let i = 0; i < DAYS; i += 1) {
  const dayOffset = i - (DAYS - 1) // -29 … 0
  const idx = i
  const sleep = SLEEP_HOURS[idx]
  const isRecent = idx >= DAYS - 7

  // 入睡时间：基线期 23:35–00:35，近 4 天逐步推迟到今日 00:42
  const bedMinutes =
    idx >= DAYS - 4 ? 42 - (DAYS - 1 - idx) * 10 : 23 * 60 + 35 + ((idx * 17) % 61)

  const steps =
    idx === DAYS - 1
      ? STEPS_TODAY
      : idx >= DAYS - 8
        ? STEPS_RECENT[idx - (DAYS - 8)]
        : Math.round(5200 + ((idx * 613) % 2900) - idx * 22)
  const activeMinutes = idx === DAYS - 1 ? ACTIVE_MINUTES_TODAY : clamp(Math.round(steps / 190), 12, 52)

  // 主观状态：基线期精力 4 / 压力 2 / 情绪 4，近 5 天按表下滑
  const recentIdx = idx - (DAYS - 5)
  const energy = recentIdx >= 0 ? SUBJECTIVE_RECENT.energy[recentIdx] : 4
  const stress = recentIdx >= 0 ? SUBJECTIVE_RECENT.stress[recentIdx] : 2
  const mood = recentIdx >= 0 ? SUBJECTIVE_RECENT.mood[recentIdx] : 4

  records.push({
    date: isoDay(dayOffset),
    sleepHours: sleep,
    sleepScore: clamp(Math.round(sleep * 11.6), 40, 98),
    bedTime: minutesToClock(bedMinutes),
    wakeTime: wakeFrom(bedMinutes, sleep),
    steps,
    activeMinutes,
    // 仅供界面演示的合成观测值；不参与生活状态分，也不用于医疗判读。
    restingHeartRate: 63 + ((idx * 3) % 8),
    bloodPressureSystolic: 112 + ((idx * 5) % 13),
    bloodPressureDiastolic: 72 + ((idx * 3) % 9),
    meals: {
      breakfast: idx % 7 !== 3,
      lunch: true,
      dinner: idx % 9 !== 5,
    },
    waterMl: 1200 + ((idx * 137) % 700),
    caffeineCups: idx === DAYS - 1 ? 2 : clamp(1 + (idx % 3) - (isRecent ? 0 : 1), 0, 3),
    energy,
    stress,
    mood,
    weightKg: round1(58 + idx * 0.014),
  })
}

writeFileSync(OUT, `${JSON.stringify(records, null, 2)}\n`)

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const last7 = records.slice(-7).map((r) => r.sleepHours)
const baseline = avg(records.map((r) => r.sleepHours))
const prev7Steps = avg(records.slice(-8, -1).map((r) => r.steps))

console.log(`wrote ${OUT}`)
console.log(`  ${records.length} 天：${records[0].date} … ${records.at(-1).date}`)
console.log(`  今日睡眠 ${records.at(-1).sleepHours}h，评分 ${records.at(-1).sleepScore}，${records.at(-1).bedTime} → ${records.at(-1).wakeTime}`)
console.log(`  近 7 日睡眠 ${last7.join(' / ')}`)
console.log(`  30 天个人基线 ${baseline.toFixed(2)}h，近 3 日均低于基线`)
console.log(`  今日步数 ${records.at(-1).steps}，过去 7 日均值 ${Math.round(prev7Steps)}，降幅 ${(((prev7Steps - records.at(-1).steps) / prev7Steps) * 100).toFixed(1)}%`)
