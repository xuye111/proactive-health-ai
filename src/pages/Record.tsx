import { useNavigate } from 'react-router-dom'
import { AppBar } from '../components/AppBar'
import { formatDateCn, today } from '../lib/derive'
import TodayPanel from './record/TodayPanel'
import TrendsPanel from './record/TrendsPanel'

/** 记录与趋势合并为一个一级入口：同一份数据，两个时间尺度。 */
const SEGMENTS = [
  { id: 'today', label: '今天', to: '/record', subtitle: formatDateCn(today.date) },
  { id: 'trends', label: '趋势', to: '/trends', subtitle: '长期变化与判断依据' },
] as const

export type RecordView = 'today' | 'trends'

export default function Record({ view }: { view: RecordView }) {
  const navigate = useNavigate()
  const active = SEGMENTS.find((segment) => segment.id === view) ?? SEGMENTS[0]

  return (
    <>
      <AppBar title="记录" subtitle={active.subtitle} />

      <div className="px-4 pt-4">
        <div className="flex gap-1 rounded-xl bg-line-soft p-1" role="tablist" aria-label="记录视图">
          {SEGMENTS.map((segment) => (
            <button
              key={segment.id}
              type="button"
              role="tab"
              aria-selected={view === segment.id}
              onClick={() => navigate(segment.to)}
              className={`flex-1 rounded-lg py-1.5 text-[12px] font-medium transition-colors ${
                view === segment.id ? 'bg-surface text-ink shadow-sm' : 'text-muted'
              }`}
            >
              {segment.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'today' ? <TodayPanel /> : <TrendsPanel />}
    </>
  )
}
