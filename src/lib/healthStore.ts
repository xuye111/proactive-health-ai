import { useSyncExternalStore } from 'react'
import rawRecords from '../data/healthRecords.json'
import type { DailyRecord } from '../types'
import { clockMinutes, type SleepConflict, type SleepPreferences } from '../ai/sleepPlan'

export type DailyObservation = Partial<Omit<DailyRecord, 'date'>> & {
  date: string
  sleepBarrier?: string
  source: 'demo' | 'manual'
  updatedAt: string
  /** 合并后仍由模拟设备填充的字段，避免将其误认作本人测量。 */
  simulatedFields?: string[]
}
export interface HealthState {
  records: DailyObservation[]
  profile: { displayName: string; birthYear?: number; heightCm?: number; focus: string }
  goals: { sleepHours: number; activeMinutes: number }
  sleepPreferences: SleepPreferences
  sleepConflicts: SleepConflict[]
  sleepRoutine: { preparationDoneOn?: string; morningFeedbackOn?: string; morningFeedbackSkipped?: boolean; morningFeedbackHistory: Array<{ date: string; skipped: boolean }> }
  remindersPaused: boolean
  revision: number
}

const storageKey = 'pha.health.v2'
const sampleRows = rawRecords as DailyRecord[]
const listeners = new Set<() => void>()
const numericRanges: Record<string, [number, number]> = {
  sleepHours: [0, 24], sleepScore: [0, 100], steps: [0, 100000], activeMinutes: [0, 1440],
  waterMl: [0, 10000], caffeineCups: [0, 20], energy: [1, 5], stress: [1, 5],
  mood: [1, 5], weightKg: [0, 500],
  restingHeartRate: [1, 300], bloodPressureSystolic: [1, 300], bloodPressureDiastolic: [1, 250],
}

