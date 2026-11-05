import type { DailyRecord } from '../types'
import { formatNumber, formatSleepShort } from '../lib/derive'

type Observation = Partial<DailyRecord> & { simulatedFields?: string[] }

export function MetricOverview({ record }: { record?: Observation }) {
  const source = (key: string): string => record?.simulatedFields?.includes(key) ? ['energy', 'stress', 'mood', 'caffeineCups'].includes(key) ? '模拟样例' : '模拟设备' : '本人补充'
  const available = (value: number | undefined, format: (number: number) => string): string =>
    typeof value === 'number' ? format(value) : '待记录'
  const items = [
    { key: 'sleepHours', label: '睡眠时长', value: available(record?.sleepHours, formatSleepShort), tone: 'border-t-sleep' },
    { key: 'steps', label: '今日步数', value: available(record?.steps, formatNumber), tone: 'border-t-activity' },
    { key: 'activeMinutes', label: '活动时间', value: available(record?.activeMinutes, (n) => `${n} 分钟`), tone: 'border-t-activity' },
    { key: 'energy', label: '精力感受', value: available(record?.energy, (n) => `${n} / 5`), tone: 'border-t-brand' },
    { key: 'stress', label: '压力感受', value: available(record?.stress, (n) => `${n} / 5`), tone: 'border-t-warn' },
    { key: 'mood', label: '情绪感受', value: available(record?.mood, (n) => `${n} / 5`), tone: 'border-t-mind' },
  ]
  const pressure = typeof record?.bloodPressureSystolic === 'number' && typeof record.bloodPressureDiastolic === 'number'
    ? `${record.bloodPressureSystolic}/${record.bloodPressureDiastolic}` : '待记录'

  return <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => <div key={item.label} className={`metric-tile min-w-0 border-t-[3px] ${item.tone} px-2.5 py-3`}>
        <p className="text-[10px] text-muted">{item.label}</p>
        <p className="mt-1 truncate text-[16px] font-semibold text-ink" title={item.value}>{item.value}</p>
        <p className="mt-1 text-[10px] text-muted">{item.value === '待记录' ? '待记录' : `已记录 · ${source(item.key)}`}</p>
      </div>)}
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div className="metric-tile flex items-center justify-between gap-2 px-3 py-3"><div><p className="text-[11px] text-ink-soft">静息心率</p><p className="text-[10px] text-muted">{typeof record?.restingHeartRate === 'number' ? `已记录 · ${source('restingHeartRate')} · 监测参考` : '待记录'}</p></div><p className="text-[16px] font-semibold text-ink">{available(record?.restingHeartRate, (n) => `${n} 次/分`)}</p></div>
      <div className="metric-tile flex items-center justify-between gap-2 px-3 py-3"><div><p className="text-[11px] text-ink-soft">血压</p><p className="text-[10px] text-muted">{pressure === '待记录' ? '待记录' : `已记录 · ${source('bloodPressureSystolic')} · 监测参考`}</p></div><p className="text-[16px] font-semibold text-ink">{pressure}{pressure !== '待记录' && <span className="ml-0.5 text-[9px] font-normal text-muted">mmHg</span>}</p></div>
    </div>
    <p className="px-1 text-[10px] leading-relaxed text-muted">模拟设备读数不是真实测量；静息心率和血压不参与生活状态分，也不在这里解读医疗风险。</p>
  </div>
}
