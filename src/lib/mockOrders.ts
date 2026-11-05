import { solutionCatalog, solutionOfferById } from '../ai/solutions'

export type MockOrder = {
  id: string
  itemId: string
  name: string
  kind: string
  unitPrice: number
  quantity: number
  total: number
  status: '待模拟付款' | '演示已完成'
  createdAt: string
  completedAt?: string
}

type Offer = (typeof solutionCatalog)[number]
const storageKey = 'pha.mock-orders.v1'

export function createMockOrder(orders: MockOrder[], offer: Offer, quantity: number, now: string): MockOrder {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9) throw new Error('演示订单数量应为 1–9 件')
  return {
    id: 'DEMO-' + now.replace(/\D/g, '').slice(0, 14) + '-' + (orders.length + 1),
    itemId: offer.id,
    name: offer.name,
    kind: offer.kind,
    unitPrice: offer.demoPrice,
    quantity,
    total: offer.demoPrice * quantity,
    status: '待模拟付款',
    createdAt: now,
  }
}

export function completeMockOrder(orders: MockOrder[], id: string, now: string): MockOrder[] {
  const order = orders.find((item) => item.id === id)
  if (!order) throw new Error('未找到模拟订单')
  if (order.status !== '待模拟付款') throw new Error('此订单已完成')
  return orders.map((item) => item.id === id ? { ...item, status: '演示已完成', completedAt: now } : item)
}

export function loadMockOrders(): MockOrder[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value): MockOrder[] => {
      if (!value || typeof value !== 'object') return []
      const row = value as Record<string, unknown>
      const offer = typeof row.itemId === 'string' ? solutionOfferById(row.itemId) : undefined
      if (!offer || typeof row.id !== 'string' || !Number.isInteger(row.quantity) || (row.quantity as number) < 1 || (row.quantity as number) > 9 ||
        (row.status !== '待模拟付款' && row.status !== '演示已完成') || typeof row.createdAt !== 'string') return []
      const quantity = row.quantity as number
      return [{
        id: row.id.slice(0, 50), itemId: offer.id, name: offer.name, kind: offer.kind,
        unitPrice: offer.demoPrice, quantity, total: offer.demoPrice * quantity,
        status: row.status, createdAt: row.createdAt.slice(0, 40),
        ...(typeof row.completedAt === 'string' ? { completedAt: row.completedAt.slice(0, 40) } : {}),
      }]
    }).slice(-100)
  } catch { return [] }
}

export function saveMockOrders(orders: MockOrder[]): void {
  window.localStorage.setItem(storageKey, JSON.stringify(orders.slice(-100)))
}
