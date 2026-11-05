import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { answerGoutChat, type GoutChatAction } from '../ai/goutChat'
import { goutPrompt, isGoutFollowUp } from '../ai/goutFollowUp'
import { goutKnowledgeById } from '../ai/goutKnowledge'
import { AppBar } from '../components/AppBar'
import { IconSparkle } from '../components/icons'
import { ASSISTANT_NAME } from '../lib/assistant'
import { recordPersonalSafety, useFollowUps } from '../lib/followUpStore'
import { localDate, localTimestamp, useHealthState } from '../lib/healthStore'

type Turn = {
  text: string
  answer: string
  evidence: string[]
  escalation: boolean
  knowledgeId?: string
  action?: GoutChatAction
}
const chatKey = 'pha.xiaoman.goutChat.v1'
const suggestions = [
  { label: '查复查进度', question: '我的复查进度是什么？' },
  { label: '录入报告', question: '我想录入化验报告' },
  { label: '发作后为什么复诊？', question: '发作缓解后为什么还要复诊？' },
]
const taskLink = (itemId?: string) => `/record?view=tasks${itemId ? `&item=${encodeURIComponent(itemId)}` : ''}`
const avatarClass = 'flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep'
const taskLinkClass = 'inline-flex min-h-11 items-center text-[13px] font-medium text-brand-deep'

function loadTurns(): Turn[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(chatKey) ?? '[]')
    return Array.isArray(value) ? value.filter((turn): turn is Turn =>
      typeof turn?.text === 'string' && typeof turn?.answer === 'string' &&
      Array.isArray(turn?.evidence) && typeof turn?.escalation === 'boolean').slice(-30) : []
  } catch { return [] }
}

