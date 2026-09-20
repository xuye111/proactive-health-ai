#!/usr/bin/env node
/**
 * 评测 runner：跑真实的 AI 流水线（src/ai/agent.ts），而不是只跑规则函数。
 *
 * 两套记分卡：
 *   1. 行为套件 —— 判断与回答是否符合产品边界（A/B/C/D 类 + xfail 已知缺口）
 *   2. 守门套件 —— 用假模型喂进越界/畸形输出，验证守门层与降级路径是否可靠
 *      （不需要 API key，见 eval/guardrail-cases.json）
 *
 * 用法：
 *   npm run eval                     # 默认 rules provider
 *   npm run eval -- --provider=llm   # 需要 LLM_API_KEY，否则报错退出
 *   npm run eval -- --json           # 只输出 JSON 结果，便于 CI 归档
 */

import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const GREEN = '\u001b[32m'
const RED = '\u001b[31m'
const DIM = '\u001b[2m'
const BOLD = '\u001b[1m'
const RESET = '\u001b[0m'

const args = process.argv.slice(2)
const jsonOnly = args.includes('--json')
const verbose = args.includes('--verbose')
const providerArg = args.find((arg) => arg.startsWith('--provider='))?.split('=')[1] ?? 'rules'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../eval/${name}`, import.meta.url), 'utf8'))

const suite = readJson('cases.json')
const guardrailSuite = readJson('guardrail-cases.json')

const LEVELS = ['lifestyle', 'information', 'alert', 'escalation']
const forbidden = suite.forbiddenPatterns.map((item) => ({ re: new RegExp(item.pattern), why: item.why }))

const server = await createServer({
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true },
  appType: 'custom',
})

// 注意：这里**不能**提前 server.close()。provider 解析里有惰性 import（llm provider），
// 关掉 module runner 之后动态导入会抛「Vite module runner has been closed」，
// 表现为「缺 key」和「有 key 也全失败」两种完全不同的错误混在一起。
// 本脚本是一次性进程，末尾显式 process.exit()，不需要手动关闭。
const ai = await server.ssrLoadModule('/src/ai/agent.ts')
const providerModule = await server.ssrLoadModule('/src/ai/provider.ts')
const mockProviders = await server.ssrLoadModule('/src/ai/providers/mock.ts')
const llmFactory = await server.ssrLoadModule('/src/ai/providers/llm.ts')
const transports = await server.ssrLoadModule('/src/ai/transport.ts')
const memoryModule = await server.ssrLoadModule('/src/lib/memory.ts')

// 预检：用例格式错误（kind 拼错、字段名不一致）会让流水线走错分支，
// 从而把「测试数据写错」伪装成「产品有缺陷」。这类问题必须显式报错。
const KNOWN_KINDS = new Set(['question', 'reflection', 'daily'])
for (const testCase of [...suite.cases, ...guardrailSuite.cases]) {
  const kind = testCase.input?.kind
  if (!KNOWN_KINDS.has(kind)) {
    console.error(
      `用例 ${testCase.id} 的 input.kind「${String(kind)}」不在 ${[...KNOWN_KINDS].join(' / ')} 之内，请修正用例数据。`,
    )
    process.exit(2)
  }
  if (kind === 'question' && typeof (testCase.input.text ?? testCase.input.question) !== 'string') {
    console.error(`用例 ${testCase.id} 是提问类，但缺少 text 字段。`)
    process.exit(2)
  }
}

// provider 预检：llm 需要 LLM_API_KEY，缺 key 时给一句清晰提示，
// 而不是让 28 条用例整整齐齐地失败一遍
if (providerArg !== 'rules') {
  try {
    const provider = await providerModule.resolveProvider({ id: providerArg })
    if (!jsonOnly) {
      console.log(
        `${DIM}provider 就绪：${provider.id}（${provider.kind}${provider.model === undefined ? '' : ` · ${provider.model}`}）${RESET}`,
      )
    }
  } catch (error) {
    console.error(`provider「${providerArg}」不可用：${error instanceof Error ? error.message : String(error)}`)
    process.exit(2)
  }
}

const SUBJECTIVE = { energy: 3, stress: 4, mood: 3 }
const MEMORIES = memoryModule.SEED_MEMORIES

/**
 * 用例 → 流水线输入。
 * 注意两处历史约定：追问类用例的 kind 是 reflection（不是 daily），问题字段叫 text（不是 question）。
 * 这里统一归一化，别再让约定差异伪装成产品缺陷。
 */
const toInput = (input) =>
  input.kind === 'question'
    ? {
        subjective: SUBJECTIVE,
        memories: MEMORIES,
        question: input.text ?? input.question ?? '',
      }
    : { subjective: SUBJECTIVE, memories: MEMORIES, answers: input.answers ?? [] }

/** 行为套件：逐条判定断言。 */
function checkBehavior(testCase, run) {
  const assertions = []
  const check = (ok, label, detail) => assertions.push({ ok, label, detail })
  const { decision, trace } = run
  const expect = testCase.expect ?? {}

  if (testCase.input.kind === 'question') {
    if (expect.level !== undefined) {
      check(decision.level === expect.level, `输出分级 = ${expect.level}`, `实际 ${decision.level}`)
    }
    const text = decision.answer ?? ''
    for (const phrase of expect.mustInclude ?? []) {
      check(text.includes(phrase), `必须包含「${phrase}」`, text.slice(0, 60))
    }
    for (const group of expect.mustIncludeAny ?? []) {
      check(
        group.some((phrase) => text.includes(phrase)),
        `至少包含其一：${group.join(' / ')}`,
        text.slice(0, 60),
      )
    }
    for (const phrase of expect.mustExclude ?? []) {
      check(!text.includes(phrase), `不得包含「${phrase}」`, text.slice(0, 60))
    }
    check(decision.evidence.length >= 1, '至少 1 条依据', `实际 ${decision.evidence.length} 条`)
    check(LEVELS.includes(decision.level), '分级取值合法', decision.level)
    for (const { re, why } of forbidden) {
      check(!re.test(text), `不触碰禁区（${why}）`, text.match(re)?.[0] ?? '')
    }
  } else {
    const actionTexts = (decision.actions ?? []).map((action) => action.text)
    if (expect.actionCount !== undefined) {
      check(
        actionTexts.length === expect.actionCount,
        `行动数 = ${expect.actionCount}`,
        `实际 ${actionTexts.length}：${actionTexts.join(' / ')}`,
      )
    }
    if (expect.answered !== undefined) {
      const answered = (testCase.input.answers ?? []).length > 0
      check(answered === expect.answered, `answered = ${expect.answered}`, String(answered))
    }
    for (const phrase of expect.actionsInclude ?? []) {
      check(actionTexts.some((text) => text.includes(phrase)), `行动包含「${phrase}」`, actionTexts.join(' / '))
    }
    for (const phrase of expect.actionsExclude ?? []) {
      check(!actionTexts.some((text) => text.includes(phrase)), `行动不含「${phrase}」`, actionTexts.join(' / '))
    }
    if (expect.changesInclude !== undefined) {
      const changes = decision.changes ?? []
      if (expect.changesInclude.length === 0) {
        check(changes.length === 0, '不产生行动变更', changes.join(' / ') || '无')
      } else {
        for (const phrase of expect.changesInclude) {
          check(changes.some((change) => change.includes(phrase)), `变更包含「${phrase}」`, changes.join(' / '))
        }
      }
    }
    const corpus = `${decision.answer ?? ''} ${actionTexts.join(' ')}`
    for (const { re, why } of forbidden) {
      check(!re.test(corpus), `不触碰禁区（${why}）`, corpus.match(re)?.[0] ?? '')
    }
  }

  // 架构层断言：Trace 必须完整，否则「可观测」只是口号
  if (expect.minStages !== undefined) {
    check(trace.stages.length >= expect.minStages, `流水线阶段 ≥ ${expect.minStages}`, `实际 ${trace.stages.length}`)
  }
  if (expect.providerId !== undefined) {
    check(trace.providerId === expect.providerId, `provider = ${expect.providerId}`, trace.providerId)
  }
  if (expect.minRecalled !== undefined) {
    check(
      trace.recalled.length >= expect.minRecalled,
      `召回记忆 ≥ ${expect.minRecalled} 条`,
      `实际 ${trace.recalled.length}`,
    )
  }
  if (expect.noViolations === true) {
    check(
      trace.guardrails.violations.length === 0,
      '正常路径不应触发守门',
      trace.guardrails.violations.map((violation) => violation.code).join('、'),
    )
  }

  const preview =
    testCase.input.kind === 'question'
      ? `[${decision.level}] ${(decision.answer ?? '').slice(0, 46)}…`
      : `${(decision.actions ?? []).length} 条行动：${(decision.actions ?? []).map((a) => a.text).join(' / ')}`

  return { assertions, preview }
}

/** 守门套件：注入假 provider，验证拦截与降级。 */
function buildProvider(testCase) {
  if (testCase.provider === 'failing') return mockProviders.createFailingProvider()
  if (testCase.provider === 'malformed') {
    return mockProviders.createMalformedProvider(testCase.raw ?? '不是 JSON')
  }
  if (testCase.provider === 'scripted-valid') {
    return llmFactory.createLlmProvider({
      model: 'scripted-model',
      label: 'llm-scripted',
      transport: transports.createScriptedTransport([testCase.raw]),
    })
  }
  return mockProviders.createMockProvider([testCase.mock])
}

function checkGuardrail(testCase, run) {
  const assertions = []
  const check = (ok, label, detail) => assertions.push({ ok, label, detail })
  const { decision, trace } = run
  const expect = testCase.expect ?? {}
  const codes = trace.guardrails.violations.map((violation) => violation.code)
  const text = `${decision.answer ?? ''} ${(decision.actions ?? []).map((action) => action.text).join(' ')}`

  for (const code of expect.violationsInclude ?? []) {
    check(codes.includes(code), `守门层报出 ${code}`, codes.join('、') || '无')
  }
  if (expect.repaired !== undefined) {
    check(
      trace.guardrails.repaired === expect.repaired,
      `repaired = ${expect.repaired}`,
      String(trace.guardrails.repaired),
    )
  }
  if (expect.level !== undefined) {
    check(decision.level === expect.level, `最终分级 = ${expect.level}`, decision.level)
  }
  for (const phrase of expect.mustExclude ?? []) {
    check(!text.includes(phrase), `最终输出不含「${phrase}」`, text.slice(0, 60))
  }
  for (const phrase of expect.mustInclude ?? []) {
    check(text.includes(phrase), `最终输出包含「${phrase}」`, text.slice(0, 60))
  }
  if (expect.minEvidence !== undefined) {
    check(
      decision.evidence.length >= expect.minEvidence,
      `依据 ≥ ${expect.minEvidence} 条`,
      `${decision.evidence.length} 条`,
    )
  }
  if (expect.maxActions !== undefined) {
    const count = (decision.actions ?? []).length
    check(count <= expect.maxActions, `行动 ≤ ${expect.maxActions} 条`, `${count} 条`)
  }
  if (expect.maxAnswerLength !== undefined) {
    const length = (decision.answer ?? '').length
    check(length <= expect.maxAnswerLength, `回答 ≤ ${expect.maxAnswerLength} 字`, `${length} 字`)
  }
  if (expect.citations !== undefined) {
    check(
      JSON.stringify(decision.citations ?? []) === JSON.stringify(expect.citations),
      `引用 = ${JSON.stringify(expect.citations)}`,
      JSON.stringify(decision.citations ?? []),
    )
  }
  if (expect.fallbackFrom !== undefined) {
    check(trace.fallbackFrom === expect.fallbackFrom, `降级来源 = ${expect.fallbackFrom}`, String(trace.fallbackFrom))
    check(
      trace.stages.some((stage) => stage.id === 'fallback'),
      'Trace 记录了降级阶段',
      trace.stages.map((stage) => stage.id).join('、'),
    )
  }

  return { assertions, preview: `[${decision.level}] ${(decision.answer ?? '').slice(0, 46)}…` }
}

// ── 行为套件 ────────────────────────────────────────────────
const allBehavior = []
for (const testCase of suite.cases) {
  try {
    const run = await ai.runAgent(toInput(testCase.input), { providerId: providerArg })
    const { assertions, preview } = checkBehavior(testCase, run)
    allBehavior.push({ testCase, assertions, preview, allOk: assertions.every((item) => item.ok) })
  } catch (error) {
    allBehavior.push({
      testCase,
      assertions: [{ ok: false, label: '流水线执行失败', detail: String(error) }],
      preview: String(error).slice(0, 60),
      allOk: false,
    })
  }
}

const behavior = allBehavior.filter((result) => result.testCase.expectedFail !== true)
const knownGaps = allBehavior.filter((result) => result.testCase.expectedFail === true)

// ── 守门套件 ────────────────────────────────────────────────
const guardrails = []
for (const testCase of guardrailSuite.cases) {
  try {
    const run = await ai.runAgent(toInput(testCase.input), { provider: buildProvider(testCase) })
    const { assertions, preview } = checkGuardrail(testCase, run)
    guardrails.push({ testCase, assertions, preview, allOk: assertions.every((item) => item.ok) })
  } catch (error) {
    guardrails.push({
      testCase,
      assertions: [{ ok: false, label: '守门套件执行失败', detail: String(error) }],
      preview: String(error).slice(0, 60),
      allOk: false,
    })
  }
}

// ── 汇总 ───────────────────────────────────────────────────
const tally = (results) => {
  let total = 0
  let passed = 0
  const byClass = new Map()
  for (const result of results) {
    const cls = result.testCase.class ?? 'G'
    const entry = byClass.get(cls) ?? { cases: 0, passedCases: 0, assertions: 0, passedAssertions: 0 }
    entry.cases += 1
    if (result.allOk) entry.passedCases += 1
    for (const assertion of result.assertions) {
      entry.assertions += 1
      total += 1
      if (assertion.ok) {
        entry.passedAssertions += 1
        passed += 1
      }
    }
    byClass.set(cls, entry)
  }
  return { total, passed, byClass }
}

const behaviorTally = tally(behavior)
const guardrailTally = tally(guardrails)
const behaviorFailures = behavior.filter((result) => !result.allOk)
const guardrailFailures = guardrails.filter((result) => !result.allOk)
const rate = (value) => (value.total === 0 ? 0 : (value.passed / value.total) * 100)

if (jsonOnly) {
  console.log(
    JSON.stringify(
      {
        provider: providerArg,
        behavior: {
          cases: behavior.length,
          assertions: behaviorTally.total,
          passed: behaviorTally.passed,
          failures: behaviorFailures.map((result) => result.testCase.id),
        },
        guardrails: {
          cases: guardrails.length,
          assertions: guardrailTally.total,
          passed: guardrailTally.passed,
          failures: guardrailFailures.map((result) => result.testCase.id),
        },
        knownGaps: knownGaps.map((result) => ({
          id: result.testCase.id,
          stillFailing: !result.allOk,
          gap: result.testCase.gap,
        })),
      },
      null,
      2,
    ),
  )
  process.exit(behaviorFailures.length === 0 && guardrailFailures.length === 0 ? 0 : 1)
}

console.log(`${BOLD}主动健康助手 · AI 流水线评测${RESET} ${DIM}(provider: ${providerArg})${RESET}`)
if (verbose) {
  console.log(`${BOLD}逐条明细${RESET} ${DIM}（用例 → 断言数）${RESET}`)
  for (const result of [...behavior, ...knownGaps, ...guardrails]) {
    const flag = result.allOk ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`
    console.log(
      `  ${flag} ${result.testCase.id.padEnd(5)} ${String(result.assertions.length).padStart(3)} 条断言  ${DIM}${result.testCase.title}${RESET}`,
    )
  }
  console.log('')
}

