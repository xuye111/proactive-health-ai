import { Link } from 'react-router-dom'
import { AppBar } from '../components/AppBar'
import { SectionTitle } from '../components/SectionTitle'
import {
  IconBook,
  IconBrain,
  IconChevronRight,
  IconGraph,
  IconShield,
} from '../components/icons'
import profile from '../data/profile.json'
import { ASSISTANT_NAME } from '../lib/assistant'
import { today } from '../lib/derive'
import { KNOWLEDGE } from '../lib/knowledge'
import { useMemoryEntries } from '../lib/agentRules'

const BACKGROUND_ROWS = [
  { label: '既往史', value: profile.background.history },
  { label: '家族史', value: profile.background.family },
  { label: '药物', value: profile.background.medications },
  { label: '过敏史', value: profile.background.allergies },
]

const LIFESTYLE_ROWS = [
  { label: '睡眠', value: profile.lifestyle.sleep },
  { label: '饮食', value: profile.lifestyle.diet },
  { label: '运动', value: profile.lifestyle.exercise },
  { label: '烟酒', value: profile.lifestyle.habits },
]

export default function Profile() {
  const memories = useMemoryEntries()

  const secondary = [
    {
      id: 'memory',
      to: '/profile/memory',
      label: '长期记忆',
      hint: `${ASSISTANT_NAME}对你的长期理解`,
      meta: `${memories.length} 条`,
      Icon: IconBrain,
    },
    {
      id: 'knowledge',
      to: '/profile/knowledge',
      label: '知识管理',
      hint: 'Markdown 条目 · 关键词检索',
      meta: `${KNOWLEDGE.length} 个条目`,
      Icon: IconBook,
    },
    {
      id: 'graph',
      to: '/profile/graph',
      label: '知识图谱',
      hint: '实体与关系 · 局部视图',
      meta: '12 个实体',
      Icon: IconGraph,
    },
    {
      id: 'safety',
      to: '/profile/safety',
      label: '数据与安全',
      hint: '能力边界、输出分级与升级路径',
      meta: '',
      Icon: IconShield,
    },
  ]

  return (
    <>
      <AppBar title="我的" subtitle={`健康档案是${ASSISTANT_NAME}了解你的长期上下文`} />

      <div className="space-y-5 px-4 pt-4">
        {/* 基本信息 */}
        <section className="card flex items-center gap-4 p-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[20px] font-semibold text-brand-deep">
            {profile.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-ink">{profile.name}</h2>
            <p className="mt-0.5 text-[12px] text-ink-soft">
              {profile.age} 岁 · {profile.gender} · {profile.heightCm} cm · {today.weightKg} kg
            </p>
          </div>
        </section>

        {/* 健康目标 */}
        <section>
          <SectionTitle title="健康目标" />
          <div className="card divide-y divide-line-soft">
            {profile.goals.map((goal) => (
              <div key={goal.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 rounded-full border border-brand/25 bg-brand-soft/50 px-2 py-0.5 text-[11px] whitespace-nowrap text-brand-deep">
                  {goal.label}
                </span>
                <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-soft">{goal.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 健康背景 */}
        <section>
          <SectionTitle title="健康背景" />
          <dl className="card divide-y divide-line-soft">
            {BACKGROUND_ROWS.map((row) => (
              <div key={row.label} className="flex gap-3 px-4 py-3">
                <dt className="w-[60px] shrink-0 text-[12px] text-muted">{row.label}</dt>
                <dd className="min-w-0 flex-1 text-[13px] leading-snug text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 生活方式 */}
        <section>
          <SectionTitle title="生活方式" />
          <dl className="card divide-y divide-line-soft">
            {LIFESTYLE_ROWS.map((row) => (
              <div key={row.label} className="flex gap-3 px-4 py-3">
                <dt className="w-[60px] shrink-0 text-[12px] text-muted">{row.label}</dt>
                <dd className="min-w-0 flex-1 text-[13px] leading-snug text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 二级页面：四项都可以进 */}
        <section>
          <SectionTitle title="更多" hint={`${ASSISTANT_NAME}的记忆、知识与边界`} />
          <div className="card divide-y divide-line-soft overflow-hidden">
            {secondary.map(({ id, to, label, hint, meta, Icon }) => (
              <Link key={id} to={to} className="flex items-center gap-3 px-4 py-3">
                <Icon className="size-[18px] shrink-0 text-ink-soft" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] text-ink">{label}</p>
                  <p className="text-[11px] text-muted">{hint}</p>
                </div>
                {meta !== '' && <span className="shrink-0 text-[10px] text-muted">{meta}</span>}
                <IconChevronRight className="size-4 shrink-0 text-muted" />
              </Link>
            ))}
          </div>
        </section>

        <p className="pb-2 text-center text-[10px] leading-relaxed text-muted">
          主动健康助手 · v0.1.0（第一阶段外壳）
          <br />
          全部为演示数据，非真实用户信息
        </p>
      </div>
    </>
  )
}