export default function Agent() {
  const { search } = useLocation()
  const focusedId = new URLSearchParams(search).get('item')
  const followUps = useFollowUps()
  const health = useHealthState()
  const [draft, setDraft] = useState('')
  const [turns, setTurns] = useState<Turn[]>(loadTurns)
  const [now, setNow] = useState(() => new Date())
  const end = useRef<HTMLDivElement>(null)
  const sent = useRef(false)
  const date = localDate(now)
  const hour = now.getHours()
  const quiet = health.remindersPaused || hour >= 22 || hour < 8
  const goutItems = followUps.filter(isGoutFollowUp)
  const focused = goutItems.find((item) => item.id === focusedId)
  const safetyItems = followUps.filter((item) => item.status === '建议就医' && !isGoutFollowUp(item))
  const candidate = focused ?? goutItems.filter((item) => item.status !== '已结束' && item.status !== '建议就医' && item.nextReviewAt)
    .sort((a, b) => (a.nextReviewAt ?? '').localeCompare(b.nextReviewAt ?? ''))[0]
  const proactivePrompt = candidate && !quiet && safetyItems.length === 0 ? goutPrompt(candidate, date) : null

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    try { window.localStorage.setItem(chatKey, JSON.stringify(turns)) } catch { /* 本机存储不可用时仍可对话 */ }
    if (sent.current) {
      end.current?.scrollIntoView({ block: 'nearest' })
      sent.current = false
    }
  }, [turns])

  const send = (input = draft) => {
    const text = input.trim().slice(0, 500)
    if (!text) return
    const reply = answerGoutChat(text, followUps, focusedId)
    if (reply.safety) recordPersonalSafety(reply.safety, localTimestamp())
    const { answer, evidence, escalation, knowledgeId, action } = reply
    sent.current = true
    setTurns((current) => [...current, { text, answer, evidence, escalation, knowledgeId, action }].slice(-30))
    setDraft('')
  }

  return <>
    <AppBar title={ASSISTANT_NAME} subtitle="痛风管理助手" right={turns.length > 0 &&
      <button type="button" onClick={() => setTurns([])} className="min-h-11 px-2 text-[12px] font-medium text-brand-deep">清空对话</button>
    } />
    <div className="agent-chat">
      <div className="space-y-4 px-4 pt-4">
        {safetyItems.length > 0 && <section role="alert" className="rounded-xl border border-danger/40 bg-danger/5 p-4 text-[13px] text-danger">
          <p className="font-medium">此前提问触发了就医提示</p>
          {safetyItems.map((item) => <p key={item.id} className="mt-2">{item.topic}：{item.evidence.at(-1)?.details.join('；') || '请联系专业人员评估。'}</p>)}
        </section>}
        {focused && <div className="flex flex-wrap items-center justify-between gap-x-2 rounded-xl bg-brand-soft/55 px-3 text-[12px] text-ink-soft">
          <span className="py-2">当前事项 · {focused.topic}{focused.gout.dueOn ? ` · ${focused.gout.dueOn}` : ''}</span>
          <Link to={taskLink(focused.id)} className={taskLinkClass}>查看任务</Link>
        </div>}
        {(turns.length === 0 || proactivePrompt) && <div className="flex items-start gap-2">
          <span className={avatarClass}><IconSparkle className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0 rounded-2xl rounded-tl-sm bg-surface px-4 py-3 text-[14px] leading-relaxed text-ink">
            <p>{proactivePrompt || '你好，我是小满。你可以问我复查进度，也可以聊聊痛风管理。'}</p>
            {proactivePrompt && candidate && <Link to={taskLink(candidate.id)} className={taskLinkClass}>去更新这项任务 →</Link>}
          </div>
        </div>}
        {turns.length === 0 && <div className="flex flex-wrap gap-2 pl-10" aria-label="快捷提问">
          {suggestions.map(({ label, question }) =>
            <button key={question} type="button" onClick={() => send(question)}
              className="min-h-11 rounded-full border border-brand/20 bg-surface px-3 text-[12px] font-medium text-brand-deep">{label}</button>
          )}
        </div>}
        <div role="log" aria-label="与小满的对话" className="space-y-4">
          {turns.map((turn, index) => {
            const source = typeof turn.knowledgeId === 'string' ? goutKnowledgeById(turn.knowledgeId)?.source : undefined
            const action = !turn.escalation && turn.action?.kind === 'openTasks' ? turn.action : undefined
            return <div key={index} className="space-y-3 text-[14px] leading-relaxed">
              <p className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-brand px-4 py-2 text-white">{turn.text}</p>
              <div className="flex items-start gap-2">
                <span className={avatarClass}><IconSparkle className="size-5" aria-hidden="true" /></span>
                <div className={`min-w-0 rounded-2xl rounded-tl-sm px-4 py-3 ${turn.escalation ? 'border border-danger/30 bg-danger/5 text-danger' : 'bg-surface text-ink'}`}>
                  <p className="whitespace-pre-wrap break-words">{turn.answer}</p>
                  {action && <Link to={taskLink(typeof action.itemId === 'string' ? action.itemId : undefined)} className={taskLinkClass}>
                    {action.itemId ? '查看对应任务' : '打开随访任务'} →
                  </Link>}
                  {source && <a href={source.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center text-[12px] text-brand-deep underline underline-offset-2">{source.label}</a>}
                  {turn.evidence.length > 0 && <details className="mt-2 text-[12px] text-ink-soft">
                    <summary className="cursor-pointer">查看依据</summary>
                    <ul className="mt-1">{turn.evidence.map((entry, i) => <li key={i}>· {entry}</li>)}</ul>
                  </details>}
                </div>
              </div>
            </div>
          })}
        </div>
      </div>
      <div ref={end} className="agent-chat-end" />
      <form onSubmit={(event) => { event.preventDefault(); send() }} className="agent-chat-composer flex items-end gap-2 border-t border-line px-4 py-3">
        <textarea aria-label="向小满提问" value={draft} onChange={(event) => setDraft(event.target.value)} rows={1} maxLength={500}
          placeholder="跟小满聊聊…" className="min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-line bg-surface px-3 py-2.5 text-base text-ink" />
        <button type="submit" disabled={!draft.trim()}
          className="min-h-11 rounded-2xl bg-brand px-4 text-[14px] font-medium text-white disabled:opacity-45">发送</button>
      </form>
    </div>
  </>
}
