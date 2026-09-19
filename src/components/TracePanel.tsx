import type { AgentTrace } from '../ai/types'

/**
 * 「判断过程」面板。
 *
 * 为什么把它做进产品而不是只打日志：医疗健康场景里，「为什么给这条建议」本身就是产品能力。
 * 这里展示的是流水线的真实输出——用了哪个 provider、识别到什么信号、召回了哪些记忆、
 * 依据是什么、守门层有没有介入。
 */

const KIND_LABEL: Record<string, string> = {
  rules: '规则实现',
  llm: '模型',
  mock: '脚本化（测试）',
}

const SEVERITY_STYLE: Record<string, string> = {
  alert: 'bg-danger/10 text-danger',
  watch: 'bg-warn-soft text-warn',
  info: 'bg-canvas text-ink-soft',
}

export function TracePanel({ trace, defaultOpen = false }: { trace: AgentTrace | null; defaultOpen?: boolean }) {
  if (trace === null) return null

  const guardrailsOk = trace.guardrails.passed && !trace.guardrails.repaired

  return (
    <details open={defaultOpen} className="rounded-xl border border-line bg-canvas/60">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-[10px] text-muted">
        <span className="font-medium text-ink-soft">判断过程</span>
        <span className="rounded bg-surface px-1.5 py-0.5">
          {KIND_LABEL[trace.providerKind] ?? trace.providerKind}
          {trace.model === undefined ? '' : ` · ${trace.model}`}
        </span>
        <span>{trace.latencyMs} ms</span>
        <span>{trace.stages.length} 个阶段</span>
        <span
          className={`rounded px-1.5 py-0.5 ${
            guardrailsOk ? 'bg-brand-soft/70 text-brand-deep' : 'bg-warn-soft text-warn'
          }`}
        >
          {guardrailsOk ? '守门通过' : `守门介入 ${trace.guardrails.violations.length} 项`}
        </span>
        {trace.fallbackFrom !== undefined && (
          <span className="rounded bg-warn-soft px-1.5 py-0.5 text-warn">已降级（原 {trace.fallbackFrom}）</span>
        )}
      </summary>

      <div className="space-y-3 border-t border-line px-3 py-3">
        {/* 流水线阶段 */}
        <section>
          <p className="text-[10px] font-medium text-ink-soft">流水线</p>
          <ol className="mt-1.5 space-y-1">
            {trace.stages.map((stage) => (
              <li key={stage.id} className="flex items-baseline gap-2 text-[10px]">
                <span className="w-[112px] shrink-0 text-muted">{stage.label}</span>
                <span className="w-[46px] shrink-0 text-right tabular-nums text-ink-soft">{stage.ms} ms</span>
                <span className="min-w-0 flex-1 truncate text-muted">{stage.detail ?? ''}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* 结构化信号 */}
        <section>
          <p className="text-[10px] font-medium text-ink-soft">识别到的信号（{trace.signals.length}）</p>
          <ul className="mt-1.5 space-y-1.5">
            {trace.signals.map((signal) => (
              <li key={`${signal.type}-${signal.label}`} className="text-[10px]">
                <span className={`rounded px-1.5 py-0.5 ${SEVERITY_STYLE[signal.severity] ?? 'bg-canvas'}`}>
                  {signal.label}
                </span>
                <span className="ml-1.5 text-muted">{signal.evidence.join(' · ')}</span>
                <span className="ml-1.5 text-muted">｜阈值：{signal.rule}</span>
              </li>
            ))}
            {trace.signals.length === 0 && <li className="text-[10px] text-muted">无</li>}
          </ul>
        </section>

        {/* 召回的记忆 */}
        <section>
          <p className="text-[10px] font-medium text-ink-soft">召回的记忆（{trace.recalled.length}）</p>
          <ul className="mt-1.5 space-y-1">
            {trace.recalled.map((memory) => (
              <li key={memory.id} className="text-[10px] text-muted">
                <span className="tabular-nums text-ink-soft">{memory.score.toFixed(2)}</span> {memory.text}
                <span className="ml-1">（{memory.reason}）</span>
              </li>
            ))}
            {trace.recalled.length === 0 && <li className="text-[10px] text-muted">无</li>}
          </ul>
        </section>

        {/* 知识引用与用量 */}
        <section className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
          <span>
            知识引用：
            {trace.citations.length === 0 ? '无' : trace.citations.join('、')}
          </span>
          <span>
            token：{trace.tokens === null ? '不适用' : `${trace.tokens.prompt} + ${trace.tokens.completion}`}
          </span>
          <span>判断层：{trace.layerVersion}</span>
          <span>runId：{trace.runId.slice(0, 8)}</span>
        </section>

        {/* 守门层 */}
        <section>
          <p className="text-[10px] font-medium text-ink-soft">安全守门</p>
          {trace.guardrails.violations.length === 0 ? (
            <p className="mt-1 text-[10px] text-muted">未发现违规；结论未被修改。</p>
          ) : (
            <ul className="mt-1 space-y-1 text-[10px]">
              {trace.guardrails.violations.map((violation) => (
                <li key={violation.code} className="text-warn">
                  {violation.code}：{violation.detail}
                </li>
              ))}
            </ul>
          )}
          {trace.guardrails.notes.length > 0 && (
            <ul className="mt-1 space-y-1 text-[10px] text-muted">
              {trace.guardrails.notes.map((note) => (
                <li key={note}>修复动作：{note}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </details>
  )
}
