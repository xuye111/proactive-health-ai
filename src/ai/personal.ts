import type { DailyObservation } from '../lib/healthStore'
import type { Signal } from './types'
import { redFlagFor } from './safety'
import { SIGNAL_THRESHOLDS } from './signals'
import type { SafetyEscalation } from './followUps'
import { SLEEP_GUIDANCE, suggestSleepPlan, type SleepConflict, type SleepPreferences } from './sleepPlan'
import { recognizeSupportIntent, topicLabels } from './solutions'

export interface PersonalReview {
  kind: 'missing' | 'watch' | 'recorded' | 'escalation'
  summary: string
  signals: Signal[]
  answer?: string
  safety?: SafetyEscalation
}

export interface PersonalChatReply {
  answer: string
  evidence: string[]
  escalation: boolean
  safety?: SafetyEscalation
}

/** 当前用户端的对话入口：安全检查、本人/模拟来源核对、规则回答共用同一批记录。 */
export function answerPersonalChat(records: DailyObservation[], date: string, question: string, sleepPreferences: SleepPreferences = {}, sleepConflicts: SleepConflict[] = []): PersonalChatReply {
  const review = reviewPersonal(records, date, question, sleepPreferences, sleepConflicts)
  if (review.safety) return { answer: review.answer ?? review.safety.message ?? review.summary, evidence: review.safety.evidence, escalation: true, safety: review.safety }

  const recent = records.filter((record) => record.date <= date && record.bedTime).sort((a, b) => b.date.localeCompare(a.date))[0]
  const plan = suggestSleepPlan(records.filter((record) => record.date <= date), sleepPreferences, sleepConflicts)
  const asksPast = /(?:最近|昨晚|昨天|今天|上次).{0,8}(?:几点|何时|什么时候|入睡时间|睡觉时间)|(?:昨晚|昨天|上次).{0,8}(?:睡|入睡)/.test(question)
  const asksTarget = !asksPast && /(?:入睡|睡觉|作息|睡眠).{0,12}(?:目标|建议|几点|时间)|(?:目标|建议|几点).{0,12}(?:入睡|睡觉|作息)/.test(question)
  if (asksTarget) return {
    answer: review.answer ?? review.summary,
    evidence: [plan.count ? `参考最近 ${plan.count} 晚入睡记录${records.some((row) => row.simulatedFields?.includes('bedTime')) ? '，其中包含模拟设备估计' : ''}` : '可用入睡记录不足 3 晚', `公共建议原则：${SLEEP_GUIDANCE.title}；具体时间为演示规则`],
    escalation: false,
  }
  if (asksPast) {
    if (!recent) return { answer: '还没有可用的入睡时间记录。你可以告诉我最近一次大约几点入睡，我会先请你确认再保存。', evidence: ['本机记录：暂无可用入睡时间'], escalation: false }
    const source = recent.simulatedFields?.includes('bedTime') ? '模拟设备估计' : '本人记录'
    const conflicted = sleepConflicts.some((item) => item.date === recent.date && item.status === '待再次核对')
    return {
      answer: `最近一条是 ${recent.date} ${recent.bedTime}（${source}）。${conflicted ? '这晚的设备估计与你的反馈有差异，仍待再次核对。' : source === '模拟设备估计' ? '它只能作为演示读数；实际入睡时间请以你的反馈核对。' : '如果与你的记忆不同，可以在健康记录中修改。'}`,
      evidence: [`${recent.date} 入睡时间 ${recent.bedTime} · ${source}`],
      escalation: false,
    }
  }
  const productIntent = recognizeSupportIntent(question)
  if (productIntent || /(?:睡眠|作息|运动|活动|放松|压力).{0,12}方案|方案.{0,12}(?:睡眠|作息|运动|活动|放松|压力)/.test(question)) {
    const topic = productIntent?.topic ?? (/睡眠|作息/.test(question) ? 'sleep' : /运动|活动/.test(question) ? 'activity' : /放松|压力/.test(question) ? 'stress' : null)
    return {
      answer: topic ? `你想了解${topicLabels[topic]}方面的支持。我可以展示一个相关的模拟项目，先从你想调整的具体习惯看起；项目是否适合你，目前还无法判断。` : '你想找哪一类支持：作息、日常活动，还是压力与放松？告诉我主题后，我再展示对应的演示项目。',
      evidence: ['项目仅为本机演示；没有核验个体适用性或实际服务效果'], escalation: false,
    }
  }
  if (/(?:睡前|晚上|夜里).{0,12}(?:刷手机|看手机|玩手机)|(?:刷手机|看手机|玩手机).{0,12}(?:睡前|晚上)/.test(question)) return {
    answer: `你提到睡前使用手机。${plan.target ? `你确认的入睡目标是 ${plan.target} 左右；` : ''}先看看最近通常几点放下手机，再挑一个你愿意尝试的准备动作。你觉得最难放下手机的是哪段时间？`,
    evidence: ['睡前使用手机来自你这次的描述；设备不能判断原因', plan.target ? `已确认的入睡目标 ${plan.target}` : '尚无已确认的入睡目标'], escalation: false,
  }
  if (/(?:改善|调整|改变|想要|希望).{0,10}(?:作息|晚睡|熬夜|早睡)|(?:作息|晚睡|熬夜|早睡).{0,10}(?:改善|调整|怎么办)/.test(question)) return {
    answer: plan.target ? `先围绕 ${plan.target} 左右的入睡目标，选一件今晚做得到的准备动作。${plan.action}你通常几点结束晚间事务？` : '想调整作息，可以先告诉我你平时必须几点起床、最近大约几点入睡。我会根据这些记录提出一个可讨论的目标，不会只凭模拟读数定时间。',
    evidence: [plan.target ? `当前${plan.source}：${plan.target}` : '入睡目标资料不足，需要起床约束与近期记录'], escalation: false,
  }
  if (/压力|紧张|烦躁|放松/.test(question)) return {
    answer: '听到你说最近有压力。先确认一下：主要是睡前想事情停不下来，还是白天的事务拖到了晚上？你愿意说哪一部分，我们就先处理哪一部分。',
    evidence: ['压力感受来自你的反馈；设备读数不能说明压力来源'], escalation: false,
  }
  if (/运动|活动|步数|锻炼/.test(question)) return {
    answer: '你想聊日常活动。我可以先看已有记录，再和你定一个这周能做到的小动作。最近是时间不够、体力不足，还是不知道从哪里开始？',
    evidence: [recent ? `最近可用记录日期：${recent.date}；不以睡眠记录推断活动能力` : '尚无足够活动记录可用于个体建议'], escalation: false,
  }
  if (/(?:睡不着|睡不好|晚睡|熬夜|不困|夜醒|醒来)/.test(question)) return {
    answer: `我先了解实际情况：最近几晚是到了计划时间不困、睡前事务结束得晚，还是夜里醒来？${plan.target ? `目前的入睡目标是 ${plan.target} 左右，` : ''}你可以告诉我最近一次发生在什么时候。`,
    evidence: [plan.target ? `当前${plan.source}：${plan.target}；依据最近 ${plan.count} 晚记录` : '入睡目标资料不足', '具体原因需要本人反馈，不能从模拟读数推断'],
    escalation: false,
  }
  return {
    answer: '我还不确定你想先解决什么。可以告诉我：想核对昨晚的记录、调整入睡目标，还是找一个可尝试的生活方案？我会按你选的方向继续。',
    evidence: review.signals.length ? review.signals.flatMap((signal) => signal.evidence).slice(0, 3) : [recent ? `最近一条入睡记录：${recent.date} · ${recent.simulatedFields?.includes('bedTime') ? '模拟设备估计' : '本人记录'}` : '本机暂无可用入睡记录'],
    escalation: false,
  }
}

