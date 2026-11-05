import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
try {
  const { reviewPersonal, actionablePersonalSignals, answerPersonalChat } = await server.ssrLoadModule('/src/ai/personal.ts')
  const empty = reviewPersonal([], '2026-09-26')
  assert.equal(empty.kind, 'missing')
  assert.equal(empty.signals.length, 0)
  const rows = [
    ['2026-09-20', 8], ['2026-09-21', 8], ['2026-09-22', 8],
    ['2026-09-23', 8], ['2026-09-24', 6], ['2026-09-25', 6], ['2026-09-26', 6],
  ].map(([date, sleepHours]) => ({ date, sleepHours, source: 'manual', updatedAt: date }))
  const review = reviewPersonal(rows, '2026-09-26')
  assert.ok(review.signals.some((signal) => signal.type === 'sleep_decline'))
  assert.ok(review.signals.every((signal) => signal.evidence.length > 0))
  assert.equal(actionablePersonalSignals(review.signals, { ...rows.at(-1), simulatedFields: ['sleepHours'] }).length, 0, 'simulated sleep cannot create personal follow-up')
  assert.ok(actionablePersonalSignals(review.signals, rows.at(-1)).length > 0, 'manual observation remains actionable')
  const emergency = reviewPersonal(rows, '2026-09-26', '我现在胸痛，呼吸困难')
  assert.equal(emergency.kind, 'escalation')
  assert.equal(emergency.safety?.ruleId, 'chest')
  assert.ok(emergency.safety?.message?.includes('就医'))
  const sample = [{ date: '2026-09-26', bedTime: '23:40', source: 'demo', simulatedFields: ['bedTime'], updatedAt: '2026-09-26' }]
  const latest = answerPersonalChat(sample, '2026-09-26', '昨晚几点入睡？')
  assert.ok(latest.answer.includes('23:40') && latest.answer.includes('模拟设备估计'))
  assert.ok(latest.evidence.some((item) => item.includes('模拟设备估计')))
  const unanswered = answerPersonalChat([], '2026-09-26', '昨晚几点入睡？')
  assert.ok(unanswered.answer.includes('还没有可用'))
  const safe = answerPersonalChat(sample, '2026-09-26', '我现在胸痛，想买助眠用品')
  assert.equal(safe.escalation, true)
  assert.ok(safe.answer.includes('就医') && !safe.answer.includes('用品'))
  const routine = answerPersonalChat(sample, '2026-09-26', '我想改善作息')
  const phone = answerPersonalChat(sample, '2026-09-26', '睡前总刷手机，怎么办')
  const pressure = answerPersonalChat(sample, '2026-09-26', '最近压力有点大')
  const products = answerPersonalChat(sample, '2026-09-26', '想看看适合我的睡眠产品')
  assert.notEqual(routine.answer, phone.answer, 'routine goal and phone barrier need different replies')
  assert.notEqual(phone.answer, pressure.answer, 'sleep barrier and stress need different replies')
  assert.match(products.answer, /模拟|方案/, 'product request should receive a clear, limited response')
  assert.ok(products.answer !== routine.answer, 'product request cannot fall through to routine fallback')
  console.log('personal review: 18 checks passed')
} finally { await server.close() }
