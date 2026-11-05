import { useState } from 'react'
import { SectionTitle } from '../../components/SectionTitle'
import { activeDate, effectiveRecords, useHealthState } from '../../lib/healthStore'
import { sleepPlanProgress, suggestSleepPlan } from '../../ai/sleepPlan'
import { useFollowUps } from '../../lib/followUpStore'

const RANGES = [7, 30] as const
type Range = (typeof RANGES)[number]

export default function TrendsPanel() {
  const health = useHealthState()
  const [range, setRange] = useState<Range>(7)
  const records = effectiveRecords(health)
  const end = Date.parse(`${activeDate(health)}T12:00:00Z`)
  const inRange = (date?: string): boolean => typeof date === 'string' && Date.parse(`${date}T12:00:00Z`) >= end - (range - 1) * 86400000
  const shown = records.filter((record) => inRange(record.date))
  const sleepPlan = suggestSleepPlan(records, health.sleepPreferences, health.sleepConflicts)
  const progress = sleepPlanProgress(shown, sleepPlan.target, health.sleepConflicts)
  const items = useFollowUps()
  return <div className="space-y-5 px-4 pt-4">
    <div className="flex gap-2">{RANGES.map((option) => <button key={option} type="button" aria-pressed={range === option} onClick={() => setRange(option)} className={`rounded-lg px-3 py-1 text-[12px] ${range === option ? 'bg-brand-soft text-brand-deep' : 'bg-canvas'}`}>近 {option} 天</button>)}</div>
    <section className="card p-4"><SectionTitle title="入睡时间趋势" hint={sleepPlan.target ? `当前目标 ${sleepPlan.target}` : '等待更多记录'} />
      <p className="text-[13px] text-ink">{progress.score === null ? '资料不足，暂不计算计划进展。' : `最近 ${progress.count} 晚有 ${progress.near} 晚接近当前目标 · ${progress.score}/100`}</p>
      <div className="mt-3 divide-y divide-line-soft">{shown.slice(-range).reverse().map((record) => <div key={record.date} className="flex justify-between py-2 text-[12px]"><span className="text-muted">{record.date}</span><span className="text-ink">{record.bedTime ?? '无入睡记录'} {record.simulatedFields?.includes('bedTime') ? '· 模拟估计' : '· 本人记录'}</span></div>)}</div>
      <p className="mt-2 text-[11px] text-muted">计划进展按当前目标回看历史，目标改变后会重新计算；包含模拟设备估计，不是健康评分。</p>
    </section>
    <section><SectionTitle title="持续事项时间线" />{items.length === 0 ? <p className="card p-4 text-[12px] text-ink-soft">目前没有跟进事项。</p> : <div className="space-y-2">{items.map((item) => <article key={item.id} className="card p-4"><p className="text-[13px] font-medium">{item.topic} · {item.status}</p>{item.events.map((event) => <p key={event.id} className="mt-1 text-[11px] text-ink-soft">{event.at.slice(0, 10)} · {event.kind}{event.note ? ` · ${event.note}` : ''}</p>)}</article>)}</div>}</section>
  </div>
}