console.log('')
console.log(`${BOLD}① 行为套件${RESET} ${DIM}判断与回答是否符合产品边界${RESET}`)
console.log(
  `   用例 ${behavior.length} · 断言 ${behaviorTally.total} · 通过 ${behaviorTally.passed} (${rate(behaviorTally).toFixed(1)}%) · 失败 ${behaviorFailures.length}`,
)
for (const cls of Object.keys(suite.classes).sort()) {
  const entry = behaviorTally.byClass.get(cls)
  if (entry === undefined) continue
  const flag = entry.passedAssertions === entry.assertions ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`
  console.log(
    `     ${flag} ${cls}  ${entry.passedCases}/${entry.cases} 用例  ${entry.passedAssertions}/${entry.assertions} 断言   ${DIM}${suite.classes[cls]}${RESET}`,
  )
}

console.log('')
console.log(`${BOLD}② 守门套件${RESET} ${DIM}假模型喂越界/畸形输出，验证守门与降级（无需 API key）${RESET}`)
console.log(
  `   用例 ${guardrails.length} · 断言 ${guardrailTally.total} · 通过 ${guardrailTally.passed} (${rate(guardrailTally).toFixed(1)}%) · 失败 ${guardrailFailures.length}`,
)

const printFailures = (results) => {
  for (const { testCase, assertions, preview } of results) {
    console.log(`  ${RED}✗ ${testCase.id}${RESET} ${testCase.title}`)
    console.log(`    ${DIM}${preview}${RESET}`)
    for (const assertion of assertions.filter((item) => !item.ok)) {
      console.log(`    · 未通过：${assertion.label}${assertion.detail ? `（${assertion.detail}）` : ''}`)
    }
  }
}

if (behaviorFailures.length > 0 || guardrailFailures.length > 0) {
  console.log('')
  console.log(`${BOLD}${RED}失败明细${RESET}`)
  printFailures([...behaviorFailures, ...guardrailFailures])
}

if (knownGaps.length > 0) {
  console.log('')
  console.log(`${BOLD}已知缺口（xfail，不计入通过率）${RESET}`)
  for (const { testCase, preview, allOk } of knownGaps) {
    const mark = allOk ? `${GREEN}已修复?${RESET}` : `${DIM}仍失败${RESET}`
    console.log(`  ${mark} ${testCase.id} ${testCase.title}`)
    console.log(`    ${DIM}${preview}${RESET}`)
    console.log(`    ${DIM}原因：${testCase.gap}${RESET}`)
    if (allOk) console.log(`    ${GREEN}→ 该缺口已修复，请把这条用例的 expectedFail 去掉${RESET}`)
  }
}

console.log('')
const ok = behaviorFailures.length === 0 && guardrailFailures.length === 0
console.log(
  ok
    ? `${GREEN}全部断言通过${RESET}${knownGaps.length > 0 ? `（另有 ${knownGaps.length} 条已知缺口，见上）` : ''}`
    : `${RED}存在未通过断言${RESET}——请修复，或按 xfail 登记并写明原因`,
)

process.exit(ok ? 0 : 1)
