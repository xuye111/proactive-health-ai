import type { FollowUp } from './followUps'
import type { GoutData, GoutFollowUp } from './goutFollowUp'

export const GOUT_ACTIVITY_CLINICALLY_REVIEWED: boolean = false
export const GOUT_ACTIVITY_SOURCE = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5129490/'

export interface GoutActivityAssessment {
  assessedOn: string
  flares: number
  patientGlobal: number
  tophi: number
}

export interface GoutActivityPoint {
  assessedOn: string
  score: number
}

const validDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value

const validReport = (value: unknown): value is NonNullable<GoutData['report']> => {
  if (typeof value !== 'object' || value === null) return false
  const report = value as Record<string, unknown>
  return validDate(report.sampledOn) && typeof report.urate === 'number' && Number.isFinite(report.urate) && report.urate > 0 &&
    (report.unit === 'µmol/L' || report.unit === 'mg/dL') && typeof report.source === 'string' && report.source.trim().length > 0
}

export function isGoutActivityAssessment(value: unknown): value is GoutActivityAssessment {
  if (typeof value !== 'object' || value === null) return false
  const data = value as Record<string, unknown>
  return validDate(data.assessedOn) && typeof data.flares === 'number' && Number.isInteger(data.flares) && data.flares >= 0 &&
    typeof data.patientGlobal === 'number' && Number.isFinite(data.patientGlobal) && data.patientGlobal >= 0 && data.patientGlobal <= 10 &&
    typeof data.tophi === 'number' && Number.isInteger(data.tophi) && data.tophi >= 0
}

/** GAS3-step-c 原始加权公式；页面自行决定显示精度。 */
export function goutActivityScore(assessment: GoutActivityAssessment, report: NonNullable<GoutData['report']>): number {
  if (!isGoutActivityAssessment(assessment)) throw new Error('痛风活动度评估字段无效')
  if (!validReport(report)) throw new Error('缺少有效的血尿酸报告')
  const urateMgDl = report.unit === 'µmol/L' ? report.urate / 59.48 : report.urate
  return 0.09 * assessment.flares + 1.01 * Math.sqrt(urateMgDl) +
    0.34 * assessment.patientGlobal + 0.53 * Math.log1p(assessment.tophi)
}

/** 同一报告仅保存一份评估；再次提交会修正原评估，不改变随访流程。 */
export function saveGoutActivityAssessment(item: FollowUp, assessment: GoutActivityAssessment, today: string): GoutFollowUp {
  if (!validDate(today)) throw new Error('操作日期必须是有效日期（YYYY-MM-DD）')
  if (!isGoutActivityAssessment(assessment)) throw new Error('痛风活动度评估字段无效')
  const gout = item.gout
  if (!gout || gout.phase !== 'received' || !validReport(gout.report)) throw new Error('缺少本轮有效的血尿酸报告')
  if (assessment.assessedOn < gout.report.sampledOn || assessment.assessedOn > today)
    throw new Error('评估日期必须介于报告采样日和今天之间')
  return { ...item, gout: { ...gout, activity: { ...assessment } } }
}

/** 有效已关联报告才形成一个可绘制的历史点。 */
export function goutActivitySeries(items: readonly GoutFollowUp[]): GoutActivityPoint[] {
  return items.filter((item) => validReport(item.gout.report) && isGoutActivityAssessment(item.gout.activity) &&
    item.gout.activity.assessedOn >= item.gout.report.sampledOn)
    .sort((a, b) => a.gout.activity!.assessedOn.localeCompare(b.gout.activity!.assessedOn) ||
      a.gout.report!.sampledOn.localeCompare(b.gout.report!.sampledOn) || a.id.localeCompare(b.id))
    .map((item) => ({ assessedOn: item.gout.activity!.assessedOn, score: goutActivityScore(item.gout.activity!, item.gout.report!) }))
}
