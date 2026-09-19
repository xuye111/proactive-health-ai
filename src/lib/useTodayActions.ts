import { useCallback, useEffect, useState } from 'react'

/**
 * 今日行动的勾选状态：首页与计划页共用同一份，按日期分桶存在 localStorage。
 * 第一阶段没有后端，这是唯一需要跨页共享的状态。
 */
const keyFor = (date: string) => `pha.todayActions.v1.${date}`

const readStored = (date: string): Record<string, boolean> => {
  try {
    const raw = window.localStorage.getItem(keyFor(date))
    return raw === null ? {} : (JSON.parse(raw) as Record<string, boolean>)
  } catch {
    return {}
  }
}

export function useTodayActions(date: string, ids: string[]) {
  const [done, setDone] = useState<Record<string, boolean>>(() => readStored(date))

  useEffect(() => {
    setDone(readStored(date))
  }, [date])

  useEffect(() => {
    try {
      window.localStorage.setItem(keyFor(date), JSON.stringify(done))
    } catch {
      /* 隐私模式下写入失败不影响使用 */
    }
  }, [date, done])

  const toggle = useCallback((id: string) => {
    setDone((previous) => ({ ...previous, [id]: previous[id] !== true }))
  }, [])

  const completed = ids.filter((id) => done[id] === true).length

  return { done, toggle, completed, total: ids.length }
}
