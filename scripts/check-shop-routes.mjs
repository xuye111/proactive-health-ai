import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

const values = new Map()
globalThis.window = { localStorage: {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
} }
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
try {
  const { default: Solutions } = await server.ssrLoadModule('/src/pages/Solutions.tsx')
  const { solutionOfferById } = await server.ssrLoadModule('/src/ai/solutions.ts')
  const { createMockOrder, completeMockOrder, saveMockOrders } = await server.ssrLoadModule('/src/lib/mockOrders.ts')
  const { recordPersonalSafety } = await server.ssrLoadModule('/src/lib/followUpStore.ts')
  const render = (url) => renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [url] }, React.createElement(Solutions)))
  assert.match(render('/solutions'), /逛逛健康方案/)
  assert.match(render('/solutions?item=sleep-mask'), /去确认订单/)
  assert.match(render('/solutions?item=sleep-mask&step=checkout&qty=3'), /数量 3/)
  const offer = solutionOfferById('sleep-mask')
  const pending = createMockOrder([], offer, 3, '2026-09-26T10:00:00+08:00')
  saveMockOrders([pending])
  assert.match(render('/solutions?view=payment&order=' + pending.id), /确认模拟付款/)
  const completed = completeMockOrder([pending], pending.id, '2026-09-26T10:01:00+08:00')
  saveMockOrders(completed)
  assert.match(render('/solutions?view=success&order=' + pending.id), /模拟订单已完成/)
  assert.match(render('/solutions?view=orders'), /演示已完成/)
  recordPersonalSafety({ ruleId: 'test-safety', label: '需要就医评估', evidence: ['胸痛'], message: '请及时就医' }, '2026-09-26T10:02:00+08:00')
  const blocked = render('/solutions?item=sleep-mask')
  assert.match(blocked, /暂停展示和下单/)
  assert.doesNotMatch(blocked, /去确认订单/)
  console.log('shop routes: 8 checks passed')
} finally { await server.close() }
