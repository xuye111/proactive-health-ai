import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { ASSISTANT_NAME } from '../lib/assistant'
import { activeDate, effectiveRecords, localTimestamp, markSleepPreparation, useHealthState } from '../lib/healthStore'
import { preparationDue, SLEEP_GUIDANCE, sleepPlanProgress, sleepPreparationTime, suggestSleepPlan, twoWeekSleepSummary } from '../ai/sleepPlan'
import { syncPersonalFollowUps, updateFollowUp, useFollowUps } from '../lib/followUpStore'
import { assessFollowUp, confirmFollowUp, deferFollowUp, closeFollowUp, recordFollowUpActionOutcome, remindersFor, setFollowUpAction, type FollowUp } from '../ai/followUps'
import { actionablePersonalSignals, reviewPersonal } from '../ai/personal'
import { goutPrompt, goutSummary, isGoutFollowUp } from '../ai/goutFollowUp'
const tomorrow = (date: string): string => { const day = new Date(`${date}T12:00:00`); day.setDate(day.getDate() + 1); return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}` }

export default function PersonalHome() {
  const health = useHealthState()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer) }, [])
  const date = activeDate(health)
  const allRecords = effectiveRecords(health)
  const sleepPlan = suggestSleepPlan(allRecords, health.sleepPreferences, health.sleepConflicts)
  const preparationTime = sleepPreparationTime(sleepPlan.target)
  const preparationDone = health.sleepRoutine.preparationDoneOn === date
  const preparationReady = !health.remindersPaused && !preparationDone && preparationDue(sleepPlan.target, now)
  const twoWeek = twoWeekSleepSummary(allRecords, date, health.sleepConflicts, health.sleepRoutine.morningFeedbackHistory)
  const progress = sleepPlanProgress(allRecords, sleepPlan.target, health.sleepConflicts)
  const review = reviewPersonal(allRecords, date)
  const personalReview = reviewPersonal(health.records, date)
  const manualSignals = actionablePersonalSignals(personalReview.signals, health.records.find((row) => row.date === date))
  const followUps = useFollowUps()
  useEffect(() => { syncPersonalFollowUps(manualSignals, localTimestamp()) }, [health.revision, date])
  const open = followUps.filter((item) => item.status !== '已结束')
  const genericOpen = open.filter((item) => !isGoutFollowUp(item))
  const hour = new Date().getHours()
  const quiet = health.remindersPaused || hour >= 22 || hour < 8
  const reminders = remindersFor(genericOpen, date, quiet)
  const safetyDue = reminders.some((reminder) => reminder.priority === 'safety')
  const goutDue = quiet ? [] : open.filter(isGoutFollowUp).flatMap((item) => {
    const prompt = goutPrompt(item, date)
    return prompt ? [{ item, prompt }] : []
  })
  const assessmentFor = (item: FollowUp) => assessFollowUp(item, manualSignals, health.records.some((row) => row.date > (item.action?.setAt.slice(0, 10) ?? item.firstDetectedAt.slice(0, 10))))

  return <>
    <header className="safe-top px-5 pt-6 pb-4">
      <p className="text-[13px] text-muted">{date} · 模拟设备数据 + 本机补充</p>
      <h1 className="mt-1 text-[22px] font-semibold">{health.profile.displayName ? `${health.profile.displayName}，` : ''}今晚一起按计划准备</h1>
      <p className="mt-1 text-[13px] text-ink-soft">小满结合近期作息，先给你一个可调整的入睡目标。</p>
    </header>
    <div className="space-y-5 px-4">
      <section className="status-hero p-5 text-white">
        <div className="mb-2 flex justify-between text-[12px] text-white/75"><span>今晚的入睡目标</span><span>{sleepPlan.source}</span></div>
        <p className="text-[38px] font-semibold leading-tight">{sleepPlan.target ?? '待建议'} <span className="text-[14px] font-normal">{sleepPlan.target ? '左右' : ''}</span></p>
        <p className="mt-2 text-[13px] leading-relaxed text-white/85">{sleepPlan.action}</p>
        <div className="mt-4 rounded-xl bg-white/10 p-3"><p className="text-[12px] text-white/75">近 {progress.count} 晚计划进展</p><p className="mt-1 text-[21px] font-semibold">{progress.score === null ? '资料不足' : `${progress.score} / 100`}</p><p className="mt-1 text-[12px] leading-relaxed text-white/75">{progress.score === null ? '至少需要 3 晚记录。' : `${progress.near} 晚接近当前目标（前后 30 分钟）；这是演示进展指标，不是健康评分。`}{progress.simulated ? ' 当前含模拟设备估计。' : ''}</p></div>
        {sleepPlan.nextTarget && <p className="mt-3 rounded-lg bg-white/10 p-2 text-[12px] text-white">小满建议下阶段试试 {sleepPlan.nextTarget}，请在「我的」确认。</p>}
        <details className="mt-3 rounded-xl border border-white/15 bg-white/10 p-3"><summary className="cursor-pointer text-[13px] font-medium">小满为什么这样建议</summary><p className="mt-2 text-[12px] leading-relaxed text-white/85">{sleepPlan.reason}</p><p className="mt-2 text-[12px] text-white/70">参考：{SLEEP_GUIDANCE.title}；具体时间为待复核的演示规则。</p></details>
        <div className="mt-3 flex gap-2"><Link to="/profile" className="inline-flex min-h-10 items-center rounded-lg bg-white px-3 py-2 text-[13px] font-semibold text-brand-deep">查看并确认目标 →</Link><Link to="/agent" className="inline-flex min-h-10 items-center rounded-lg border border-white/50 px-3 py-2 text-[13px] text-white">和小满聊聊</Link></div>
      </section>
      <section>
        <SectionTitle title="小满怎样陪你入睡" hint="第一版服务节奏" />
        <div className="card divide-y divide-line-soft p-4">
          <div className="pb-3"><div className="flex items-center justify-between gap-2"><p className="text-[14px] font-medium text-ink">① 睡前提前提醒</p><span className="rounded-full bg-brand-soft px-2 py-0.5 text-[12px] text-brand-deep">{preparationDone ? '今天已准备' : '应用内提醒'}</span></div><p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{preparationTime ? `计划在 ${preparationTime} 左右开始准备，比入睡目标提前一小时。` : '积累足够记录后，小满会建议一个睡前准备时间。'}{sleepPlan.action} 完成一件准备就很好，不用强迫自己准点睡着。</p>{preparationReady && <div role="status" className="mt-2 rounded-lg bg-brand-soft p-3 text-[13px] text-brand-deep"><p>现在可以开始一件睡前准备；夜里不会再催你。</p><button type="button" onClick={() => markSleepPreparation(date)} className="mt-2 min-h-10 rounded-lg bg-brand px-3 py-1.5 text-white">我已经开始准备</button></div>}{preparationDone && <p className="mt-2 text-[12px] text-brand-deep">今天已完成准备这一步，做得很好。</p>}</div>
          <div className="py-3"><p className="text-[14px] font-medium text-ink">② 夜间不催促</p><p className="mt-1 text-[13px] leading-relaxed text-ink-soft">过了目标时间也不反复提醒。设备将来负责记录入睡时间，小满留到次日再与你核对。</p></div>
          <div className="py-3"><div className="flex items-center justify-between gap-2"><p className="text-[14px] font-medium text-ink">③ 次日醒来后反馈</p><Link to="/agent" className="text-[12px] font-medium text-brand-deep">告诉小满 →</Link></div><p className="mt-1 text-[13px] leading-relaxed text-ink-soft">核对设备估计是否符合你的感受，补充昨晚的阻碍和醒后的状态；也可以跳过。</p></div>
          <div className="pt-3"><p className="text-[14px] font-medium text-ink">④ 至少两周，形成初步模型</p><p className="mt-1 text-[13px] leading-relaxed text-ink-soft">次晨已核对：{twoWeek.reviewedMornings}/14 天；个人完整记录：{twoWeek.personalNights}/14 晚。{twoWeek.usualBedTime ? `近两周记录的常见入睡约 ${twoWeek.usualBedTime}、起床约 ${twoWeek.usualWakeTime}；${twoWeek.simulated ? '当前含模拟设备估计，仅供预览，核对模拟时间也不算个人模型。' : '这是记录摘要，不代表诊断或睡眠质量判断。'}` : '记录不足时继续积累，不会编造个人规律。'}</p></div>
        </div>
        <p className="mt-2 px-1 text-[12px] leading-relaxed text-muted">MVP 说明：准备时间为可调整的演示规则；应用关闭后的主动推送和真实设备数据待接入。</p>
      </section>
      <section><SectionTitle title="小满今天的观察" hint="等待你确认" /><div className="card p-4"><p className="text-[14px] font-medium text-ink">{review.signals[0]?.label ?? '暂未发现需要确认的明显变化'}</p><p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{review.signals[0]?.evidence.join(' · ') ?? '可以告诉小满你今天的感受，它会结合后续记录继续观察。'}</p><p className="mt-2 text-[12px] text-muted">当前观察包含模拟数据，只用于体验；请以自己的实际感受确认。</p><Link to="/agent" className="mt-3 inline-flex text-[13px] font-medium text-brand-deep">和小满确认 →</Link></div></section>
      <Link to="/solutions" className="card flex items-center gap-3 p-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-[18px] text-brand-deep">✦</span><span className="min-w-0 flex-1"><strong className="block text-[14px] text-ink">入睡方案</strong><span className="mt-1 block text-[12px] leading-relaxed text-ink-soft">先试一项适合你的睡前行动；需要额外支持时，再了解相关项目。</span></span><span className="text-[16px] text-brand-deep">→</span></Link>
      <section><SectionTitle title="最近的入睡时间" hint="设备估计与本人记录" action={{ label: '查看趋势', to: '/trends' }} /><div className="card divide-y divide-line-soft">{allRecords.slice(-5).reverse().map((row) => <div key={row.date} className="flex justify-between px-4 py-2.5 text-[13px]"><span className="text-muted">{row.date.slice(5)}</span><span>{row.bedTime ?? '资料不足'} {row.simulatedFields?.includes('bedTime') ? '· 模拟估计' : '· 本人记录'}</span></div>)}</div></section>
      <section>
        <SectionTitle title={`${ASSISTANT_NAME}正在跟进`} hint={`${open.length} 项`} />
        {safetyDue && <Link to="/agent" role="alert" className="mb-2 block rounded-xl border border-danger/40 bg-danger/5 p-3 text-[13px] text-danger">已有需要专业人员评估的提问，请优先查看小满给出的就医提示 →</Link>}
        {reminders.some((reminder) => reminder.priority === 'normal') && <p role="status" className="mb-2 rounded-xl border border-brand/30 bg-brand-soft p-3 text-[13px] text-brand-deep">{reminders.filter((reminder) => reminder.priority === 'normal').length} 项回访已到期，请结合后续记录决定继续或结束。</p>}
        {goutDue.map(({ item, prompt }) => <Link key={item.id} to="/agent" role="status" className="mb-2 block rounded-xl border border-brand/30 bg-brand-soft p-3 text-[13px] text-brand-deep"><span className="block font-medium">小满的痛风随访 · 应用内提醒</span><span className="mt-1 block">{prompt}</span><span className="mt-1 block text-[12px]">触发依据：{item.gout.phase === 'unknown_plan' ? `你确认本次发作于 ${item.gout.resolvedOn} 缓解` : item.gout.phase === 'scheduled' ? `你记录的复查日期 ${item.gout.dueOn}` : `你约定的跟进日期 ${item.nextReviewAt ?? date}`}。去小满记录进度 →</span></Link>)}
        {open.length === 0 ? <div className="card p-4 text-[13px] text-ink-soft">目前没有持续事项。记录变化后会在这里出现；资料不足时不会编造提醒。</div> : <div className="space-y-3">{open.map((item) => <article key={item.id} className={`card border-l-4 p-4 ${item.status === '建议就医' ? 'border-l-danger' : 'border-l-brand'}`}>
          <p className={`text-[14px] font-medium ${item.status === '建议就医' ? 'text-danger' : 'text-ink'}`}>{item.topic} <span className="ml-1 text-[12px]">{item.status}</span></p>
          <p className="mt-1 text-[12px] text-muted">{item.evidence.at(-1)?.details.join(' · ')}</p>
          {item.nextReviewAt && <p className="mt-1 text-[12px] text-muted">下次回访：{item.nextReviewAt}</p>}
          {isGoutFollowUp(item) ? <><p className="mt-2 text-[12px] leading-relaxed text-ink-soft">{goutSummary(item)}</p><Link to="/agent" className="mt-3 inline-flex text-[12px] font-medium text-brand-deep">告诉小满复查进度 →</Link></> : <>
          {item.status === '待回访' && item.nextReviewAt && item.nextReviewAt <= date && <p className="mt-2 rounded-lg bg-canvas p-2 text-[12px] text-ink-soft">回访判断：{assessmentFor(item).text}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
            {item.status === '待确认' && (!item.nextReviewAt || item.nextReviewAt <= date) && <><button className="min-h-9 rounded-lg bg-brand-soft px-2 py-1 text-brand-deep" onClick={() => updateFollowUp(item.id, (value) => confirmFollowUp(value, localTimestamp()))}>这项变化属实</button><button className="min-h-9 rounded-lg bg-canvas px-2 py-1" onClick={() => updateFollowUp(item.id, (value) => deferFollowUp(value, tomorrow(date), localTimestamp()))}>明天提醒</button></>}
            {item.status === '进行中' && !item.action && <button className="min-h-9 rounded-lg bg-brand-soft px-2 py-1 text-brand-deep" onClick={() => updateFollowUp(item.id, (value) => setFollowUpAction(value, '继续记录并观察变化', localTimestamp(), tomorrow(date)))}>开始跟踪</button>}
            {item.status === '进行中' && item.action && <><button className="min-h-9 rounded-lg bg-brand-soft px-2 py-1 text-brand-deep" onClick={() => updateFollowUp(item.id, (value) => recordFollowUpActionOutcome(value, '完成', undefined, localTimestamp(), tomorrow(date)))}>已完成</button><button className="min-h-9 rounded-lg bg-canvas px-2 py-1" onClick={() => { const reason = window.prompt('未完成的原因（可选）') ?? undefined; updateFollowUp(item.id, (value) => recordFollowUpActionOutcome(value, '未完成', reason, localTimestamp(), tomorrow(date))) }}>未完成</button></>}
            {item.status === '待回访' && item.nextReviewAt && item.nextReviewAt <= date && assessmentFor(item).kind !== 'missing_new_record' && <><button className="min-h-9 rounded-lg bg-brand-soft px-2 py-1 text-brand-deep" onClick={() => updateFollowUp(item.id, (value) => closeFollowUp(value, '回访后由用户确认结束', localTimestamp()))}>回访后结束</button><button className="min-h-9 rounded-lg bg-canvas px-2 py-1" onClick={() => updateFollowUp(item.id, (value) => setFollowUpAction(value, '继续记录并观察变化', localTimestamp(), tomorrow(date)))}>继续跟踪</button></>}
          </div>
          </>}
        </article>)}</div>}
      </section>
      <p className="pb-2 text-center text-[12px] text-muted">模拟读数不会生成个人回访事项；提醒只在打开应用时检查。</p>
    </div>
  </>
}
