import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronRight, IconUser } from '../components/icons'
import { ASSISTANT_NAME } from '../lib/assistant'
import { clearPersonalFollowUps } from '../lib/followUpStore'
import { clearPersonalRecords, setPersonalProfile, setRemindersPaused, useHealthState } from '../lib/healthStore'

const groupTitle = 'mb-2 px-4 text-[13px] font-medium text-muted'
const group = 'rounded-2xl bg-surface ring-1 ring-line/60'
const row = 'flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-[16px] leading-snug text-ink active:bg-line-soft'
const field = 'mt-1 block min-h-11 w-full rounded-lg border border-line px-3 py-2 text-base text-ink'
const footer = 'mt-2 px-4 text-[13px] leading-relaxed text-muted'

export default function Profile() {
  const health = useHealthState()
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(false)
  const saveProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const birthYear = String(data.get('birthYear') ?? '')
    try {
      setPersonalProfile({
        displayName: String(data.get('displayName') ?? ''),
        focus: String(data.get('focus') ?? ''),
        ...(birthYear ? { birthYear: Number(birthYear) } : {}),
        ...(health.profile.heightCm ? { heightCm: health.profile.heightCm } : {}),
      })
      setNotice('个人资料已保存到本机')
      setEditing(false)
    } catch (error) { setNotice(error instanceof Error ? error.message : '保存失败') }
  }

  const remindersEnabled = !health.remindersPaused

  return <>
    <header className="safe-top px-5">
      <h1 className="pb-3 pt-4 text-[34px] font-bold leading-tight tracking-tight text-ink">我的</h1>
    </header>
    <div className="space-y-6 px-4 pb-5">
      <section aria-labelledby="profile-details">
        <h2 id="profile-details" className={groupTitle}>个人资料</h2>
        <div className={group}>
          <button type="button" aria-expanded={editing} onClick={() => setEditing(!editing)}
            className={row + ' w-full text-left'}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
              <IconUser className="size-6" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{health.profile.displayName || '设置称呼'}</span>
              <span className="block truncate text-[13px] text-muted">
                {health.profile.birthYear ? `${health.profile.birthYear} 年出生 · ` : ''}{health.profile.focus || '管理你的随访资料'}
              </span>
            </span>
            <span className="shrink-0 text-[15px] text-brand-deep">{editing ? '收起' : '编辑'}</span>
          </button>
          {editing && <form onSubmit={saveProfile} className="space-y-4 border-t border-line-soft px-4 py-4">
            <label className="block text-[13px] text-ink-soft">
              称呼
              <input name="displayName" maxLength={30} defaultValue={health.profile.displayName}
                placeholder="怎么称呼你" className={field} />
            </label>
            <label className="block text-[13px] text-ink-soft">
              出生年份（选填）
              <input name="birthYear" type="number" inputMode="numeric" min="1900" max={new Date().getFullYear()}
                defaultValue={health.profile.birthYear ?? ''} className={field} />
            </label>
            <label className="block text-[13px] text-ink-soft">
              随访关注点（选填）
              <input name="focus" maxLength={120} defaultValue={health.profile.focus}
                placeholder="例如：按时完成复查" className={field} />
            </label>
            <button type="submit" className="min-h-11 w-full rounded-xl bg-brand px-4 text-[16px] font-semibold text-white">
              保存资料
            </button>
          </form>}
        </div>
      </section>

      <section aria-labelledby="profile-reminders">
        <h2 id="profile-reminders" className={groupTitle}>提醒设置</h2>
        <div className={group}>
          <button type="button" role="switch" aria-checked={remindersEnabled} aria-describedby="profile-reminder-help"
            onClick={() => setRemindersPaused(remindersEnabled)} className={row + ' w-full justify-between text-left'}>
            <span>随访提醒</span>
            <span aria-hidden="true" className={`relative h-8 w-[51px] shrink-0 rounded-full transition-colors ${remindersEnabled ? 'bg-brand' : 'bg-line'}`}>
              <span className={`absolute left-0.5 top-0.5 size-7 rounded-full bg-white shadow-sm transition-transform ${remindersEnabled ? 'translate-x-[19px]' : ''}`} />
            </span>
          </button>
        </div>
        <p id="profile-reminder-help" className={footer}>{ASSISTANT_NAME}在打开应用时核对随访日期。安全提示始终优先。</p>
      </section>

      <section aria-labelledby="profile-data">
        <h2 id="profile-data" className={groupTitle}>本机数据</h2>
        <div className={group}>
          <Link to="/record" className={row + ' justify-between'}>
            <span>查看痛风记录</span>
            <IconChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
          </Link>
          <div className="ml-4 border-t border-line-soft" aria-hidden="true" />
          <button type="button" className={row + ' w-full text-left text-danger'} onClick={() => {
            if (window.confirm('确定清除本机填写的记录和跟进事项？')) {
              clearPersonalRecords()
              clearPersonalFollowUps()
              setNotice('已清除本机填写的记录和事项')
            }
          }}>清除记录与事项</button>
        </div>
        <p className={footer}>随访与对话保存在当前浏览器，化验报告由你确认后录入。</p>
      </section>

      <section aria-labelledby="profile-safety">
        <h2 id="profile-safety" className={groupTitle}>产品边界</h2>
        <div className={group}>
          <Link to="/profile/safety" className={row + ' justify-between'}>
            <span>数据与安全说明</span>
            <IconChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
          </Link>
        </div>
        <p className={footer}>适用于已由医生确诊痛风后的随访记录。检验结果与治疗安排请和医生确认。</p>
      </section>
      {notice && <p role="status" className="rounded-xl bg-brand-soft px-4 py-3 text-[13px] text-brand-deep">{notice}</p>}
    </div>
  </>
}
