import { useState } from 'react'
import type { FormEvent } from 'react'
import { saveGoutActivityAssessment } from '../ai/goutActivity'
import type { GoutFollowUp } from '../ai/goutFollowUp'
import { updateFollowUp } from '../lib/followUpStore'
import { localDate } from '../lib/healthStore'

const field = 'mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink'

export function GoutActivityForm({ item }: { item: GoutFollowUp }) {
  const [message, setMessage] = useState('')
  const { report, activity } = item.gout
  if (!report) return null
  const today = localDate()

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const flares = String(data.get('flares') ?? '').trim()
    const patientGlobal = String(data.get('patientGlobal') ?? '').trim()
    const tophi = String(data.get('tophi') ?? '').trim()
    if (!flares || !patientGlobal || !tophi) {
      setMessage('请填齐三项评估资料。只有确认没有时才填 0。')
      return
    }
    try {
      updateFollowUp(item.id, (current) => saveGoutActivityAssessment(current, {
        assessedOn: String(data.get('assessedOn') ?? ''),
        flares: Number(flares), patientGlobal: Number(patientGlobal), tophi: Number(tophi),
      }, localDate()))
      setMessage('已保存本次活动度资料。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败，请核对资料。')
    }
  }

  return <details className="mt-3 rounded-xl border border-line p-3">
    <summary className="cursor-pointer py-1 text-[13px] font-medium text-brand-deep">
      {activity ? '查看或更正活动度资料' : '补充活动度资料'}
    </summary>
    <p className="mt-2 text-[12px] text-muted">本次使用 {report.sampledOn} 采样的血尿酸。请填写同一次评估的资料，未知项可等确认后再填。</p>
    <form className="mt-3 space-y-3 text-[13px] text-ink-soft" onSubmit={save}>
      <label className="block">评估日期
        <input className={field} name="assessedOn" type="date" required min={report.sampledOn} max={today}
          defaultValue={activity?.assessedOn ?? today} />
      </label>
      <label className="block">评估日前 12 个月痛风发作次数
        <input className={field} name="flares" type="number" inputMode="numeric" min="0" step="1" required defaultValue={activity?.flares} />
      </label>
      <label className="block">痛风活动度总体自评（0 最低，10 最高）
        <input className={field} name="patientGlobal" type="number" inputMode="decimal" min="0" max="10" step="0.1" required
          defaultValue={activity?.patientGlobal} />
      </label>
      <label className="block">医生评估的痛风石数量
        <input className={field} name="tophi" type="number" inputMode="numeric" min="0" step="1" required defaultValue={activity?.tophi} />
      </label>
      <button type="submit" className="min-h-11 rounded-lg bg-brand px-4 text-[13px] font-medium text-white">保存评估资料</button>
    </form>
    {message && <p role="status" className="mt-2 text-[12px] text-ink-soft">{message}</p>}
  </details>
}
