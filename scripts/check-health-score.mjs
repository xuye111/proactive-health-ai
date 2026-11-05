import assert from 'node:assert/strict'
import { execFile as execFileCallback } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const execFile = promisify(execFileCallback)
const buildDir = await mkdtemp(join(tmpdir(), 'health-score-check-'))
await execFile('./node_modules/.bin/tsc', [
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'NodeNext',
  '--moduleResolution', 'NodeNext',
  '--skipLibCheck',
  '--outDir', buildDir,
  'src/lib/healthScore.ts',
])
const scoreModule = await import(pathToFileURL(join(buildDir, 'healthScore.js')).href)

const { healthScore, scoreSeries } = scoreModule
const goals = { sleepHours: 8, activeMinutes: 30 }
const history = Array.from({ length: 7 }, (_, index) => ({
  date: `2026-09-${String(index + 1).padStart(2, '0')}`,
  bedTime: '23:00',
  steps: 5000,
}))

const fullRecord = {
  date: '2026-09-08',
  sleepHours: 7.5,
  bedTime: '23:30',
  steps: 5000,
  activeMinutes: 15,
  energy: 4,
  stress: 2,
  mood: 3,
}

{
  const result = healthScore(fullRecord, history, goals)
  assert.equal(result.score, 77, 'seven inputs should use the documented weights and rounding')
  assert.equal(result.coverage, 100)
  assert.equal(result.provisional, false)
  assert.equal(result.version, 'score-v0.1')
  assert.equal(result.parts.sleepDuration.score, 90)
  assert.equal(result.parts.sleepRegularity.score, 80)
  assert.equal(result.parts.steps.score, 100)
  assert.equal(result.parts.activeMinutes.score, 50)
}

{
  const result = healthScore(
    { sleepHours: 8, steps: 5000, energy: 4, mood: 4 },
    history,
    goals,
  )
  assert.equal(result.score, 92, '60% coverage is enough when the mandatory categories are present')
  assert.equal(result.coverage, 60)
  assert.equal(result.provisional, true)
  assert.deepEqual(result.missing, ['sleepRegularity', 'activeMinutes', 'stress'])
}

{
  const result = healthScore({ sleepHours: 8, energy: 5, mood: 5 }, history, goals)
  assert.equal(result.score, null, 'a score needs one activity input')
  assert.equal(result.coverage, 45)
  assert.equal(result.provisional, true)
}

{
  const lowerBaseline = healthScore(
    { sleepHours: 8, steps: 5000, energy: 4, mood: 4 },
    history.map((item) => ({ ...item, steps: 4000 })),
    goals,
  )
  const higherBaseline = healthScore(
    { sleepHours: 8, steps: 5000, energy: 4, mood: 4 },
    history.map((item) => ({ ...item, steps: 8000 })),
    goals,
  )
  assert.equal(lowerBaseline.parts.steps.score, 100)
  assert.equal(higherBaseline.parts.steps.score, 62.5)
  assert.ok((lowerBaseline.score ?? 0) > (higherBaseline.score ?? 0), 'steps use the personal historical median')
}

{
  const onTime = healthScore(
    { sleepHours: 8, bedTime: '23:30', steps: 5000, energy: 4, mood: 4 },
    history.slice(0, 3).map((item) => ({ ...item, bedTime: '23:30' })),
    goals,
  )
  const shiftedBaseline = healthScore(
    { sleepHours: 8, bedTime: '23:30', steps: 5000, energy: 4, mood: 4 },
    history.slice(0, 3).map((item, index) => ({ ...item, bedTime: index === 1 ? '22:30' : '22:00' })),
    goals,
  )
  assert.equal(onTime.parts.sleepRegularity.score, 100)
  assert.equal(shiftedBaseline.parts.sleepRegularity.score, 40)
}

{
  const series = scoreSeries([
    ...history,
    { ...fullRecord, date: '2026-09-08' },
  ], goals)
  assert.equal(series.length, 8)
  assert.equal(series.at(-1)?.score, 77, 'series uses records before each date as its history')
}

{
  const result = healthScore(
    { sleepHours: 8, bedTime: '23:55', activeMinutes: 30, energy: 4, mood: 4 },
    ['23:50', '00:00', '00:10'].map((bedTime, index) => ({ date: `2026-09-0${index + 1}`, bedTime })),
    goals,
  )
  assert.equal(result.parts.sleepRegularity.score, 100 - 5 / 15 * 10, 'bedtime median must span midnight')
}

await rm(buildDir, { recursive: true, force: true })
console.log('health-score: 7/7 checks passed')
