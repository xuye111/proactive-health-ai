import { redFlagFor } from './safety'
import type { SignalType } from './types'

export const solutionTopics = ['sleep', 'activity', 'stress', 'nutrition'] as const
export type SolutionTopic = (typeof solutionTopics)[number]
export const topicLabels: Record<SolutionTopic, string> = {
  sleep: '睡眠与作息', activity: '日常活动', stress: '压力与放松', nutrition: '日常营养',
}
export const isSolutionTopic = (value: string | null): value is SolutionTopic =>
  value !== null && solutionTopics.some((topic) => topic === value)

/** 只识别明确的商品/服务咨询意图；健康感受本身不触发商品推荐。 */
export function recognizeSupportIntent(text: string): { topic: SolutionTopic | null } | null {
  if (unsafeSupportContext(text)) return null
  if (!/推荐|想买|购买|商城|产品|商品|保健品|营养品|补充剂|(?:想看|看看|了解).{0,10}(?:食品|服务|课程|设备|用品)|(?:有没有|有什么).{0,8}(课程|服务|用品|食品|设备)/.test(text)) return null
  const topic: SolutionTopic | null = /睡眠|作息|晚睡|熬夜|入睡|睡前|眼罩|遮光/.test(text) ? 'sleep'
    : /运动|活动|步数|锻炼|健身|弹力带/.test(text) ? 'activity'
      : /压力|情绪|放松|心情/.test(text) ? 'stress'
        : /营养|饮食|膳食|维生素|蛋白|保健品|营养品|补充剂/.test(text) ? 'nutrition' : null
  return { topic }
}

const unsafeSupportContext = (text: string): boolean => Boolean(redFlagFor(text)) || /治疗|治愈|根治|治病|预防疾病|缓解症状|失眠|贫血|糖尿病|高血压|低血压|肾病|肝病|心脏病|孕期|怀孕|哺乳|过敏|服药|疾病|症状/.test(text)

/** 仅用于演示的商品资料与金额；不代表真实商品、功效、销售或交付。 */
export const solutionCatalog = [
  { id: 'sleep-course', name: '睡眠习惯练习课', kind: '课程', topics: ['sleep'], demoPrice: 49 },
  { id: 'sleep-mask', name: '遮光睡眠眼罩', kind: '健康用品', topics: ['sleep'], demoPrice: 39 },
  { id: 'activity-band', name: '睡眠与活动记录手环', kind: '设备', topics: ['sleep', 'activity'], demoPrice: 69 },
  { id: 'activity-coaching', name: '日常活动陪练计划', kind: '服务', topics: ['activity'], demoPrice: 89 },
  { id: 'resistance-band', name: '轻量运动弹力带', kind: '健康用品', topics: ['activity'], demoPrice: 29 },
  { id: 'stress-course', name: '压力管理练习课', kind: '课程', topics: ['stress'], demoPrice: 39 },
  { id: 'basic-nutrition', name: '基础营养补充食品', kind: '营养食品', topics: ['nutrition'], demoPrice: 59 },
  { id: 'fiber-nutrition', name: '膳食纤维营养补充食品', kind: '营养食品', topics: ['nutrition'], demoPrice: 49 },
] as const

export const solutionOfferById = (id: string) => solutionCatalog.find((item) => item.id === id)

const firstStep: Partial<Record<SignalType, string>> = {
  sleep_decline: '先和小满确认睡眠变化，再选一个愿意尝试的作息调整。',
  bedtime_delay: '先确认最近的入睡时间，定一个可执行的节律目标。',
  activity_decline: '先确认活动变化和当天安排，再定一个适合自己的小目标。',
  stress_increase: '先说清近期压力来源，再选一个可以尝试的调整。',
  low_energy: '先和小满核对精力变化及伴随的不适，再决定下一步。',
  caffeine_late: '先记录今天饮用的时间和杯数，明天再回看变化。',
}

const signalTopic: Record<SignalType, SolutionTopic> = {
  sleep_decline: 'sleep', bedtime_delay: 'sleep', activity_decline: 'activity',
  stress_increase: 'stress', caffeine_late: 'sleep', low_energy: 'stress',
}