export const localDate = (date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** 事件时间保留本机时区，日期前缀和“今天/回访日”使用同一口径。 */
export const localTimestamp = (date = new Date()): string => {
  const pad = (value: number): string => String(value).padStart(2, '0')
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  return `${localDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, '0')}${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
}

export const createEmptyState = (): HealthState => ({
  records: [], profile: { displayName: '', focus: '' }, goals: { sleepHours: 7, activeMinutes: 30 }, sleepPreferences: {}, sleepConflicts: [], sleepRoutine: { morningFeedbackHistory: [] }, remindersPaused: false, revision: 0,
})

export function validatePatch(patch: Record<string, unknown>): Partial<DailyObservation> {
  const valid: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === '') continue
    if (key in numericRanges) {
      const [min, max] = numericRanges[key]
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
        throw new Error(`${key} 不在有效范围内`)
      valid[key] = value
    } else if (key === 'bedTime' || key === 'wakeTime') {
      if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
        throw new Error(`${key} 时间格式无效`)
      valid[key] = value
    } else if (key === 'sleepBarrier') {
      if (typeof value !== 'string' || !['睡前事务', '使用手机', '到了时间不困', '其他', '无明显阻碍'].includes(value)) throw new Error('睡前阻碍无效')
      valid[key] = value
    } else if (key === 'meals') {
      if (typeof value !== 'object' || value === null ||
        !['breakfast', 'lunch', 'dinner'].every((meal) => typeof (value as Record<string, unknown>)[meal] === 'boolean'))
        throw new Error('meals 格式无效')
      valid[key] = value
    } else throw new Error(`${key} 不是可记录字段`)
  }
  return valid as Partial<DailyObservation>
}

const load = (): HealthState => {
  const base = createEmptyState()
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null')
    if (typeof parsed !== 'object' || parsed === null) return base
    const data = parsed as Record<string, unknown>
    const records = Array.isArray(data.records) ? data.records.flatMap((item): DailyObservation[] => {
      if (typeof item !== 'object' || item === null) return []
      const row = item as Record<string, unknown>
      if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return []
      try { return [{ ...validatePatch(Object.fromEntries(Object.entries(row).filter(([key]) => !['date', 'source', 'updatedAt'].includes(key)))), date: row.date, source: 'manual', updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : row.date }] }
      catch { return [] }
    }) : []
    const goals = typeof data.goals === 'object' && data.goals !== null ? data.goals as Record<string, unknown> : {}
    const profile = typeof data.profile === 'object' && data.profile !== null ? data.profile as Record<string, unknown> : {}
    const preference = typeof data.sleepPreferences === 'object' && data.sleepPreferences !== null ? data.sleepPreferences as Record<string, unknown> : {}
    const routine = typeof data.sleepRoutine === 'object' && data.sleepRoutine !== null ? data.sleepRoutine as Record<string, unknown> : {}
    const validRoutineDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    const feedbackHistory = Array.isArray(routine.morningFeedbackHistory) ? routine.morningFeedbackHistory.flatMap((item): Array<{ date: string; skipped: boolean }> => {
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      return validRoutineDate(row.date) ? [{ date: row.date, skipped: row.skipped === true }] : []
    }).slice(-30) : []
    if (validRoutineDate(routine.morningFeedbackOn) && !feedbackHistory.some((item) => item.date === routine.morningFeedbackOn)) feedbackHistory.push({ date: routine.morningFeedbackOn, skipped: routine.morningFeedbackSkipped === true })
    const sleepRoutine: HealthState['sleepRoutine'] = {
      ...(validRoutineDate(routine.preparationDoneOn) ? { preparationDoneOn: routine.preparationDoneOn } : {}),
      ...(validRoutineDate(routine.morningFeedbackOn) ? { morningFeedbackOn: routine.morningFeedbackOn, morningFeedbackSkipped: routine.morningFeedbackSkipped === true } : {}),
      morningFeedbackHistory: feedbackHistory.slice(-30),
    }
    const sleepPreferences: SleepPreferences = {
      ...(typeof preference.wakeConstraint === 'string' && clockMinutes(preference.wakeConstraint) !== null ? { wakeConstraint: preference.wakeConstraint } : {}),
      ...(typeof preference.acceptedTarget === 'string' && clockMinutes(preference.acceptedTarget) !== null ? { acceptedTarget: preference.acceptedTarget } : {}),
      ...(typeof preference.acceptedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(preference.acceptedAt) ? { acceptedAt: preference.acceptedAt } : {}),
      ...(typeof preference.barrier === 'string' ? { barrier: preference.barrier.slice(0, 40) } : {}),
    }
    const sleepConflicts: SleepConflict[] = Array.isArray(data.sleepConflicts) ? data.sleepConflicts.flatMap((item): SleepConflict[] => {
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || typeof row.deviceTime !== 'string' || clockMinutes(row.deviceTime) === null || typeof row.reportedTime !== 'string' || clockMinutes(row.reportedTime) === null || (row.confirmations !== 1 && row.confirmations !== 2)) return []
      return [{ date: row.date, deviceTime: row.deviceTime, reportedTime: row.reportedTime, confirmations: row.confirmations, status: row.confirmations === 2 ? '尊重本人反馈' : '待再次核对', firstConfirmedAt: typeof row.firstConfirmedAt === 'string' ? row.firstConfirmedAt : row.date }]
    }).slice(-30) : []
    const currentYear = new Date().getFullYear()
    return { records, profile: { displayName: typeof profile.displayName === 'string' ? profile.displayName.slice(0, 30) : '', focus: typeof profile.focus === 'string' ? profile.focus.slice(0, 120) : '', ...(typeof profile.birthYear === 'number' && Number.isInteger(profile.birthYear) && profile.birthYear >= 1900 && profile.birthYear <= currentYear ? { birthYear: profile.birthYear } : {}), ...(typeof profile.heightCm === 'number' && profile.heightCm >= 50 && profile.heightCm <= 250 ? { heightCm: profile.heightCm } : {}) }, goals: { sleepHours: typeof goals.sleepHours === 'number' && goals.sleepHours >= 4 && goals.sleepHours <= 12 ? goals.sleepHours : 7, activeMinutes: typeof goals.activeMinutes === 'number' && goals.activeMinutes >= 5 && goals.activeMinutes <= 180 ? goals.activeMinutes : 30 }, sleepPreferences, sleepConflicts, sleepRoutine, remindersPaused: data.remindersPaused === true, revision: 0 }
  } catch { return base }
}

let state = load()
let observedDate = localDate()
const checkDate = (): void => { const next = localDate(); if (next !== observedDate) { observedDate = next; refreshLocalDay() } }
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  if (typeof window !== 'undefined' && listeners.size === 1) {
    window.addEventListener('focus', checkDate)
    document.addEventListener('visibilitychange', checkDate)
  }
  return () => {
    listeners.delete(listener)
    if (typeof window !== 'undefined' && listeners.size === 0) {
      window.removeEventListener('focus', checkDate)
      document.removeEventListener('visibilitychange', checkDate)
    }
  }
}
const publish = (next: HealthState): void => {
  state = { ...next, revision: state.revision + 1 }
  try { window.localStorage.setItem(storageKey, JSON.stringify(state)) } catch { /* storage unavailable */ }
  listeners.forEach((listener) => listener())
}

export function useHealthState(): HealthState {
  return useSyncExternalStore(subscribe, () => state, () => state)
}
export const getHealthState = (): HealthState => state
export const activeDate = (_value: HealthState): string => localDate()
const utcDay = (date: string): number => Date.parse(`${date}T00:00:00Z`) / 86400000
/** 固定演示锚点：同一日总对应同一条样例，当前演示日对应样例趋势的最后一天。 */
const sampleAnchorDay = utcDay('2026-09-26')
const sampleFor = (date: string): DailyObservation => {
  const dayIndex = utcDay(date) - sampleAnchorDay + sampleRows.length - 1
  const sample = sampleRows[((dayIndex % sampleRows.length) + sampleRows.length) % sampleRows.length]
  const { date: _originalDate, ...values } = sample
  return { ...values, date, source: 'demo', updatedAt: `${date}T08:00:00`, simulatedFields: Object.keys(values) }
}
export const deviceRecordFor = (date: string): DailyObservation | undefined => {
  const offset = utcDay(activeDate(state)) - utcDay(date)
  return offset >= 0 && offset < 30 ? sampleFor(date) : undefined
}
export const effectiveRecords = (value: HealthState): DailyObservation[] => {
  const end = utcDay(activeDate(value))
  const days = Array.from({ length: 30 }, (_, index) => new Date((end - 29 + index) * 86400000).toISOString().slice(0, 10))
  const dates = new Set([...days, ...value.records.filter((row) => row.date <= activeDate(value)).map((row) => row.date)])
  return [...dates].sort().map((date) => {
    const sample = days.includes(date) ? sampleFor(date) : undefined
    const manual = value.records.find((row) => row.date === date)
    if (!manual) return sample as DailyObservation
    if (!sample) return manual
    const manualKeys = Object.keys(manual).filter((key) => !['date', 'source', 'updatedAt', 'simulatedFields'].includes(key))
    return { ...sample, ...manual, source: 'manual', simulatedFields: sample.simulatedFields?.filter((key) => !manualKeys.includes(key)) }
  })
}
export const activeRecord = (value: HealthState): DailyObservation | undefined =>
  effectiveRecords(value).find((row) => row.date === activeDate(value))
export function setRemindersPaused(paused: boolean): void { publish({ ...state, remindersPaused: paused }) }
export function markSleepPreparation(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date !== localDate()) throw new Error('准备日期无效')
  publish({ ...state, sleepRoutine: { ...state.sleepRoutine, preparationDoneOn: date } })
}
export function markMorningFeedback(date: string, skipped = false): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date !== localDate()) throw new Error('反馈日期无效')
  const history = [...state.sleepRoutine.morningFeedbackHistory.filter((item) => item.date !== date), { date, skipped }].slice(-30)
  publish({ ...state, sleepRoutine: { ...state.sleepRoutine, morningFeedbackOn: date, morningFeedbackSkipped: skipped, morningFeedbackHistory: history } })
}
export function setPersonalProfile(profile: HealthState['profile']): void {
  const displayName = profile.displayName.trim()
  const focus = profile.focus.trim()
  const currentYear = new Date().getFullYear()
  if (displayName.length > 30 || focus.length > 120 || (profile.birthYear !== undefined && (!Number.isInteger(profile.birthYear) || profile.birthYear < 1900 || profile.birthYear > currentYear)) || (profile.heightCm !== undefined && (!Number.isFinite(profile.heightCm) || profile.heightCm < 50 || profile.heightCm > 250))) throw new Error('个人资料不在有效范围内')
  publish({ ...state, profile: { displayName, focus, ...(profile.birthYear === undefined ? {} : { birthYear: profile.birthYear }), ...(profile.heightCm === undefined ? {} : { heightCm: profile.heightCm }) } })
}
export function setHealthGoals(goals: HealthState['goals']): void {
  if (!Number.isFinite(goals.sleepHours) || goals.sleepHours < 4 || goals.sleepHours > 12 || !Number.isFinite(goals.activeMinutes) || goals.activeMinutes < 5 || goals.activeMinutes > 180) throw new Error('目标不在有效范围内')
  publish({ ...state, goals })
}
export function setSleepPreferences(preferences: SleepPreferences): void {
  if ((preferences.wakeConstraint && clockMinutes(preferences.wakeConstraint) === null) || (preferences.acceptedTarget && clockMinutes(preferences.acceptedTarget) === null) || (preferences.barrier && preferences.barrier.length > 40) || (preferences.acceptedAt && !/^\d{4}-\d{2}-\d{2}T/.test(preferences.acceptedAt))) throw new Error('作息资料不在有效范围内')
  publish({ ...state, sleepPreferences: preferences })
}
export function recordSleepConflict(conflict: Pick<SleepConflict, 'date' | 'deviceTime' | 'reportedTime'>): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(conflict.date) || clockMinutes(conflict.deviceTime) === null || clockMinutes(conflict.reportedTime) === null) throw new Error('入睡时间格式无效')
  const first: SleepConflict = { ...conflict, confirmations: 1, status: '待再次核对', firstConfirmedAt: localTimestamp() }
  publish({ ...state, sleepConflicts: [...state.sleepConflicts.filter((item) => item.date !== conflict.date), first].slice(-30) })
}
export function confirmSleepConflict(date: string): void {
  publish({ ...state, sleepConflicts: state.sleepConflicts.map((item) => item.date === date ? { ...item, confirmations: 2, status: '尊重本人反馈' } : item) })
}
export function clearSleepConflict(date: string): void {
  if (state.sleepConflicts.some((item) => item.date === date)) publish({ ...state, sleepConflicts: state.sleepConflicts.filter((item) => item.date !== date) })
}
export function saveDailyRecord(date: string, patch: Record<string, unknown>): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > localDate()) throw new Error('记录日期无效')
  const valid = validatePatch(patch)
  const previous = state.records.find((row) => row.date === date)
  const next: DailyObservation = { ...previous, ...valid, date, source: 'manual', updatedAt: new Date().toISOString() }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === '') {
      if (!(key in numericRanges) && key !== 'bedTime' && key !== 'wakeTime' && key !== 'sleepBarrier' && key !== 'meals') throw new Error(`${key} 不是可记录字段`)
      delete (next as Record<string, unknown>)[key]
    }
  }
  publish({ ...state, records: [...state.records.filter((row) => row.date !== date), next].sort((a, b) => a.date.localeCompare(b.date)) })
}
export function clearPersonalRecords(): void { publish({ ...state, records: [], sleepConflicts: [] }) }
export function refreshLocalDay(): void { publish(state) }
