import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
try {
  const followUps = await server.ssrLoadModule('/src/ai/followUps.ts')
  const store = await server.ssrLoadModule('/src/lib/followUpStore.ts')
  const sleepSignal = {
    type: 'sleep_decline', label: '睡眠下降', severity: 'watch',
    evidence: ['近 3 日睡眠 6.0 / 6.1 / 6.2 小时'], rule: '示例规则',
  }

  assert.equal(followUps.followUpThemeKey(sleepSignal), 'signal:sleep_decline')
  const created = followUps.createFollowUpFromSignal(sleepSignal, '2026-09-26T09:00:00.000Z')
  assert.equal(created.status, '待确认')
  assert.equal(created.evidence.length, 1)

  const merged = followUps.upsertFollowUpFromSignal([created], { ...sleepSignal, evidence: ['近 3 日睡眠 5.8 / 6.0 / 6.1 小时'] }, '2026-09-27T09:00:00.000Z')
  assert.equal(merged.items.length, 1, '同一未结束主题只保留一个事项')
  assert.equal(merged.items[0].evidence.length, 2, '新证据应追加到既有事项')
  assert.equal(merged.changed, true)
  assert.equal(followUps.upsertFollowUpFromSignal(merged.items, { ...sleepSignal, evidence: ['近 3 日睡眠 5.8 / 6.0 / 6.1 小时'] }, '2026-09-27T10:00:00.000Z').changed, false, '同日相同证据重复写入应幂等')
  const nextDay = followUps.upsertFollowUpFromSignal(merged.items, { ...sleepSignal, evidence: ['近 3 日睡眠 5.8 / 6.0 / 6.1 小时'] }, '2026-09-28T09:00:00.000Z')
  assert.equal(nextDay.items[0].evidence.length, 3, '跨日相同变化也要保留新日期证据')

  const deferred = followUps.deferFollowUp(merged.items[0], '2026-09-30', '2026-09-27T10:00:00.000Z')
  assert.equal(followUps.remindersFor([deferred], '2026-09-29', true).length, 0, '普通提醒在静音期间不出现')
  assert.equal(followUps.remindersFor([deferred], '2026-09-30', false)[0].kind, 'follow_up_due', '到期后应出现回访提醒')
  const closed = followUps.closeFollowUp(deferred, '回访结束', '2026-09-30T11:00:00.000Z')
  assert.equal(followUps.upsertFollowUpFromSignal([closed], sleepSignal, '2026-09-30T12:00:00.000Z').changed, false, '结案当天不立即重复提醒')
  const recurring = followUps.upsertFollowUpFromSignal([closed], sleepSignal, '2026-10-02T09:00:00.000Z').items
  assert.equal(new Set(recurring.map((item) => item.id)).size, 2, '后续新一轮事项必须有独立 id')

  const safety = followUps.escalateFollowUp(deferred, { ruleId: 'chest', label: '胸部症状', evidence: ['命中安全规则'] }, '2026-09-30T10:00:00.000Z')
  assert.equal(safety.status, '建议就医')
  assert.equal(followUps.remindersFor([safety], '2026-09-30', true)[0].priority, 'safety', '安全升级应优先于静音')
  const safetyCreated = followUps.upsertSafetyFollowUp([], { ruleId: 'chest', label: '胸部症状', evidence: ['就医提示'] }, '2026-09-30T10:00:00.000Z')
  assert.equal(safetyCreated.items[0].status, '建议就医')
  assert.equal(followUps.upsertSafetyFollowUp(safetyCreated.items, { ruleId: 'chest', label: '胸部症状', evidence: ['就医提示'] }, '2026-09-30T10:01:00.000Z').changed, false)
  assert.equal(followUps.assessFollowUp(deferred, [], false).kind, 'missing_new_record')
  assert.equal(followUps.assessFollowUp(deferred, [sleepSignal], true).kind, 'still_present')
  assert.equal(followUps.assessFollowUp(deferred, [], true).kind, 'not_seen_in_new_record')

  const memory = new Map()
  const fakeStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) }
  const repository = store.createFollowUpStore(fakeStorage)
  repository.save([safety])
  assert.deepEqual(repository.load(), [safety], '事项应以本机 JSON 保存并可恢复')
  memory.set('pha.followUps.v1', '{bad json')
  assert.deepEqual(repository.load(), [], '损坏的本机数据应安全降级为空事项')

  const gout = await server.ssrLoadModule('/src/ai/goutFollowUp.ts')
  const resolved = {
    id: 'gout:resolved:2026-11-01', themeKey: 'gout:resolved:2026-11-01', topic: '痛风本次发作随访',
    firstDetectedAt: '2026-11-01', status: '待确认', evidence: [], events: [], nextReviewAt: '2026-11-01',
    gout: { phase: 'unknown_plan', resolvedOn: '2026-11-01', note: '本次疼痛已缓解' },
  }
  assert.equal(gout.isGoutFollowUp(resolved), true)
  assert.match(gout.goutPrompt(resolved, '2026-11-01'), /复查|复诊/)
  assert.equal(gout.goutPrompt(resolved, '2026-10-31'), null)
  const noPlan = gout.applyGoutEvent(resolved, { kind: 'no_plan' }, '2026-11-01')
  assert.equal(noPlan.gout.phase, 'no_plan')
  assert.equal(noPlan.nextReviewAt, undefined, '无安排也未约回访时不催促')
  assert.equal(gout.goutPrompt(noPlan, '2026-11-10'), null)
  const visitOnly = gout.applyGoutEvent(resolved, { kind: 'visit_plan', visitOn: '2026-11-15' }, '2026-11-02')
  assert.equal(visitOnly.gout.phase, 'closed')
  assert.match(gout.goutSummary(visitOnly), /2026-11-15/)
  assert.equal(gout.goutPrompt(visitOnly, '2026-11-15'), null, '仅约复诊不进入查报告路径')
  assert.throws(() => gout.createGoutFollowUp({ kind: 'resolved', resolvedOn: '2026-11-03' }, '2026-11-02'), /未来/)
  assert.throws(() => gout.applyGoutEvent(resolved, { kind: 'no_plan', reviewOn: '2026-11-01' }, '2026-11-01'), /晚于今天/)
  const planned = gout.applyGoutEvent(resolved, { kind: 'plan', dueOn: '2026-11-20' }, '2026-11-02')
  assert.equal(planned.gout.resolvedOn, '2026-11-01', '接入安排后保留症状关联')
  assert.equal(gout.goutPrompt(planned, '2026-11-19'), null)
  assert.match(gout.goutPrompt(planned, '2026-11-20'), /还没检查|报告/)
  const deferredGout = gout.applyGoutEvent(planned, { kind: 'defer', reviewOn: '2026-11-23' }, '2026-11-20')
  assert.equal(deferredGout.gout.dueOn, '2026-11-20', '稍后处理不得改变医生复查日')
  assert.equal(deferredGout.nextReviewAt, '2026-11-23')
  const notTested = gout.applyGoutEvent(planned, { kind: 'not_tested', reviewOn: '2026-11-25', note: '出差' }, '2026-11-20')
  assert.equal(notTested.gout.phase, 'not_tested')
  assert.equal(notTested.gout.note, '本次疼痛已缓解', '检查障碍不能覆盖症状原始描述')
  assert.match(gout.goutPrompt(notTested, '2026-11-25'), /检查/)
  const waiting = gout.applyGoutEvent(planned, { kind: 'waiting_report', reviewOn: '2026-11-24' }, '2026-11-20')
  assert.equal(waiting.gout.phase, 'waiting_report')
  assert.match(gout.goutPrompt(waiting, '2026-11-24'), /报告/)
  const reportEvent = { kind: 'report', sampledOn: '2026-11-18', urate: 416, unit: 'µmol/L', source: '用户确认的本次检验报告', confirmEarly: true }
  const received = gout.applyGoutEvent(waiting, reportEvent, '2026-11-21')
  assert.equal(received.gout.phase, 'received')
  assert.equal(received.nextReviewAt, undefined)
  assert.match(gout.goutSummary(received), /416/)
  assert.match(gout.goutSummary(received), /2026-11-18/)
  assert.match(gout.goutSummary(received), /用户确认的本次检验报告/)
  assert.equal(gout.goutPrompt(received, '2026-11-24'), null)
  assert.equal(store.upsertPersonalGoutFollowUp([planned], { kind: 'scheduled', dueOn: '2026-11-20' }, '2026-11-03').changed, false, '两个入口的同一复查安排只保留原事项')
  assert.equal(store.upsertPersonalGoutFollowUp([received], { kind: 'scheduled', dueOn: '2026-11-20' }, '2026-11-23').changed, false, '已收报告后重复录入旧安排不自动重开')
  assert.equal(store.upsertPersonalGoutFollowUp([resolved], { kind: 'resolved', resolvedOn: '2026-11-01' }, '2026-11-02').changed, false, '同一缓解记录幂等')
  assert.equal(store.upsertPersonalGoutFollowUp([planned], { kind: 'scheduled', dueOn: '2026-12-20' }, '2026-11-03').items.length, 2, '不同复查安排可建立新事项')
  assert.throws(() => gout.applyGoutEvent(waiting, { ...reportEvent, confirmEarly: false }, '2026-11-21'), /提前|确认/)
  assert.throws(() => gout.applyGoutEvent(waiting, { ...reportEvent, sampledOn: '2026-10-01' }, '2026-11-21'), /旧报告|复查/)
  assert.throws(() => gout.applyGoutEvent(waiting, { ...reportEvent, sampledOn: '2026-11-22' }, '2026-11-21'), /未来/)
  assert.throws(() => gout.applyGoutEvent(waiting, { ...reportEvent, unit: undefined }, '2026-11-21'), /单位/)
  assert.throws(() => gout.applyGoutEvent(waiting, { ...reportEvent, source: '' }, '2026-11-21'), /来源/)
  assert.throws(() => gout.applyGoutEvent(waiting, { ...reportEvent, urate: -1 }, '2026-11-21'), /数值/)
  const closedGout = gout.applyGoutEvent(noPlan, { kind: 'close' }, '2026-11-03')
  assert.equal(closedGout.gout.phase, 'closed')
  assert.equal(gout.goutPrompt(closedGout, '2026-11-04'), null)
  assert.throws(() => gout.applyGoutEvent(closedGout, { kind: 'plan', dueOn: '2026-11-20' }, '2026-11-04'), /结束|结案/)

  const activity = await server.ssrLoadModule('/src/ai/goutActivity.ts')
  assert.equal(activity.GOUT_ACTIVITY_CLINICALLY_REVIEWED, false, '临床复核前只能用于模拟预览')
  const assessment = { assessedOn: '2026-11-21', flares: 2, patientGlobal: 6, tophi: 3 }
  const mgReport = { ...received.gout.report, urate: 7, unit: 'mg/dL' }
  const expected = 0.09 * 2 + 1.01 * Math.sqrt(7) + 0.34 * 6 + 0.53 * Math.log(4)
  assert.ok(Math.abs(activity.goutActivityScore(assessment, mgReport) - expected) < 1e-12, '公式应保持原始精度')
  assert.ok(Math.abs(activity.goutActivityScore(assessment, { ...mgReport, urate: 7 * 59.48, unit: 'µmol/L' }) - expected) < 1e-12, '两种尿酸单位应等价')
  assert.equal(activity.isGoutActivityAssessment({ ...assessment, flares: 0, patientGlobal: 0, tophi: 0 }), true, '零值有效')
  assert.ok(Math.abs(activity.goutActivityScore({ ...assessment, flares: 0, patientGlobal: 0, tophi: 0 }, mgReport) - 1.01 * Math.sqrt(7)) < 1e-12)
  for (const invalid of [
    { ...assessment, flares: -1 }, { ...assessment, flares: 1.5 }, { ...assessment, tophi: -1 },
    { ...assessment, tophi: 0.5 }, { ...assessment, patientGlobal: 11 }, { ...assessment, patientGlobal: NaN },
    { ...assessment, assessedOn: '2026-02-30' }, { ...assessment, flares: undefined },
  ]) {
    assert.equal(activity.isGoutActivityAssessment(invalid), false)
    assert.throws(() => activity.saveGoutActivityAssessment(received, invalid, '2026-11-22'), /无效/)
  }
  assert.throws(() => activity.saveGoutActivityAssessment(resolved, assessment, '2026-11-22'), /报告/)
  assert.throws(() => activity.saveGoutActivityAssessment(received, { ...assessment, assessedOn: '2026-11-17' }, '2026-11-22'), /评估日期/)
  assert.throws(() => activity.saveGoutActivityAssessment(received, { ...assessment, assessedOn: '2026-11-23' }, '2026-11-22'), /评估日期/)
  assert.throws(() => activity.saveGoutActivityAssessment(received, assessment, '2026-02-30'), /操作日期/)
  const assessed = activity.saveGoutActivityAssessment(received, assessment, '2026-11-22')
  assert.equal(gout.isGoutFollowUp(assessed), true)
  assert.deepEqual(assessed.gout.report, received.gout.report, '保存评估不改报告')
  assert.equal(assessed.gout.phase, 'received', '保存评估不重开随访')
  assert.deepEqual(assessed.events, received.events, '保存评估不新增随访事件')
  const corrected = activity.saveGoutActivityAssessment(assessed, { ...assessment, flares: 0 }, '2026-11-22')
  assert.equal(corrected.gout.activity.flares, 0, '同一报告可修正评估')
  assert.equal(activity.goutActivitySeries([received]).length, 0, '缺评估时无历史点')
  assert.equal(gout.isGoutFollowUp({ ...assessed, gout: { ...assessed.gout, report: undefined } }), false, '有评估必须有报告')
  assert.equal(gout.isGoutFollowUp({ ...assessed, gout: { ...assessed.gout, activity: { ...assessment, assessedOn: '2026-11-17' } } }), false, '评估不得早于采样日')
  const earlier = { ...assessed, id: 'earlier', gout: { ...assessed.gout, report: { ...mgReport, sampledOn: '2026-11-19', urate: 9 } } }
  const later = { ...assessed, id: 'later', gout: { ...assessed.gout, report: { ...mgReport, sampledOn: '2026-11-20' } } }
  const nextDayActivity = { ...assessed, id: 'next-day', gout: { ...assessed.gout, activity: { ...assessment, assessedOn: '2026-11-22' } } }
  assert.deepEqual(activity.goutActivitySeries([nextDayActivity, later, received, earlier]).map((point) => point.assessedOn),
    ['2026-11-21', '2026-11-21', '2026-11-22'], '按评估日排序，缺评估旧数据跳过')
  assert.equal(activity.goutActivitySeries([later, earlier])[0].score, activity.goutActivityScore(assessment, earlier.gout.report), '同日按采样日排序')

  repository.save([resolved, { ...resolved, id: 'bad', gout: { phase: 'scheduled' } }, { ...resolved, id: 'null', gout: null }, safety])
  assert.deepEqual(repository.load().map((item) => item.id), [resolved.id, safety.id], '专病载荷损坏时只排除该事项，旧记录继续加载')
  repository.save([waiting])
  const reopened = store.createFollowUpStore(fakeStorage).load()[0]
  assert.deepEqual(reopened, waiting, '重新打开后仍保留原复查日、待报告进度和下次回访日')
  assert.match(gout.goutPrompt(reopened, '2026-11-24'), /拿到这次的报告/)
  repository.save([assessed, received])
  assert.deepEqual(repository.load().map((item) => item.id), [assessed.id, received.id], '新旧痛风事项都能持久化')

  console.log('follow-ups: general and gout replay checks passed')
} finally {
  await server.close()
}
