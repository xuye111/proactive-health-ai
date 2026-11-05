import { useState } from 'react'
import { Link } from 'react-router-dom'
import { applyGoutEvent, goutPrompt, goutSummary, isGoutFollowUp, type GoutEvent, type GoutFollowUp } from '../ai/goutFollowUp'
import type { FollowUp } from '../ai/followUps'
import { startPersonalGoutFollowUp, updateFollowUp } from '../lib/followUpStore'
import { localTimestamp } from '../lib/healthStore'

interface Props { items: FollowUp[]; date: string; quiet: boolean; safety: boolean; focusedId?: string | null }
const nextDate = (date: string): string => { const day = new Date(`${date}T12:00:00`); day.setDate(day.getDate() + 1); return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}` }
const field = 'min-h-10 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink'
const action = 'min-h-10 rounded-lg bg-brand-soft px-3 py-2 text-[13px] font-medium text-brand-deep'

function GoutItem({ item, date, quiet, safety }: { item: GoutFollowUp; date: string; quiet: boolean; safety: boolean }) {
  const [planOn, setPlanOn] = useState('')
  const [reviewOn, setReviewOn] = useState(() => nextDate(date))
  const [askAgain, setAskAgain] = useState(false)
  const [reason, setReason] = useState('')
  const [sampledOn, setSampledOn] = useState('')
  const [urate, setUrate] = useState('')
  const [unit, setUnit] = useState<'' | 'µmol/L' | 'mg/dL'>('')
  const [source, setSource] = useState('')
  const [confirmEarly, setConfirmEarly] = useState(false)
  const [message, setMessage] = useState('')
  const phase = item.gout.phase
  const prompt = quiet || safety ? null : goutPrompt(item, date)
  const submit = (event: GoutEvent) => {
    setMessage('')
    try {
      updateFollowUp(item.id, (current) => isGoutFollowUp(current) ? applyGoutEvent(current, event, localTimestamp()) : current)
      setMessage('已记录。小满会按你确认的进度继续跟进。')
    } catch (error) { setMessage(error instanceof Error ? error.message : '保存失败，请核对输入。') }
  }
  const submitReport = () => {
    if (!unit) { setMessage('请核对报告上的原始单位。'); return }
    submit({ kind: 'report', sampledOn, urate: Number(urate), unit, source: source.trim(), ...(item.gout.dueOn && sampledOn && sampledOn < item.gout.dueOn && confirmEarly ? { confirmEarly: true } : {}) })
  }
  return <article className="mt-3 rounded-xl border border-line p-3 text-[13px]">
    <p className="font-medium text-ink">{item.topic}</p>
    <p className="mt-1 leading-relaxed text-ink-soft">{goutSummary(item)}</p>
    <Link to={`/agent?item=${encodeURIComponent(item.id)}`} className="mt-2 inline-flex text-[12px] font-medium text-brand-deep">问小满 →</Link>
    {item.nextReviewAt && item.status !== '已结束' &&
      <p className="mt-1 text-[12px] text-muted">下次跟进 {item.nextReviewAt}</p>}
    {prompt && <p className="mt-2 rounded-lg bg-brand-soft p-2 text-brand-deep">{prompt}</p>}
    {phase !== 'closed' && phase !== 'received' && <div className="mt-3 space-y-3">
      {(phase === 'unknown_plan' || phase === 'no_plan') && <>
        <label className="block text-[12px] text-muted">医生安排的日期<input type="date" value={planOn} onChange={(event) => setPlanOn(event.target.value)} className={field} /></label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => submit({ kind: 'plan', dueOn: planOn })} className={action}>已约复查</button>
          <button type="button" onClick={() => submit({ kind: 'visit_plan', visitOn: planOn })} className={action}>已约复诊</button>
          <button type="button" onClick={() => submit({ kind: 'no_plan', ...(askAgain ? { reviewOn } : {}) })} className={action}>目前没有明确安排</button>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-muted"><input type="checkbox" checked={askAgain} onChange={(event) => setAskAgain(event.target.checked)} />没有安排时，约日再问</label>
      </>}
      {(phase === 'scheduled' || phase === 'not_tested') && <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => submit({ kind: 'not_tested', reviewOn, note: reason.trim() || undefined })} className={action}>还没检查</button>
        <button type="button" onClick={() => submit({ kind: 'waiting_report', reviewOn })} className={action}>已检查，等报告</button>
      </div>}
      {(phase === 'scheduled' || phase === 'not_tested' || phase === 'waiting_report') && <div className="space-y-2 rounded-lg bg-canvas p-3">
        <p className="font-medium">已有报告，核对录入</p>
        <label className="block text-[12px] text-muted">采样日期<input type="date" value={sampledOn} onChange={(event) => { setSampledOn(event.target.value); setConfirmEarly(false) }} className={field} /></label>
        <label className="block text-[12px] text-muted">血尿酸数值<input type="number" min="0" step="any" value={urate} onChange={(event) => setUrate(event.target.value)} className={field} /></label>
        <label className="block text-[12px] text-muted">报告原始单位<select value={unit} onChange={(event) => setUnit(event.target.value as '' | 'µmol/L' | 'mg/dL')} className={field}><option value="">请选择报告上的单位</option><option value="µmol/L">µmol/L</option><option value="mg/dL">mg/dL</option></select></label>
        <label className="block text-[12px] text-muted">报告来源<input value={source} onChange={(event) => setSource(event.target.value)} placeholder="如医院检验报告" className={field} /></label>
        {item.gout.dueOn && sampledOn && sampledOn < item.gout.dueOn && <label className="flex items-start gap-2 text-[12px] text-ink-soft"><input type="checkbox" checked={confirmEarly} onChange={(event) => setConfirmEarly(event.target.checked)} className="mt-0.5" />我确认这份报告是本次提前完成的复查</label>}
        <button type="button" onClick={submitReport} className={action}>确认录入报告</button>
      </div>}
      <label className="block text-[12px] text-muted">约定下次应用内跟进日期<input type="date" min={nextDate(date)} value={reviewOn} onChange={(event) => setReviewOn(event.target.value)} className={field} /></label>
      {(phase === 'scheduled' || phase === 'not_tested') && <label className="block text-[12px] text-muted">未检查的原因（选填）<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} className={field} /></label>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => submit({ kind: 'defer', reviewOn })} className={action}>稍后再处理</button>
        <button type="button" onClick={() => submit({ kind: 'close' })} className="min-h-10 px-2 text-[12px] text-muted">结束本轮跟进</button>
      </div>
    </div>}
    {message && <p role="status" className="mt-2 text-[12px] text-brand-deep">{message}</p>}
  </article>
}

export function GoutFollowUpPanel({ items, date, quiet, safety, focusedId }: Props) {
  const [entry, setEntry] = useState<'resolved' | 'scheduled'>('resolved')
  const [diagnosed, setDiagnosed] = useState(false)
  const [resolvedOn, setResolvedOn] = useState(date)
  const [dueOn, setDueOn] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const goutItems = items.filter(isGoutFollowUp)
  const start = () => {
    setMessage('')
    if (!diagnosed) { setMessage('此入口仅供本人已由医生确诊痛风后记录随访；请先确认。'); return }
    try {
      startPersonalGoutFollowUp(entry === 'resolved' ? { kind: 'resolved', resolvedOn, note: note.trim() || undefined } : { kind: 'scheduled', dueOn }, localTimestamp())
      setMessage('已保存到持续事项。小满会在应用内按记录继续核对。')
    } catch (error) { setMessage(error instanceof Error ? error.message : '保存失败，请检查日期后重试。') }
  }
  return <section className="rounded-2xl border border-brand/25 bg-surface p-4" aria-label="痛风持续随访">
    <p className="text-[14px] font-semibold text-ink">痛风复查与报告跟进</p>
    <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">本人确认记录后，小满只在应用打开时提示后续安排。复查和治疗请遵循医生意见。</p>
    <details className="mt-3 rounded-xl border border-line p-3" open={goutItems.length === 0}>
      <summary className="cursor-pointer text-[13px] font-medium text-brand-deep">新增一次痛风随访</summary>
      <div className="mt-3 space-y-3">
        <label className="flex items-start gap-2 text-[13px] text-ink-soft"><input type="checkbox" checked={diagnosed} onChange={(event) => setDiagnosed(event.target.checked)} className="mt-1" />我本人已由医生确诊痛风，此处记录的是我的随访安排</label>
        <div className="flex gap-4 text-[13px]">
          <label><input type="radio" name="gout-entry" checked={entry === 'resolved'} onChange={() => setEntry('resolved')} /> 本次发作已缓解</label>
          <label><input type="radio" name="gout-entry" checked={entry === 'scheduled'} onChange={() => setEntry('scheduled')} /> 已约复查</label>
        </div>
        {entry === 'resolved' ? <>
          <label className="block text-[12px] text-muted">缓解日期<input type="date" value={resolvedOn} onChange={(event) => setResolvedOn(event.target.value)} className={field} /></label>
          <label className="block text-[12px] text-muted">这次症状或想问医生的问题（选填）<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} rows={2} className={field} /></label>
        </> : <label className="block text-[12px] text-muted">医生安排的复查日期<input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} className={field} /></label>}
        <button type="button" onClick={start} className={action}>保存并开始跟进</button>
      </div>
    </details>
    {[...goutItems].sort((a, b) =>
      Number(b.id === focusedId) - Number(a.id === focusedId) ||
      Number(a.status === '已结束') - Number(b.status === '已结束') ||
      (a.nextReviewAt ?? '9999').localeCompare(b.nextReviewAt ?? '9999')
    ).map((item) =>
      <div id={`follow-up-${item.id}`} key={item.id} className={`scroll-mt-20 ${item.id === focusedId ? 'rounded-xl ring-2 ring-brand/40' : ''}`}>
        <GoutItem item={item} date={date} quiet={quiet} safety={safety} />
      </div>
    )}
    {message && <p role="status" className="mt-3 text-[12px] text-brand-deep">{message}</p>}
  </section>
}
