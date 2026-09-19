import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppBar } from '../components/AppBar'
import { AssistantAvatar } from '../components/AssistantAvatar'
import { StageNotice } from '../components/StageNotice'
import { TracePanel } from '../components/TracePanel'
import { IconChevronRight } from '../components/icons'
import insights from '../data/insights.json'
import {
  ASK_SUGGESTIONS,
  LEVEL_LABEL,
  askKeyFor,
  healthEvidence,
  useAnswerView,
  useDailyRun,
  useTodayPlan,
} from '../lib/agentRules'
import { ASSISTANT_NAME } from '../lib/assistant'
import {
  askQuestion,
  resetFeedback,
  setAnswers,
  submitAnswers,
  useAgentState,
} from '../lib/agentStore'
import type { FollowUpOption, OutputLevel } from '../types'

const OPTIONS = insights.followUp.options as FollowUpOption[]
const EXCLUSIVE_IDS = new Set(OPTIONS.filter((option) => option.exclusive === true).map((o) => o.id))
const LABELS = new Map(OPTIONS.map((option) => [option.id, option.label]))

const LEVEL_STYLE: Record<OutputLevel, string> = {
  lifestyle: 'bg-brand-soft/70 text-brand-deep',
  information: 'bg-calm text-ink-soft',
  alert: 'bg-warn-soft text-warn',
  escalation: 'bg-danger/10 text-danger',
}

/** AI 侧消息：头像标明是谁在说，标签标明这条是主动发起还是要你确认。 */
function AssistantMessage({
  mode,
  title,
  tone = 'default',
  children,
}: {
  mode: '主动' | '你发起'
  title: string
  /** escalation 类回答不能看起来像普通建议，用独立的危险态样式。 */
  tone?: 'default' | 'danger'
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-2.5">
      <AssistantAvatar size={28} className="mt-0.5" />
      <div
        className={`min-w-0 flex-1 space-y-2 rounded-2xl rounded-tl-md border px-3.5 py-3 ${
          tone === 'danger' ? 'border-danger/30 bg-danger/5' : 'border-line bg-surface'
        }`}
      >
        <p className="flex items-center gap-1.5 text-[10px] text-muted">
          <span
            className={`rounded px-1.5 py-0.5 ${
              mode === '主动' ? 'bg-brand-soft/70 text-brand-deep' : 'bg-canvas text-ink-soft'
            }`}
          >
            {mode}
          </span>
          {title}
        </p>
        {children}
      </div>
    </div>
  )
}

function UserMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2.5 text-[13px] leading-relaxed text-white">
        {children}
      </p>
    </div>
  )
}

