import { useState } from 'react'
import { SectionTitle } from '../../components/SectionTitle'
import { MetricOverview } from '../../components/MetricOverview'
import { activeDate, clearSleepConflict, confirmSleepConflict, deviceRecordFor, effectiveRecords, recordSleepConflict, saveDailyRecord, useHealthState } from '../../lib/healthStore'
import { sleepConflict, sleepPlanProgress, suggestSleepPlan } from '../../ai/sleepPlan'

const deviceCorrectionFields = [
  { key: 'sleepHours', label: '睡眠时长（小时）', min: 0, max: 24, step: 0.1 },
  { key: 'bedTime', label: '入睡时间', type: 'time' },
  { key: 'wakeTime', label: '起床时间', type: 'time' },
  { key: 'steps', label: '今日步数', min: 0, max: 100000, step: 1 },
  { key: 'activeMinutes', label: '活动分钟', min: 0, max: 1440, step: 1 },
] as const

const fields = [
  { key: 'energy', label: '精力 1–5', min: 1, max: 5, step: 1 },
  { key: 'stress', label: '压力 1–5', min: 1, max: 5, step: 1 },
  { key: 'mood', label: '情绪 1–5', min: 1, max: 5, step: 1 },
  { key: 'caffeineCups', label: '咖啡因杯数', min: 0, max: 20, step: 1 },
] as const

const statusLabel = (record: Record<string, unknown> | undefined, key: string): string => record?.[key] === undefined ? '待记录' : '已记录'

