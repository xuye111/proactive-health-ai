import type { FollowUp } from '../ai/followUps'
import { createGoutFollowUp, isGoutFollowUp, type GoutStart } from '../ai/goutFollowUp'
import { useSyncExternalStore } from 'react'
import { upsertFollowUpFromSignal, upsertSafetyFollowUp, type SafetyEscalation } from '../ai/followUps'
import type { Signal } from '../ai/types'

export interface FollowUpStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const storageKey = 'pha.followUps.v1'

const isFollowUp = (value: unknown): value is FollowUp => {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.themeKey === 'string' && typeof item.topic === 'string' &&
    typeof item.firstDetectedAt === 'string' && typeof item.status === 'string' &&
    Array.isArray(item.evidence) && Array.isArray(item.events) &&
    (!Object.hasOwn(item, 'gout') || (item.gout !== undefined && isGoutFollowUp(item as unknown as FollowUp)))
}

/** 本机事项仓库。调用方可传入测试或兼容层 storage；不可用时返回空列表。 */
export function createFollowUpStore(storage: FollowUpStorage | undefined): { load: () => FollowUp[]; save: (items: FollowUp[]) => void; clear: () => void } {
  return {
    load: () => {
      if (storage === undefined) return []
      try {
        const raw = storage.getItem(storageKey)
        const parsed: unknown = raw === null ? [] : JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter(isFollowUp) : []
      } catch { return [] }
    },
    save: (items) => {
      if (storage === undefined) return
      try { storage.setItem(storageKey, JSON.stringify(items)) } catch { /* 隐私模式下保持当前页面状态 */ }
    },
    clear: () => {
      if (storage === undefined) return
      try { storage.removeItem(storageKey) } catch { /* storage unavailable */ }
    },
  }
}

const browserStorage = (() => { try { return typeof window === 'undefined' ? undefined : window.localStorage } catch { return undefined } })()
const repository = createFollowUpStore(browserStorage)

export const loadFollowUps = repository.load
export const saveFollowUps = repository.save
export const clearFollowUps = repository.clear

let current = repository.load()
const listeners = new Set<() => void>()
const subscribe = (listener: () => void): (() => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const commit = (items: FollowUp[]): void => { current = items; repository.save(items); listeners.forEach((listener) => listener()) }
export const useFollowUps = (): FollowUp[] => useSyncExternalStore(subscribe, () => current, () => current)
export const updateFollowUp = (id: string, update: (item: FollowUp) => FollowUp): void => {
  commit(current.map((item) => item.id === id ? update(item) : item))
}
/** 同一缓解记录或复查日只建立一轮事项；跨入口录入也复用已关联事项。 */
export const upsertPersonalGoutFollowUp = (items: FollowUp[], start: GoutStart, at: string): { items: FollowUp[]; changed: boolean } => {
  const candidate = createGoutFollowUp(start, at)
  const exists = items.some((item) => isGoutFollowUp(item) && (
    item.id === candidate.id ||
    (start.kind === 'scheduled' && item.gout.dueOn === start.dueOn)
  ))
  return exists ? { items, changed: false } : { items: [...items, candidate], changed: true }
}
export const startPersonalGoutFollowUp = (start: GoutStart, at: string): void => {
  const result = upsertPersonalGoutFollowUp(current, start, at)
  if (result.changed) commit(result.items)
}
export const syncPersonalFollowUps = (signals: Signal[], at: string): void => {
  let items = current
  let changed = false
  for (const signal of signals.filter((item) => item.severity !== 'info')) {
    const result = upsertFollowUpFromSignal(items, signal, at)
    items = result.items
    changed ||= result.changed
  }
  if (changed) commit(items)
}
export const clearPersonalFollowUps = (): void => { repository.clear(); current = []; listeners.forEach((listener) => listener()) }
export const recordPersonalSafety = (safety: SafetyEscalation, at: string): void => {
  const result = upsertSafetyFollowUp(current, safety, at)
  if (result.changed) commit(result.items)
}
