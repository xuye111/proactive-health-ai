import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { goutSummary, isGoutFollowUp } from '../ai/goutFollowUp'
import { AppBar } from '../components/AppBar'
import { GoutActivityForm } from '../components/GoutActivityForm'
import { GoutFollowUpPanel } from '../components/GoutFollowUpPanel'
import { useFollowUps } from '../lib/followUpStore'
import { localDate, useHealthState } from '../lib/healthStore'

export default function Record() {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  const tasksView = params.get('view') === 'tasks'
  const focusedId = params.get('item')
  const followUps = useFollowUps()
  const items = followUps.filter(isGoutFollowUp)
  const health = useHealthState()
  const [now, setNow] = useState(() => new Date())
  const date = localDate(now)
  const hour = now.getHours()
  const quiet = health.remindersPaused || hour >= 22 || hour < 8
  const safety = followUps.some((item) => item.status === '建议就医' && !isGoutFollowUp(item))
  const timeline = items.flatMap((item) => item.events.map((event) => ({ item, event })))
    .sort((a, b) => b.event.at.localeCompare(a.event.at))

  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    if (tasksView && focusedId && items.some((item) => item.id === focusedId)) {
      window.setTimeout(() => document.getElementById(`follow-up-${focusedId}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0)
    }
  }, [tasksView, focusedId, items.length])

  return <>
    <AppBar title="痛风记录" subtitle="症状、复诊复查与报告" />
    <div className="space-y-5 px-4 pb-5 pt-4">
      <nav aria-label="记录页面" className="flex gap-2 text-[13px]">
        <Link to="/record" aria-current={!tasksView ? 'page' : undefined} className={`rounded-lg px-3 py-2 ${!tasksView ? 'bg-brand-soft font-medium text-brand-deep' : 'text-muted'}`}>记录</Link>
        <Link to="/record?view=tasks" aria-current={tasksView ? 'page' : undefined} className={`rounded-lg px-3 py-2 ${tasksView ? 'bg-brand-soft font-medium text-brand-deep' : 'text-muted'}`}>随访任务</Link>
      </nav>
      {tasksView ? <GoutFollowUpPanel items={followUps} date={date} quiet={quiet} safety={safety} focusedId={focusedId} /> : <>
      <p className="text-[12px] leading-relaxed text-muted">这里按时间展示你确认过的症状缓解、复诊复查安排和报告。</p>
      {items.length === 0 ? <section className="card p-5 text-[13px] text-ink-soft">
        <p className="font-medium text-ink">还没有痛风记录</p>
        <p className="mt-2">可在随访任务中记录已缓解的本次症状或医生安排的复查日期。</p>
        <Link to="/record?view=tasks" className="mt-3 inline-flex font-medium text-brand-deep">开始记录 →</Link>
      </section> : <>
        <section>
          <h2 className="mb-2 text-[14px] font-semibold text-ink">随访摘要</h2>
          <div className="space-y-3">{[...items].sort((a, b) => b.firstDetectedAt.localeCompare(a.firstDetectedAt)).map((item) => <article key={item.id} className="card p-4">
            <div className="flex items-start justify-between gap-2"><h3 className="text-[14px] font-medium text-ink">{item.topic}</h3><span className="shrink-0 text-[11px] text-muted">{item.status}</span></div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">{goutSummary(item)}</p>
            {item.gout.report ? <div className="mt-3 rounded-lg bg-brand-soft p-3 text-[12px] leading-relaxed text-ink-soft">
              <p className="font-medium text-ink">本次关联报告</p>
              <p>采样：{item.gout.report.sampledOn}</p>
              <p>血尿酸：{item.gout.report.urate} {item.gout.report.unit}（原始单位）</p>
              <p>来源：{item.gout.report.source}</p>
              <p>结果解释和下一步安排：待与医生确认</p>
            </div> : item.gout.visitOn ? <p className="mt-2 text-[12px] text-muted">已记录复诊安排；本轮安排核对结束。</p> : <p className="mt-2 text-[12px] text-muted">报告：{item.gout.phase === 'waiting_report' ? '已检查，待报告' : '尚未关联本次报告'}</p>}
            {item.gout.report && <GoutActivityForm item={item} />}
            <div className="mt-3 flex flex-wrap gap-4 text-[12px] font-medium text-brand-deep">
              <Link to={`/record?view=tasks&item=${encodeURIComponent(item.id)}`}>更新进度 →</Link>
              <Link to={`/agent?item=${encodeURIComponent(item.id)}`}>问小满 →</Link>
            </div>
          </article>)}</div>
        </section>
        <section>
          <h2 className="mb-2 text-[14px] font-semibold text-ink">按时间查看</h2>
          <ol className="space-y-2">{timeline.map(({ item, event }) => <li key={`${item.id}:${event.id}`} className="card p-3 text-[12px]">
            <p className="text-muted">{event.at.slice(0, 16).replace('T', ' ')}</p>
            <p className="mt-1 font-medium text-ink">{item.topic}</p>
            <p className="mt-1 leading-relaxed text-ink-soft">{event.note ?? '已记录进度，详情待确认'}</p>
          </li>)}</ol>
        </section>
      </>}
      </>}
      <p className="text-center text-[11px] text-muted">{tasksView ? '随访任务仅记录本人确认的进度；复查和治疗请遵循医生意见。' : '本页是记录摘要，不解读检验值或调整治疗。'}</p>
    </div>
  </>
}