/** 一条用户提问：独立跑一次问答流水线，并把它的判断过程挂在自己下面。 */
function AskedAnswer({ question }: { question: string }) {
  const view = useAnswerView(question)
  return (
    <div className="space-y-3">
      <UserMessage>{question}</UserMessage>
      <AssistantMessage
        mode="你发起"
        title={view.level === 'escalation' ? '这条不是建议，请先处理' : '结合今天的记录回答'}
        tone={view.level === 'escalation' ? 'danger' : 'default'}
      >
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] ${LEVEL_STYLE[view.level]}`}>
          {LEVEL_LABEL[view.level]}
        </span>
        <p className="text-[13.5px] leading-relaxed text-ink">{view.text}</p>
        {view.evidence.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {view.evidence.map((item) => (
              <span key={item} className="rounded-md bg-canvas px-2 py-0.5 text-[11px] text-ink-soft">
                {item}
              </span>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted">已记入今日经历，下次会优先跟进这个问题。</p>
        <TracePanel trace={view.trace} />
      </AssistantMessage>
    </div>
  )
}

export default function Agent() {
  const { answers, submitted, asked } = useAgentState()
  const interpretation = useTodayPlan()
  const dailyRun = useDailyRun()
  // 开场事实直接取自信号层：界面展示的依据与判断用的依据是同一批
  const evidence = healthEvidence(dailyRun.run?.trace.signals ?? [])
  const [draft, setDraft] = useState('')

  const send = (text: string) => {
    const value = text.trim()
    if (value === '') return
    askQuestion({ key: askKeyFor(value), text: value })
    setDraft('')
  }

  const askedKeys = new Set(asked.map((entry) => entry.key))
  const suggestions = ASK_SUGGESTIONS.filter((item) => !askedKeys.has(item.id))
  const hasThread = submitted || asked.length > 0

  const toggle = (option: FollowUpOption) => {
    if (answers.includes(option.id)) {
      setAnswers(answers.filter((id) => id !== option.id))
      return
    }
    if (option.exclusive === true) {
      setAnswers([option.id])
      return
    }
    setAnswers([...answers.filter((id) => !EXCLUSIVE_IDS.has(id)), option.id])
  }

  return (
    <>
      <AppBar title={ASSISTANT_NAME} subtitle="你可以等我问，也可以直接问我" />

      <div className="space-y-4 px-4 pt-4">
        <StageNotice>
          第一阶段：{ASSISTANT_NAME}的判断与回答都由规则表算出（非 LLM），所以两条路径的行为都是真实发生的，可以反复走一遍。
        </StageNotice>

        {/* 两条路径：让「兼顾」这件事在界面上看得见 */}
        <section className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-brand/25 bg-brand-soft/25 px-3 py-2.5">
            <p className="text-[12px] font-medium text-brand-deep">{ASSISTANT_NAME}主动</p>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">数据有变化时先开口，追问后更新判断</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface px-3 py-2.5">
            <p className="text-[12px] font-medium text-ink">你发起</p>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">随时提问，回答基于同一份上下文</p>
          </div>
        </section>

        {/* 小满已经了解：两条路径共用同一份状态 */}
        <section className="card p-3.5">
          <div className="flex items-center gap-2.5">
            <AssistantAvatar size={32} online />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-ink-soft">{ASSISTANT_NAME}已经了解</p>
              <p className="text-[10px] text-muted">睡眠 / 活动 / 饮食 / 主观状态</p>
            </div>
            {submitted && <span className="shrink-0 text-[10px] text-brand">已更新</span>}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {interpretation.understanding.map((item) => (
              <span
                key={item}
                className="rounded-full border border-brand/25 bg-brand-soft/60 px-2.5 py-1 text-[12px] text-brand-deep"
              >
                {item}
              </span>
            ))}
          </div>
        </section>

        <div className="space-y-3">
          {/* 主动路径一：小满先摆事实 */}
          <AssistantMessage mode="主动" title="先说我现在看到的">
            <div className="flex flex-wrap gap-1.5">
              {evidence.map((item) => (
                <span key={item} className="rounded-md bg-canvas px-2 py-0.5 text-[11px] text-ink-soft">
                  {item}
                </span>
              ))}
            </div>
            <p className="text-[13.5px] leading-relaxed text-ink">{insights.finding.summary}</p>
            <p className="text-[12px] leading-relaxed text-ink-soft">{insights.finding.suggestion}</p>
          </AssistantMessage>

          {/* 主动路径二：追问 → 用户反馈 → 更新判断 */}
          {!submitted ? (
            <AssistantMessage mode="主动" title="需要你确认">
              <p className="text-[13.5px] leading-relaxed text-ink">{insights.followUp.question}</p>
              <div className="space-y-1.5" role="group" aria-label="最近出现的情况">
                {OPTIONS.map((option) => {
                  const selected = answers.includes(option.id)
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggle(option)}
                      className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[13px] transition-colors ${
                        selected
                          ? 'border-brand bg-brand-soft/50 text-brand-deep'
                          : 'border-line bg-surface text-ink-soft'
                      }`}
                    >
                      <span
                        className={`flex size-[17px] shrink-0 items-center justify-center rounded-[6px] border ${
                          selected ? 'border-brand bg-brand text-white' : 'border-line'
                        }`}
                      >
                        {selected && (
                          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12.5l4.5 4.5L19 7.5" />
                          </svg>
                        )}
                      </span>
                      {option.label}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                disabled={answers.length === 0}
                onClick={submitAnswers}
                className="w-full rounded-xl bg-brand py-2.5 text-[14px] font-medium text-white transition-opacity disabled:opacity-40"
              >
                提交反馈
              </button>
              <p className="text-[10px] text-muted">可多选；选择「没有明显感觉」会取消其它选项</p>
            </AssistantMessage>
          ) : (
            <>
              <UserMessage>
                {answers.map((id) => LABELS.get(id) ?? id).join('、')}
              </UserMessage>

              <AssistantMessage mode="主动" title="更新后的判断">
                <p className="text-[13.5px] leading-relaxed text-ink">{interpretation.judgment}</p>

                {interpretation.changes.length > 0 && (
                  <div className="rounded-xl bg-canvas px-3 py-2">
                    <p className="text-[11px] font-medium text-ink-soft">你的反馈改变了什么</p>
                    <ul className="mt-1 space-y-1">
                      {interpretation.changes.map((change) => (
                        <li key={change} className="text-[12px] leading-snug text-ink">
                          · {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-[11px] leading-relaxed text-muted">
                  已写入记忆：{interpretation.memoryNotes.join('；')}
                </p>

                <Link
                  to="/record"
                  className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-[13px] text-brand"
                >
                  查看更新后的今日行动（{interpretation.actions.length} 条）
                  <IconChevronRight className="size-4" />
                </Link>

                <TracePanel trace={interpretation.trace} />
              </AssistantMessage>
            </>
          )}

          {/* 自主路径：用户提问 → 基于同一上下文的回答 + 输出分级 + 判断过程 */}
          {asked.map((entry) => (
            <AskedAnswer key={`${entry.text}-${entry.key}`} question={entry.text} />
          ))}
        </div>

        {/* 快捷提问：规则实现答不了任意问题，就把能答的摆出来 */}
        {suggestions.length > 0 && (
          <section>
            <p className="mb-2 px-1 text-[11px] text-muted">可以试着问{ASSISTANT_NAME}（也可以直接输入）</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => send(item.label)}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-ink-soft"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        )}

        <details className="card px-4 py-3">
          <summary className="cursor-pointer text-[12px] font-medium text-ink-soft">
            为什么不做成通用聊天窗口
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-muted">传统健康问答</p>
              <ol className="mt-1.5 space-y-1 text-[11px] leading-snug text-ink-soft">
                <li>1. 用户提问</li>
                <li>2. 助手回答</li>
                <li>3. 对话结束</li>
              </ol>
            </div>
            <div>
              <p className="text-[11px] text-brand-deep">主动健康助手</p>
              <ol className="mt-1.5 space-y-1 text-[11px] leading-snug text-ink-soft">
                <li>1. 自己发现变化</li>
                <li>2. 主动追问</li>
                <li>3. 用户反馈或提问</li>
                <li>4. 更新判断与计划</li>
              </ol>
            </div>
          </div>
        </details>

        {hasThread && (
          <button
            type="button"
            onClick={resetFeedback}
            className="w-full rounded-xl border border-line bg-surface py-2.5 text-[13px] text-ink-soft"
          >
            清空这段对话（演示用）
          </button>
        )}
      </div>

      {/* 自主入口：sticky 在底部导航之上 */}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          send(draft)
        }}
        className="composer-dock sticky z-20 mt-4 border-t border-line bg-surface/95 px-4 py-2.5 backdrop-blur-md"
      >
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`问问${ASSISTANT_NAME}，比如：今天适合运动吗`}
            aria-label={`向${ASSISTANT_NAME}提问`}
            className="min-w-0 flex-1 rounded-full border border-line bg-canvas px-3.5 py-2 text-[13px] outline-none placeholder:text-muted focus:border-brand"
          />
          <button
            type="submit"
            disabled={draft.trim() === ''}
            className="shrink-0 rounded-full bg-brand px-4 py-2 text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
          >
            发送
          </button>
        </div>
      </form>
    </>
  )
}
