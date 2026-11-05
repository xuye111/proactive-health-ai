import assert from 'node:assert/strict'
import { createServer } from 'vite'

const values = new Map([['pha.health.v2', JSON.stringify({ mode: 'demo', records: [{ date: '2025-01-01', source: 'manual', updatedAt: '2025-01-01', energy: 4 }], sleepRoutine: { morningFeedbackOn: '2026-09-26', morningFeedbackSkipped: false } })]])
globalThis.window = { localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } }
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
try {
  const store = await server.ssrLoadModule('/src/lib/healthStore.ts')
  const derive = await server.ssrLoadModule('/src/lib/derive.ts')
  assert.equal(store.getHealthState().records[0]?.energy, 4, 'legacy mode state keeps user records during migration')
  assert.equal(store.getHealthState().profile.displayName, '', 'old stored state starts with an empty editable profile')
  assert.deepEqual(store.getHealthState().sleepRoutine.morningFeedbackHistory, [{ date: '2026-09-26', skipped: false }], 'old one-day feedback migrates into history')
  store.clearPersonalRecords()
  assert.equal(store.localDate(new Date('2026-09-26T10:00:00')), '2026-09-26')
  assert.equal(store.localTimestamp(new Date('2026-09-26T10:00:00')).slice(0, 10), '2026-09-26')
  assert.equal(store.validatePatch({ sleepHours: 7.5 }).sleepHours, 7.5)
  assert.throws(() => store.validatePatch({ sleepHours: -1 }))
  assert.throws(() => store.validatePatch({ energy: 6 }))
  assert.equal(store.validatePatch({ restingHeartRate: 62 }).restingHeartRate, 62)
  assert.equal(store.validatePatch({ bloodPressureSystolic: 118, bloodPressureDiastolic: 76 }).bloodPressureDiastolic, 76)
  assert.throws(() => store.validatePatch({ restingHeartRate: -1 }))
  assert.equal(store.createEmptyState().records.length, 0)
  assert.equal(store.effectiveRecords(store.createEmptyState()).length, 30, 'one stream begins with 30 days of dated simulated readings')
  assert.equal(store.activeRecord(store.createEmptyState()).source, 'demo')
  const originalSleep = store.activeRecord(store.getHealthState()).sleepHours
  store.saveDailyRecord(store.localDate(), { sleepHours: 7.5, energy: 4 })
  assert.equal(store.activeRecord(store.getHealthState()).sleepHours, 7.5)
  assert.ok(!store.activeRecord(store.getHealthState()).simulatedFields.includes('sleepHours'))
  assert.ok(store.activeRecord(store.getHealthState()).simulatedFields.includes('steps'))
  assert.deepEqual(Object.keys(store.getHealthState().records[0]).sort(), ['date', 'energy', 'sleepHours', 'source', 'updatedAt'].sort(), 'saving two fields does not copy simulated values into local records')
  store.saveDailyRecord(store.localDate(), { sleepHours: null })
  assert.equal(store.activeRecord(store.getHealthState()).sleepHours, originalSleep, 'clearing an override restores the simulated value')
  assert.ok(store.activeRecord(store.getHealthState()).simulatedFields.includes('sleepHours'))
  store.setPersonalProfile({ displayName: '小林', birthYear: 1990, heightCm: 168, focus: '规律作息' })
  assert.equal(store.getHealthState().profile.displayName, '小林')
  assert.equal(JSON.parse(values.get('pha.health.v2')).profile.focus, '规律作息', 'profile persists in the same local store')
  assert.throws(() => store.setPersonalProfile({ displayName: 'A'.repeat(31), focus: '' }), 'overlong profile text is rejected')
  const goals = derive.personalGoalSummary([
    { date: '2026-09-25', source: 'manual', updatedAt: '2026-09-25', sleepHours: 8, activeMinutes: 30 },
    { date: '2026-09-26', source: 'manual', updatedAt: '2026-09-26', sleepHours: 6 },
  ], '2026-09-26', { sleepHours: 7, activeMinutes: 30 })
  assert.deepEqual(goals.sleep, { recorded: 2, met: 1, target: 7 })
  assert.deepEqual(goals.activity, { recorded: 1, met: 1, target: 30 }, 'missing activity must not count as a failure')
  console.log('health store: unified source and override checks passed')
} finally {
  await server.close()
}