export default function PersonalTodayPanel() {
  const health = useHealthState()
  const today = activeDate(health)
  const [date, setDate] = useState(today)
  const record = health.records.find((item) => item.date === date)
  const displayed = effectiveRecords(health).find((item) => item.date === date)
  const sleepPlan = suggestSleepPlan(effectiveRecords(health), health.sleepPreferences, health.sleepConflicts)
  const progress = sleepPlanProgress(effectiveRecords(health).filter((item) => item.date <= date), sleepPlan.target, health.sleepConflicts)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [pendingPatch, setPendingPatch] = useState<Record<string, unknown> | null>(null)
  const firstConflict = health.sleepConflicts.find((item) => item.status === '待再次核对' && item.firstConfirmedAt.slice(0, 10) < today)

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const patch: Record<string, unknown> = {}
    for (const field of [...fields, ...deviceCorrectionFields]) {
      const raw = data.get(field.key)
      if (typeof raw === 'string') patch[field.key] = raw === '' ? null : field.key === 'bedTime' || field.key === 'wakeTime' ? raw : Number(raw)
    }
    patch.sleepBarrier = String(data.get('sleepBarrier') ?? '') || null
    const deviceTime = deviceRecordFor(date)?.bedTime
    if (typeof patch.bedTime === 'string' && sleepConflict(deviceTime, patch.bedTime) && !health.sleepConflicts.some((item) => item.date === date && item.reportedTime === patch.bedTime)) {
      setPendingPatch(patch)
      setError('')
      setSaved('')
      return
    }
    try { saveDailyRecord(date, patch); if (patch.bedTime === null || (typeof patch.bedTime === 'string' && !sleepConflict(deviceTime, patch.bedTime))) clearSleepConflict(date); setError(''); setSaved('已保存到本机，作息进展将随记录更新') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); setSaved('') }
  }

  return <div className="space-y-5 px-4 pt-4">
    <section><SectionTitle title="今日数据" hint="模拟设备读数与本人补充汇总" /><MetricOverview record={displayed} /></section>
    <section className="card p-4">
      <SectionTitle title="今日记录" hint={date} />
      <p className="mb-3 text-[12px] leading-relaxed text-ink-soft">这里补充你的感受，也可以在小满页用文字或语音口述。上方模拟值不会自动写成你的记录。</p>
      <label className="mb-3 block text-[12px] text-ink-soft">记录日期 <input type="date" value={date} max={today} onChange={(event) => { setDate(event.target.value); setPendingPatch(null); setSaved(''); setError('') }} className="ml-2 rounded-lg border border-line p-1 text-ink" /></label>
      {pendingPatch && <div role="status" className="mb-3 rounded-xl border border-warn/30 bg-warn-soft p-3 text-[12px] text-ink"><p className="font-medium">先核对一次入睡时间</p><p className="mt-1 leading-relaxed">模拟设备估计 {deviceRecordFor(date)?.bedTime}，你填写 {String(pendingPatch.bedTime)}。设备可能识别不准，也可能是你记忆的时间与实际入睡不同；小满不会据此判断谁对谁错。</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => { try { saveDailyRecord(date, pendingPatch); recordSleepConflict({ date, deviceTime: deviceRecordFor(date)?.bedTime as string, reportedTime: String(pendingPatch.bedTime) }); setPendingPatch(null); setSaved('已记录你的反馈；有后续记录时小满会再核对一次') } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败') } }} className="rounded-lg bg-brand px-3 py-1.5 text-white">确认我的记录</button><button type="button" onClick={() => setPendingPatch(null)} className="rounded-lg border border-line px-3 py-1.5">返回修改</button></div></div>}
      <form key={`${date}-${health.revision}`} onSubmit={save} className="grid grid-cols-2 gap-3">
        <label className="col-span-2 text-[12px] text-ink-soft">昨晚入睡时，主要遇到什么阻碍？<select name="sleepBarrier" defaultValue={record?.sleepBarrier ?? ''} className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-[13px] text-ink"><option value="">暂不填写</option><option>睡前事务</option><option>使用手机</option><option>到了时间不困</option><option>其他</option><option>无明显阻碍</option></select></label>
        {fields.map((field) => <label key={field.key} className="text-[12px] text-ink-soft">
          <span className="mb-1 flex items-center justify-between gap-2"><span>{field.label}</span><span className={statusLabel(record, field.key) === '已记录' ? 'text-brand-deep' : 'text-muted'}>{statusLabel(record, field.key)}</span></span>
          <input name={field.key} type="number" min={field.min} max={field.max} step={field.step} defaultValue={record?.[field.key] ?? ''} className="w-full rounded-lg border border-line bg-surface p-2 text-[14px] text-ink" />
        </label>)}
        <details className="col-span-2 rounded-xl border border-line p-3"><summary className="cursor-pointer text-[12px] text-ink-soft">补充睡眠与活动 <span className="ml-1 text-muted">（{deviceCorrectionFields.filter((field) => statusLabel(record, field.key) === '已记录').length}/{deviceCorrectionFields.length} 项已记录）</span></summary><div className="mt-3 grid grid-cols-2 gap-3">{deviceCorrectionFields.map((field) => <label key={field.key} className="text-[12px] text-ink-soft"><span className="mb-1 flex items-center justify-between gap-2"><span>{field.label}</span><span className={statusLabel(record, field.key) === '已记录' ? 'text-brand-deep' : 'text-muted'}>{statusLabel(record, field.key)}</span></span><input name={field.key} type={'type' in field ? 'time' : 'number'} min={'min' in field ? field.min : undefined} max={'max' in field ? field.max : undefined} step={'step' in field ? field.step : undefined} defaultValue={record?.[field.key] ?? ''} className="w-full rounded-lg border border-line bg-surface p-2 text-[14px] text-ink" /></label>)}</div></details>
        <button type="submit" className="col-span-2 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-medium text-white">保存今日记录</button>
      </form>
      {error && <p role="alert" className="mt-2 text-[12px] text-danger">{error}</p>}
      {saved && <p role="status" className="mt-2 text-[12px] text-brand-deep">{saved}</p>}
      {record && <p className="mt-2 text-[11px] text-muted">你上次填写：{new Date(record.updatedAt).toLocaleString('zh-CN')}</p>}
    </section>
    {firstConflict && <section className="card p-4"><SectionTitle title="再核对一次" hint="设备估计与本人反馈不同" /><p className="text-[12px] leading-relaxed text-ink-soft">{firstConflict.date}：设备估计 {firstConflict.deviceTime}，你记录 {firstConflict.reportedTime}。设备时间是估计，可能受佩戴和识别影响；你的感受也可能与设备不同。这个差异会让小满对目标进展保持谨慎。</p><button type="button" onClick={() => { confirmSleepConflict(firstConflict.date); setSaved('已尊重并保留你的反馈；小满不会继续追问这条记录') }} className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-[12px] font-medium text-brand-deep">我仍以自己的记录为准</button><p className="mt-2 text-[11px] text-muted">如果想修改，可切换到该日期重新填写；小满不会自行覆盖你的记录。</p></section>}
    <section className="card p-4"><SectionTitle title="入睡计划进展" hint={sleepPlan.target ? `目标 ${sleepPlan.target}` : '资料不足'} /><p className="text-[12px] text-ink">{progress.score === null ? '至少需要 3 晚入睡时间。' : `近 ${progress.count} 晚中有 ${progress.near} 晚接近目标，计划进展 ${progress.score}/100。`}</p><p className="mt-2 text-[11px] text-muted">前后 30 分钟是演示统计口径，不是医学阈值。{progress.simulated ? '当前含模拟设备估计。' : '当前来自本人记录。'}</p></section>
    <p className="px-2 text-[11px] leading-relaxed text-muted">记录仅保存在本机；设备时间为估计。计划进展不代表整体健康或疾病风险。</p>
  </div>
}