/** 对话附属卡：依据明确诉求与本人提供的状态选一个演示项目，不从模拟读数推断适用性。 */
export function companionSupport(text: string, context: { acceptedTarget?: string; sleepBarrier?: string; personalSignal?: SignalType; safety?: boolean } = {}): { offerId: string; reason: string } | null {
  if (context.safety || unsafeSupportContext(text)) return null
  const shopping = recognizeSupportIntent(text)
  const wantsHelp = /想改善|想调整|想建立|想试试|希望改善|改善.{0,8}(?:作息|睡眠|活动|压力)|有什么办法|怎么调整|怎么做|(?:睡眠|作息|晚睡|睡前|活动|运动|压力|放松).{0,12}怎么办|想找.{0,8}(?:方案|办法)|(?:想|需要).{0,12}(?:睡眠|作息|活动|运动|放松|压力).{0,4}方案/.test(text)
  if (!shopping && !wantsHelp) return null
  const topic = shopping?.topic ?? (/睡眠|作息|晚睡|熬夜|入睡|睡前|眼罩|遮光/.test(text) ? 'sleep'
    : /运动|活动|步数|锻炼|弹力带/.test(text) ? 'activity'
      : /压力|放松|情绪/.test(text) ? 'stress' : undefined)
    ?? (wantsHelp && context.personalSignal ? signalTopic[context.personalSignal] : undefined)
    ?? (wantsHelp && context.acceptedTarget ? 'sleep' : undefined)
  if (!topic || topic === 'nutrition') return null
  if (topic === 'sleep') {
    const lightConcern = /眼罩|遮光|灯光|光线|太亮|睡眠用品/.test(text)
    return {
      offerId: lightConcern ? 'sleep-mask' : 'sleep-course',
      reason: lightConcern ? '你提到睡前光线或用品需求，可以了解这个演示项目；先确认环境调整是否对你可行。'
        : /睡前.{0,8}(?:刷手机|看手机|玩手机)/.test(text) ? '你提到睡前使用手机。先确认最难放下手机的时段，再按需了解这项作息练习。'
          : context.sleepBarrier === '使用手机' ? '你此前记录了睡前使用手机。先试着安排放下手机的时间，也可了解这项作息练习。'
          : context.acceptedTarget ? `你已确认 ${context.acceptedTarget} 左右的入睡目标。先试一件睡前行动，也可了解这项作息练习。`
            : '你提到想调整作息。先选一件可执行的睡前行动，也可了解这项作息练习。',
    }
  }
  return topic === 'activity'
    ? { offerId: /弹力带|器材|用品/.test(text) ? 'resistance-band' : 'activity-coaching', reason: /运动|活动|步数|锻炼|弹力带/.test(text) ? '你提到想增加日常活动。先确定可执行的小目标，再按需了解这项演示项目。' : '结合你记录的活动变化，先核对近况并确定小目标，再按需了解这项演示项目。' }
    : { offerId: 'stress-course', reason: /压力|放松|情绪/.test(text) ? '你提到想调整压力或放松习惯。先确认近期压力来源，再按需了解这项演示课程。' : '结合你记录的近期变化，先核对感受和压力来源，再按需了解这项演示课程。' }
}

/** 安全事项优先；用户显式选的主题优先于模拟信号。 */
export function solutionContent(signal?: SignalType, safety = false, requestedTopic?: SolutionTopic) {
  if (safety) return { topic: undefined, step: '', offers: [] }
  const topic = requestedTopic ?? (signal ? signalTopic[signal] : undefined)
  return {
    topic,
    step: requestedTopic ? `先和小满确认你关注的${topicLabels[requestedTopic]}目标，再决定是否需要额外支持。`
      : signal ? firstStep[signal] ?? '先和小满确认变化，再定一个可执行的小目标。'
        : '告诉小满你最想改善的生活习惯，一起确定第一步。',
    offers: topic ? solutionCatalog.filter((item) => (item.topics as readonly string[]).includes(topic)) : solutionCatalog,
  }
}
