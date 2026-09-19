import { redFlagFor } from '../ai/safety'
import type { Signal } from '../ai/types'

/**
 * UI 适配层：把 AI 层的输出翻译成页面直接可用的视图模型。
 *
 * 判断逻辑已经全部搬到 `src/ai/`（信号 / 上下文 / provider / 守门 / 编排），
 * 这里只剩「UI 文案常量」与「hook 转发」。好处是换 provider、改流水线都不会动页面。
 */

export {
  useTodayPlan,
  useAnswerView,
  useMemoryEntries,
  useDailyRun,
  type DailyPlanView,
  type AnswerView,
} from '../ai/hooks'

/** 输出分级的中文名（与「数据与安全」页的四级定义一致）。 */
export const LEVEL_LABEL: Record<'lifestyle' | 'information' | 'alert' | 'escalation', string> = {
  lifestyle: '健康生活建议',
  information: '健康知识解释',
  alert: '健康风险提示',
  escalation: '建议进一步医疗咨询',
}

/** 快捷提问：规则实现答不了任意问题，就把能答的摆出来。 */
export const ASK_SUGGESTIONS: Array<{ id: string; label: string }> = [
  { id: 'exercise', label: '今天适合运动吗' },
  { id: 'dinner', label: '今晚晚饭怎么吃' },
  { id: 'tired', label: '我为什么最近总觉得累' },
  { id: 'pressure', label: '睡不好会影响血压吗' },
]

/**
 * 开场证据条：直接取自信号层，保证界面展示的事实与判断用的是同一批信号。
 * 传信号数组而不是自己去读数据，避免这里再复制一份「什么算依据」的逻辑。
 */
export function healthEvidence(signals: Signal[]): string[] {
  return signals.flatMap((signal) => signal.evidence).slice(0, 4)
}

/** 提问入库时用的粗粒度路由标签（真正的路由结果在 Trace 里）。 */
export function askKeyFor(text: string): string {
  return redFlagFor(text)?.id ?? 'question'
}

export { redFlagFor } from '../ai/safety'
