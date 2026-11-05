import { Link } from 'react-router-dom'
import {
  GOUT_ACTIVITY_CLINICALLY_REVIEWED, GOUT_ACTIVITY_SOURCE, goutActivityScore, goutActivitySeries,
} from '../ai/goutActivity'
import { goutBaseline, isGoutFollowUp } from '../ai/goutFollowUp'
import { GoutActivityTrend } from '../components/GoutActivityTrend'
import { useFollowUps } from '../lib/followUpStore'

const demoAssessments = [
  { assessedOn: '2026-08-05', flares: 5, patientGlobal: 6, tophi: 1, urate: 480 },
  { assessedOn: '2026-09-05', flares: 5, patientGlobal: 4, tophi: 1, urate: 412 },
  { assessedOn: '2026-11-05', flares: 4, patientGlobal: 2, tophi: 1, urate: 355 },
]

export default function Home() {
  const items = useFollowUps().filter(isGoutFollowUp)
  const demo = import.meta.env.DEV && typeof window !== 'undefined' &&
    new URLSearchParams(window.location?.search).get('demo') === 'activity'
  const points = demo ? demoAssessments.map(({ urate, ...assessment }) => ({
    assessedOn: assessment.assessedOn,
    score: goutActivityScore(assessment, { sampledOn: assessment.assessedOn, urate, unit: 'µmol/L', source: '演示化验' }),
  })) : GOUT_ACTIVITY_CLINICALLY_REVIEWED ? goutActivitySeries(items) : []
  const latest = points.at(-1)
  const hasAssessment = items.some(({ gout }) => gout.activity !== undefined)
  const { firstReport, latestReport, firstResolvedOn, latestResolvedOn } = goutBaseline(demo ? [] : items)
  const reportPoints = [{ label: '首份已关联报告', report: firstReport }]
  if (latestReport && latestReport !== firstReport) reportPoints.push({ label: '最近已关联报告', report: latestReport })

  return <>
    <header className="safe-top px-5 pb-4 pt-6">
      <p className="text-[13px] font-medium text-brand-deep">小满 · 主动健康</p>
      <h1 className="mt-1 text-[26px] font-semibold text-ink">我的痛风管理</h1>
      <p className="mt-1 text-[13px] text-ink-soft">从个人基线出发，持续看见变化。</p>
    </header>
    <div className="space-y-4 px-4 pb-4">
      <section className="status-hero p-5 text-white" aria-labelledby="gout-activity">
        <div className="flex items-center justify-between gap-2">
          <h2 id="gout-activity" className="text-[16px] font-semibold">痛风活动度总分</h2>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px]">{demo ? '模拟示例' : 'GAS-3c'}</span>
        </div>
        {latest ? <>
          <p className="mt-3 text-[46px] font-semibold leading-none tabular-nums">{latest.score.toFixed(2)}</p>
          <p className="mt-2 text-[12px] text-white/85">评估于 {latest.assessedOn} · 分数越低，活动度越低</p>
          <GoutActivityTrend points={points} />
        </> : <>
          <p className="mt-4 text-[30px] font-semibold leading-tight">{hasAssessment ? '待医学复核' : '待评估'}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/90">{hasAssessment
            ? '已保存四项评估资料，医学复核后展示分数。'
            : '录入血尿酸、近 12 个月发作次数、总体自评和医生评估的痛风石数量。'}</p>
          <Link to="/record" className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-white px-4 text-[13px] font-medium text-brand-deep">查看和补充评估资料</Link>
        </>}
        <a href={GOUT_ACTIVITY_SOURCE} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[12px] text-white/85 underline underline-offset-2">评分依据 · GAS-3c</a>
        {demo && <a href="?preview=phone#/" className="ml-4 text-[12px] text-white/85 underline underline-offset-2">回到我的数据</a>}
      </section>
      <section className="card p-4" aria-labelledby="gout-baseline">
        <h2 id="gout-baseline" className="text-[16px] font-semibold text-ink">我的痛风基线</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">用本人确认的化验和症状记录，查看自己的起点和最近记录。</p>
        {demo ? <dl className="mt-3 grid grid-cols-2 gap-3">
          <div><dt className="text-[12px] text-muted">示例首份血尿酸</dt><dd className="font-semibold">{demoAssessments[0].urate} µmol/L</dd></div>
          <div><dt className="text-[12px] text-muted">示例最近血尿酸</dt><dd className="font-semibold">{demoAssessments[demoAssessments.length - 1].urate} µmol/L</dd></div>
        </dl> : <dl className="mt-3 divide-y divide-line-soft">
          {reportPoints.map(({ label, report }) => <div key={label} className="py-2">
            <dt className="text-[12px] font-medium text-ink-soft">{label}</dt>
            {report ? <dd className="mt-1">
              <p className="text-[16px] font-semibold text-ink">{report.urate} {report.unit}</p>
              <p className="text-[12px] text-muted">{report.sampledOn} 采样 · {report.source}</p>
            </dd> : <dd className="mt-1 text-[13px] text-muted">暂无已关联的血尿酸报告</dd>}
          </div>)}
          <div className="py-2">
            <dt className="text-[12px] font-medium text-ink-soft">首条症状缓解记录</dt>
            <dd className="mt-1 text-[13px] text-ink">{firstResolvedOn ?? '暂无缓解记录'}</dd>
            {latestResolvedOn && latestResolvedOn !== firstResolvedOn &&
              <dd className="mt-1 text-[12px] text-muted">最近一次记录为 {latestResolvedOn}</dd>}
          </div>
        </dl>}
      </section>
    </div>
  </>
}