const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length
const hasNumber = (value: number | undefined): value is number => typeof value === 'number' && Number.isFinite(value)

/** 模拟值可以展示趋势，但不能据此创建用户自己的持续事项。 */
export function actionablePersonalSignals(signals: Signal[], current?: DailyObservation): Signal[] {
  const fieldFor = { sleep_decline: 'sleepHours', bedtime_delay: 'bedTime', activity_decline: 'steps', stress_increase: 'stress', caffeine_late: 'caffeineCups', low_energy: 'energy' } as const
  return signals.filter((signal) => current?.source === 'manual' && !current.simulatedFields?.includes(fieldFor[signal.type]))
}

/** 单一记录流：模拟字段只用于体验变化识别，结论明确标注来源。 */
export function reviewPersonal(records: DailyObservation[], date: string, question?: string, sleepPreferences: SleepPreferences = {}, sleepConflicts: SleepConflict[] = []): PersonalReview {
  if (question) {
    const flag = redFlagFor(question)
    if (flag) return { kind: 'escalation', summary: flag.label, signals: [], answer: flag.escalationText, safety: { ruleId: flag.id, label: flag.label, evidence: flag.evidence, message: flag.escalationText } }
  }
  const days = records.filter((record) => record.date <= date).sort((a, b) => a.date.localeCompare(b.date))
  if (question && /(?:入睡|睡觉|作息|睡眠).{0,12}(?:目标|建议|几点|时间)|(?:目标|建议|几点).{0,12}(?:入睡|睡觉|作息)/.test(question)) {
    const plan = suggestSleepPlan(days, sleepPreferences, sleepConflicts)
    return { kind: plan.target ? 'recorded' : 'missing', summary: plan.reason, signals: [], answer: plan.target
      ? `我建议先以 ${plan.target} 左右入睡为目标。${plan.reason}${plan.action}依据是${SLEEP_GUIDANCE.title}关于规律作息的原则；具体时间由你的近期记录推算，属于待复核的演示建议，不保证到点睡着。你可以在「我的 → 我的入睡目标」补充起床安排并确认。`
      : `${plan.reason}你可以先补充近期记录；我不会在资料不足时猜一个时间。` }
  }
  const current = days.find((record) => record.date === date)
  const simulated = days.some((record) => (record.simulatedFields?.length ?? 0) > 0)
  const sourceNote = simulated ? '（含模拟设备数据）' : ''
  const signals: Signal[] = []
  const priorSleep = days.filter((record) => record.date < date && hasNumber(record.sleepHours)).map((record) => record.sleepHours as number)
  const last3 = days.filter((record) => record.date <= date && hasNumber(record.sleepHours)).slice(-3)
  if (priorSleep.length >= 3 && last3.length === 3 && last3[2].date === date) {
    const baseline = mean(priorSleep)
    const average = mean(last3.map((record) => record.sleepHours as number))
    if (baseline > 0 && average / baseline < SIGNAL_THRESHOLDS.sleepWatch) signals.push({
      type: 'sleep_decline', label: '近期睡眠较个人记录下降',
      severity: average / baseline < SIGNAL_THRESHOLDS.sleepAlert ? 'alert' : 'watch',
      evidence: [`近 3 次有效记录均值 ${average.toFixed(1)} 小时`, `此前 ${priorSleep.length} 次均值 ${baseline.toFixed(1)} 小时`, `截至 ${date}`],
      rule: `近 3 次有效记录均值 < 既有记录均值 × ${SIGNAL_THRESHOLDS.sleepWatch}`,
    })
  }
  if (hasNumber(current?.stress) && current.stress >= SIGNAL_THRESHOLDS.stressWatch) signals.push({
    type: 'stress_increase', label: '自评压力偏高', severity: current.stress >= 5 ? 'alert' : 'watch',
    evidence: [`${date} 自评压力 ${current.stress}/5`], rule: `主观压力 ≥ ${SIGNAL_THRESHOLDS.stressWatch}`,
  })
  if (hasNumber(current?.energy) && current.energy <= SIGNAL_THRESHOLDS.energyWatch) signals.push({
    type: 'low_energy', label: '自评精力偏低', severity: 'watch',
    evidence: [`${date} 自评精力 ${current.energy}/5`], rule: `主观精力 ≤ ${SIGNAL_THRESHOLDS.energyWatch}`,
  })
  if (hasNumber(current?.caffeineCups) && current.caffeineCups >= SIGNAL_THRESHOLDS.caffeineWatch) signals.push({
    type: 'caffeine_late', label: '咖啡因摄入偏多', severity: 'watch',
    evidence: [`${date} 记录 ${current.caffeineCups} 杯`], rule: `当日咖啡因 ≥ ${SIGNAL_THRESHOLDS.caffeineWatch} 杯`,
  })
  if (!current || Object.keys(current).every((key) => ['date', 'source', 'updatedAt'].includes(key))) return {
    kind: 'missing', summary: '今天还没有可用记录。补充睡眠、活动与感受后，我才能跟进变化。', signals,
    ...(question ? { answer: '当前没有足够的本人记录回答这个问题。你可以先补录数据；症状持续或加重时请咨询专业人员。' } : {}),
  }
  return signals.length ? {
    kind: 'watch', summary: `发现 ${signals.length} 项值得确认的记录变化${sourceNote}`, signals,
    ...(question ? { answer: `我目前看到：${signals.map((signal) => signal.label).join('、')}${sourceNote}。模拟读数只供体验；如有明显不适，请联系专业人员。` } : {}),
  } : {
    kind: 'recorded', summary: `已更新今天的状态${sourceNote}；目前没有足够依据提示持续变化。`, signals,
    ...(question ? { answer: `已收到你的问题。当前记录${sourceNote}不足以作出个体化判断；可以继续记录变化，必要时咨询专业人员。` } : {}),
  }
}
