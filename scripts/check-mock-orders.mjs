import assert from 'node:assert/strict'
import { createServer } from 'vite'

const values = new Map()
globalThis.window = { localStorage: {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
} }
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
try {
  const { solutionOfferById } = await server.ssrLoadModule('/src/ai/solutions.ts')
  const { createMockOrder, completeMockOrder, loadMockOrders, saveMockOrders } = await server.ssrLoadModule('/src/lib/mockOrders.ts')
  const item = solutionOfferById('sleep-mask')
  assert.ok(item)
  assert.throws(() => createMockOrder([], item, 0, '2026-09-26T10:00:00+08:00'))
  assert.throws(() => createMockOrder([], item, 10, '2026-09-26T10:00:00+08:00'))
  const order = createMockOrder([], item, 2, '2026-09-26T10:00:00+08:00')
  assert.equal(order.total, item.demoPrice * 2)
  assert.equal(order.status, '待模拟付款')
  saveMockOrders([order])
  assert.equal(loadMockOrders()[0].id, order.id)
  const done = completeMockOrder(loadMockOrders(), order.id, '2026-09-26T10:01:00+08:00')
  assert.equal(done[0].status, '演示已完成')
  assert.throws(() => completeMockOrder(done, order.id, '2026-09-26T10:02:00+08:00'))
  saveMockOrders(done)
  assert.equal(loadMockOrders()[0].status, '演示已完成')
  values.set('pha.mock-orders.v1', JSON.stringify([{ ...order, itemId: 'unknown' }]))
  assert.deepEqual(loadMockOrders(), [])
  console.log('mock orders: 9 checks passed')
} finally { await server.close() }
