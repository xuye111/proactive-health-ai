import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

const values = new Map()
globalThis.window = { localStorage: {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
} }
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'silent' })
try {
  const { default: Home } = await server.ssrLoadModule('/src/pages/Home.tsx')
  const { default: Agent } = await server.ssrLoadModule('/src/pages/Agent.tsx')
  const { default: Record } = await server.ssrLoadModule('/src/pages/Record.tsx')
  const { default: Profile } = await server.ssrLoadModule('/src/pages/Profile.tsx')
  const store = await server.ssrLoadModule('/src/lib/followUpStore.ts')
  const gout = await server.ssrLoadModule('/src/ai/goutFollowUp.ts')
  const { saveGoutActivityAssessment } = await server.ssrLoadModule('/src/ai/goutActivity.ts')
  const { answerGoutChat } = await server.ssrLoadModule('/src/ai/goutChat.ts')
  const { localDate, localTimestamp } = await server.ssrLoadModule('/src/lib/healthStore.ts')
  const render = (Page, url = '/') => renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [url] }, React.createElement(Page)))
  const emptyHome = render(Home)
  assert.match(emptyHome, /痛风活动度总分/)
  assert.match(emptyHome, /待评估/)
  assert.match(emptyHome, /暂无已关联的血尿酸报告/)
  assert.doesNotMatch(emptyHome, /入睡目标|模拟设备数据|健康方案/)
  assert.match(render(Record), /还没有痛风记录/)
  assert.doesNotMatch(render(Record), /入睡趋势|睡眠时长/)
  assert.match(render(Profile), /提醒设置|产品边界/)
  assert.doesNotMatch(render(Profile), /我的入睡目标|硬件设备|知识管理/)
  assert.match(render(Agent, '/agent'), /向小满提问/)
  assert.doesNotMatch(render(Agent, '/agent'), /新增一次痛风随访|保存并开始跟进/)
  assert.match(render(Record, '/record?view=tasks'), /新增一次痛风随访/)
  assert.doesNotMatch(render(Record, '/record'), /新增一次痛风随访/)
  assert.doesNotMatch(render(Agent, '/agent'), /今晚的计划|睡前总刷手机|睡眠用品/)

  const today = localDate()
  const at = localTimestamp()
  store.startPersonalGoutFollowUp({ kind: 'scheduled', dueOn: today }, at)
  const first = store.loadFollowUps().find(gout.isGoutFollowUp)
  assert.ok(first)
  assert.doesNotMatch(render(Home), /下一件随访|打开这件随访|下次跟进|gout%3Ascheduled/)
  const focus = encodeURIComponent(first.id)
  assert.match(render(Agent, `/agent?item=${focus}`), /当前事项.*查看任务/s)
  const focusedTask = render(Record, `/record?view=tasks&item=${focus}`)
  assert.match(focusedTask, /下次跟进/)
  assert.match(focusedTask, /ring-2/)
  assert.match(focusedTask, new RegExp(`/agent\\?item=${focus}`))
  store.updateFollowUp(first.id, (item) => gout.applyGoutEvent(item, { kind: 'report', sampledOn: today, urate: 416, unit: 'µmol/L', source: '医院检验报告' }, at))
  const olderDate = new Date(`${today}T12:00:00`)
  olderDate.setDate(olderDate.getDate() - 1)
  const older = localDate(olderDate)
  store.startPersonalGoutFollowUp({ kind: 'scheduled', dueOn: older }, at)
  const olderItem = store.loadFollowUps().find((item) => item.gout?.dueOn === older)
  assert.ok(olderItem)
  store.updateFollowUp(olderItem.id, (item) => gout.applyGoutEvent(item, {
    kind: 'report', sampledOn: older, urate: 7, unit: 'mg/dL', source: '历史化验报告',
  }, at))
  const baselineHome = render(Home)
  assert.match(baselineHome, /首份已关联报告.*7 mg\/dL.*历史化验报告/s, 'baseline follows sampling date and preserves source and unit')
  assert.match(baselineHome, /最近已关联报告.*416 µmol\/L.*医院检验报告/s)
  assert.match(render(Record), /416 µmol\/L/)
  assert.match(render(Record), /补充活动度资料/)
  store.updateFollowUp(first.id, (item) => saveGoutActivityAssessment(item, {
    assessedOn: today, flares: 2, patientGlobal: 3, tophi: 0,
  }, today))
  assert.match(render(Record), /查看或更正活动度资料/)
  assert.match(render(Home), /待医学复核/)
  assert.doesNotMatch(render(Home), /活动度基线 \d|模拟示例/, 'complete real data stays gated')
  globalThis.window.location = { search: '?demo=activity' }
  const demoHome = render(Home)
  assert.match(demoHome, /模拟示例/)
  assert.match(demoHome, /活动度基线 \d/)
  assert.match(demoHome, /<polyline /)
  assert.doesNotMatch(demoHome, /医院检验报告|历史化验报告/, 'demo does not display the user’s data')
  delete globalThis.window.location
  assert.match(render(Record), /医院检验报告/)
  assert.match(render(Record), /结果解释和下一步安排：待与医生确认/)

  const tomorrow = new Date(`${today}T12:00:00`)
  tomorrow.setDate(tomorrow.getDate() + 1)
  store.startPersonalGoutFollowUp({ kind: 'scheduled', dueOn: localDate(tomorrow) }, at)
  const second = store.loadFollowUps().find((item) => item.gout?.dueOn === localDate(tomorrow))
  assert.ok(second)
  const reportReply = answerGoutChat('我的报告呢？', store.loadFollowUps())
  assert.match(reportReply.answer, /416 µmol\/L/, 'latest unfinished item must not hide an older linked report')
  assert.match(reportReply.answer, /痛风复查随访/)
  const records = store.loadFollowUps()
  const reportEntry = answerGoutChat('我想录入这次报告', records, second.id)
  assert.deepEqual(reportEntry.action, { kind: 'openTasks', itemId: second.id })
  assert.match(reportEntry.answer, /核对录入/)
  assert.equal(answerGoutChat('我想录报告', records).action?.kind, 'openTasks')
  values.set('pha.xiaoman.goutChat.v1', JSON.stringify([{ text: '我想录入这次报告', ...reportEntry }]))
  const actionPage = render(Agent, '/agent')
  assert.match(actionPage, new RegExp(`/record\\?view=tasks&amp;item=${encodeURIComponent(second.id)}`))
  assert.match(actionPage, /查看对应任务/)
  values.delete('pha.xiaoman.goutChat.v1')
  assert.match(answerGoutChat('这次报告呢？', records, second.id).answer, /这次报告尚未录入/)
  assert.doesNotMatch(answerGoutChat('这次报告呢？', records, second.id).answer, /416 µmol\/L/)
  assert.match(answerGoutChat('这次报告呢？', records).answer, /这次报告尚未录入/, 'unique active item can identify this round')
  assert.match(answerGoutChat(`${today} 的报告呢？`, records, second.id).answer, /416 µmol\/L/, 'explicit date overrides focus')
  assert.match(answerGoutChat('2020-01-01 的报告呢？', records, second.id).answer, /没有找到与 2020-01-01 关联/)
  assert.doesNotMatch(answerGoutChat('2020-01-01 的报告呢？', records, second.id).answer, /416 µmol\/L/)
  assert.match(answerGoutChat('上次结果是什么？', records, second.id).answer, /416 µmol\/L/)
  assert.match(answerGoutChat('下一次安排是什么？', records, first.id).answer, new RegExp(localDate(tomorrow)))
  assert.doesNotMatch(answerGoutChat('这次报告呢？', records, 'missing-item').answer, /416 µmol\/L/, 'invalid focus must not fall back to old report')
  const [, month, day] = localDate(tomorrow).split('-')
  const shortDateQuery = `${Number(month)}月${Number(day)}日这次复查的报告出来了吗？`
  const currentReport = answerGoutChat(shortDateQuery, records, first.id)
  assert.match(currentReport.answer, /这次报告尚未录入/, 'spoken date overrides a different focused round')
  assert.doesNotMatch(currentReport.answer, /416 µmol\/L/)
  const lastYear = String(Number(localDate(tomorrow).slice(0, 4)) - 1) + localDate(tomorrow).slice(4)
  const sameMonthDay = gout.createGoutFollowUp({ kind: 'scheduled', dueOn: lastYear }, at)
  assert.match(answerGoutChat(shortDateQuery, [...records, sameMonthDay], first.id).answer, /完整日期/)

  const knowledgeExamples = [
    ['痛风为什么会反复发作？', 'flare-urate-crystals', /尿酸盐结晶/],
    ['发作缓解后为什么还要复诊？', 'flare-follow-up', /复诊.*血尿酸/],
    ['饮食能预防痛风发作吗？', 'diet-evidence', /证据不足/],
  ]
  for (const [question, id, supportedClaim] of knowledgeExamples) {
    const answer = answerGoutChat(question, records, second.id)
    assert.equal(answer.knowledgeId, id)
    assert.match(answer.answer, supportedClaim)
    assert.doesNotMatch(answer.answer, /416 µmol\/L/, 'knowledge answer must not reuse a personal report')
  }
  for (const question of ['痛风吃车厘子可以治好吗？', '我这次的尿酸达标了吗？', '我不疼了，应该多久复查？']) {
    const answer = answerGoutChat(question, records, second.id)
    assert.match(answer.answer, /缺少足够依据/)
    assert.equal(answer.knowledgeId, undefined)
  }
  const question = '发作缓解后为什么还要复诊？'
  values.set('pha.xiaoman.goutChat.v1', JSON.stringify([{ text: question, ...answerGoutChat(question, records) }]))
  const citedPage = render(Agent, '/agent')
  assert.match(citedPage, /href="https:\/\/www\.nice\.org\.uk\/guidance\/ng219\/chapter\/Recommendations#follow-up-after-a-gout-flare"/)
  assert.match(citedPage, /NICE NG219 · 1\.3\.6/)
  values.delete('pha.xiaoman.goutChat.v1')
  const agentSource = await readFile(new URL('../src/pages/Agent.tsx', import.meta.url), 'utf8')
  assert.match(agentSource, /answerGoutChat\(text, followUps, focusedId\)/)
  assert.equal(answerGoutChat('痛风药怎么调整？', store.loadFollowUps()).escalation, true)
  assert.equal(answerGoutChat('痛风药怎么调整？', records, second.id).escalation, true, 'safety takes priority over focus')
  const mixedQuestion = answerGoutChat('胸痛，而且痛风为什么会反复发作？', records, second.id)
  assert.equal(mixedQuestion.escalation, true)
  assert.equal(mixedQuestion.knowledgeId, undefined, 'safety takes priority over knowledge')
  store.recordPersonalSafety({ ruleId: 'test', label: '需要就医评估', evidence: ['胸痛'], message: '请就医' }, at)
  assert.doesNotMatch(render(Home), /此前触发的就医提示/)
  assert.match(render(Agent, '/agent'), /此前提问触发了就医提示/)
  assert.doesNotMatch(render(Record), /胸痛/, 'safety item does not masquerade as a gout record')

  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const nav = await readFile(new URL('../src/components/BottomNav.tsx', import.meta.url), 'utf8')
  assert.match(app, /path="\/solutions" element={<Navigate to="\/" replace \/>}/)
  assert.match(app, /path="\/trends" element={<Navigate to="\/record" replace \/>}/)
  assert.match(nav, /label: '记录'/)
  assert.doesNotMatch(nav, /健康方案/)
  console.log('gout app: routes, scoped reports, evidence citations, unsupported questions and safety priority checks passed')
} finally { await server.close() }
