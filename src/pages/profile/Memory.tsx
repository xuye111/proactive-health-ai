import { useState } from 'react'
import { AppBar } from '../../components/AppBar'
import { SectionTitle } from '../../components/SectionTitle'
import { StageNotice } from '../../components/StageNotice'
import { ASSISTANT_NAME } from '../../lib/assistant'
import { formatDateCn, today } from '../../lib/derive'
import { useMemoryEntries } from '../../lib/agentRules'
import {
  MEMORY_TYPE_LABEL,
  MEMORY_TYPE_STYLE,
  MEMORY_TYPES,
  type MemoryType,
} from '../../lib/memory'

type Filter = MemoryType | 'all'

export default function Memory() {
  const [filter, setFilter] = useState<Filter>('all')
  const all = useMemoryEntries()
  const live = all.filter((entry) => entry.id.startsWith('live-'))
  const counts = MEMORY_TYPES.map((type) => ({
    type,
    count: all.filter((entry) => entry.type === type).length,
  })).filter((item) => item.count > 0)
  const visible = filter === 'all' ? all : all.filter((entry) => entry.type === filter)
  const earliest = all[all.length - 1]?.date ?? today.date

  return (
    <>
      <AppBar title="长期记忆" subtitle={`${ASSISTANT_NAME}对你的长期理解`} backTo="/profile" />

      <div className="space-y-5 px-4 pt-4">
        <StageNotice>
          记忆来自三类活动：数据观察、对话与计划执行。本页的条目会随使用增长——在
          {ASSISTANT_NAME}页回答一次追问或提一个问题，这里就会多一条。向量召回属于第三阶段（方案 §23 / §24）。
        </StageNotice>

        {/* 概览 */}
        <section className="card p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[26px] leading-none font-semibold tracking-tight text-ink">
                {all.length}
                <span className="ml-1 text-[13px] font-normal text-muted">条记忆</span>
              </p>
              <p className="mt-1.5 text-[11px] text-muted">
                覆盖 {counts.length} 类 · {formatDateCn(earliest)} 至今
              </p>
            </div>
            {live.length > 0 && (
              <span className="rounded-full bg-brand-soft/70 px-2 py-0.5 text-[10px] text-brand-deep">
                本次新增 {live.length}
              </span>
            )}
          </div>
        </section>

        {/* 类型筛选 */}
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <button
            type="button"
            onClick={() => setFilter('all')}
            aria-pressed={filter === 'all'}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
              filter === 'all' ? 'border-brand bg-brand-soft/50 text-brand-deep' : 'border-line bg-surface text-ink-soft'
            }`}
          >
            全部 {all.length}
          </button>
          {counts.map(({ type, count }) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilter(type)}
              aria-pressed={filter === type}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                filter === type
                  ? 'border-brand bg-brand-soft/50 text-brand-deep'
                  : 'border-line bg-surface text-ink-soft'
              }`}
            >
              {MEMORY_TYPE_LABEL[type]} {count}
            </button>
          ))}
        </div>

        {/* 记忆条目 */}
        <section>
          <SectionTitle title="记忆条目" hint="按时间倒序" />
          <ul className="card divide-y divide-line-soft">
            {visible.map((entry) => (
              <li key={entry.id} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${MEMORY_TYPE_STYLE[entry.type]}`}>
                    {MEMORY_TYPE_LABEL[entry.type]}
                  </span>
                  <span className="text-[10px] text-muted">{formatDateCn(entry.date)}</span>
                  {entry.id.startsWith('live-') && (
                    <span className="ml-auto text-[10px] text-brand">本次</span>
                  )}
                </div>
                <p className="mt-1.5 text-[13px] leading-snug text-ink">{entry.text}</p>
                <p className="mt-1 text-[10px] text-muted">来源：{entry.source}</p>
              </li>
            ))}
          </ul>
          {visible.length === 0 && (
            <p className="card px-4 py-6 text-center text-[12px] text-muted">这一类还没有记忆</p>
          )}
        </section>

        <StageNotice>
          记忆的作用是让建议随历史变化：同样的睡眠下降，如果记忆里记着「上次是加班导致的」，今天就会先建议调整工作结束时间，而不是重复「早点睡」。
        </StageNotice>
      </div>
    </>
  )
}
