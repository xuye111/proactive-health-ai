import { Link } from 'react-router-dom'
import { AppBar } from '../components/AppBar'
import { SectionTitle } from '../components/SectionTitle'
import { StageNotice } from '../components/StageNotice'
import { IconChevronRight } from '../components/icons'

/** 输出分级（方案 §26）：同样的数据，说成哪一类话是有边界的。 */
const LEVELS = [
  {
    title: '健康生活建议',
    latin: 'Lifestyle Advice',
    detail: '作息、饮食、活动安排，例如「今晚 23:30 前准备入睡」。',
    tone: 'brand' as const,
  },
  {
    title: '健康知识解释',
    latin: 'Health Information',
    detail: '解释指标与一般规律，标明来源，不给个体结论。',
    tone: 'brand' as const,
  },
  {
    title: '健康风险提示',
    latin: 'Risk Alert',
    detail: '提示指标持续异常或组合异常，建议关注并记录。',
    tone: 'warn' as const,
  },
  {
    title: '建议进一步医疗咨询',
    latin: 'Medical Escalation',
    detail: '停止普通健康建议，明确建议线下就医或咨询医生。',
    tone: 'danger' as const,
  },
]

const NOT_DOING = ['疾病诊断', '开具处方', '治疗决策', '替代急症判断', '个体风险评分']

const ESCALATION = [
  { step: '识别高风险信号', detail: '结构化信号命中阈值，或用户主动描述急症征兆' },
  { step: '停止普通建议', detail: '不再生成生活方式建议，避免被当成结论' },
  { step: '进入升级流程', detail: '给出明确的就医方向与时间建议' },
  { step: '保留记录并复核', detail: '事件写入记忆，等待人工复核' },
]

const TONE_CLASS = {
  brand: 'border-brand/25 bg-brand-soft/35 text-brand-deep',
  warn: 'border-warn/25 bg-warn-soft/70 text-warn',
  danger: 'border-danger/25 bg-danger/10 text-danger',
}

export default function Safety() {
  return (
    <>
      <AppBar title="数据与安全" subtitle="这个产品能做什么、不做什么" backTo="/profile" />

      <div className="space-y-5 px-4 pt-4">
        <StageNotice>
          本页是产品边界说明，也是能力展示的一部分：健康助手的可信度来自明确的禁区，而不是更多的功能。
        </StageNotice>

        {/* 输出分级 */}
        <section>
          <SectionTitle title="输出分级" hint="Agent 的每一句输出都属于其中一类" />
          <div className="space-y-2.5">
            {LEVELS.map((level) => (
              <article key={level.latin} className={`rounded-2xl border px-4 py-3 ${TONE_CLASS[level.tone]}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[14px] font-medium">{level.title}</h3>
                  <span className="text-[10px] tracking-wide opacity-70">{level.latin}</span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{level.detail}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 明确不做 */}
        <section>
          <SectionTitle title="明确不承担" />
          <ul className="card flex flex-wrap gap-2 p-4">
            {NOT_DOING.map((item) => (
              <li
                key={item}
                className="rounded-full border border-line bg-canvas px-2.5 py-1 text-[12px] text-ink-soft"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* 升级路径 */}
        <section>
          <SectionTitle title="升级流程" hint="触发高风险信号后发生什么" />
          <ol className="card divide-y divide-line-soft">
            {ESCALATION.map((item, index) => (
              <li key={item.step} className="flex gap-3 px-4 py-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-danger/10 text-[11px] font-medium text-danger">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] text-ink">{item.step}</p>
                  <p className="text-[11px] leading-snug text-muted">{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* 数据与隐私 */}
        <section>
          <SectionTitle title="数据与隐私" />
          <dl className="card divide-y divide-line-soft">
            <div className="flex gap-3 px-4 py-3">
              <dt className="w-[76px] shrink-0 text-[12px] text-muted">数据来源</dt>
              <dd className="min-w-0 flex-1 text-[13px] leading-snug text-ink">
                30 天演示数据（Mock），不含任何真实用户信息
              </dd>
            </div>
            <div className="flex gap-3 px-4 py-3">
              <dt className="w-[76px] shrink-0 text-[12px] text-muted">存储位置</dt>
              <dd className="min-w-0 flex-1 text-[13px] leading-snug text-ink">
                浏览器本地，不上传服务器
              </dd>
            </div>
            <div className="flex gap-3 px-4 py-3">
              <dt className="w-[76px] shrink-0 text-[12px] text-muted">来源登记</dt>
              <dd className="min-w-0 flex-1 text-[13px] leading-snug text-ink">
                知识条目标明来源与医学复核状态，二者分离
                <Link
                  to="/profile/knowledge"
                  className="mt-1.5 flex items-center gap-0.5 text-[12px] font-medium text-brand"
                >
                  查看知识条目的来源与复核状态
                  <IconChevronRight className="size-3.5" />
                </Link>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  )
}
