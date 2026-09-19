import { useMemo, useState } from 'react'
import { AppBar } from '../../components/AppBar'
import { SectionTitle } from '../../components/SectionTitle'
import { StageNotice } from '../../components/StageNotice'
import { IconChevronRight, IconShield } from '../../components/icons'
import {
  KNOWLEDGE,
  firstMatchingSection,
  searchKnowledge,
  type KnowledgeEntry,
} from '../../lib/knowledge'

function EntryDetail({ entry, onBack }: { entry: KnowledgeEntry; onBack: () => void }) {
  return (
    <div className="space-y-5 px-4 pt-4">
      <button
        type="button"
        onClick={onBack}
        className="text-[12px] font-medium text-brand"
      >
        ← 返回知识条目列表
      </button>

      <section className="card p-4">
        <h2 className="text-[17px] font-semibold text-ink">{entry.title}</h2>
        <dl className="mt-3 space-y-1.5 border-t border-line-soft pt-3">
          <div className="flex gap-2 text-[11px]">
            <dt className="w-[62px] shrink-0 text-muted">来源</dt>
            <dd className="min-w-0 flex-1 text-ink-soft">{entry.source}</dd>
          </div>
          <div className="flex gap-2 text-[11px]">
            <dt className="w-[62px] shrink-0 text-muted">复核状态</dt>
            <dd className="min-w-0 flex-1">
              <span className="rounded-full bg-warn-soft px-2 py-0.5 text-warn">{entry.review}</span>
            </dd>
          </div>
          <div className="flex gap-2 text-[11px]">
            <dt className="w-[62px] shrink-0 text-muted">更新日期</dt>
            <dd className="min-w-0 flex-1 text-ink-soft">{entry.updated}</dd>
          </div>
        </dl>
      </section>

      {entry.sections.map((section) => {
        const needsCare = section.heading.includes('就医')
        return (
          <section key={section.heading} className="card p-4">
            <h3
              className={`flex items-center gap-1.5 text-[13px] font-semibold ${
                needsCare ? 'text-danger' : 'text-ink'
              }`}
            >
              {needsCare && <IconShield className="size-3.5" />}
              {section.heading}
            </h3>
            <div className="mt-2 space-y-2">
              {section.blocks.map((block, index) =>
                block.kind === 'bullet' ? (
                  <p key={index} className="flex gap-2 text-[13px] leading-relaxed text-ink-soft">
                    <span className="mt-[7px] size-1 shrink-0 rounded-full bg-muted" />
                    <span className="min-w-0 flex-1">{block.text}</span>
                  </p>
                ) : (
                  <p key={index} className="text-[13px] leading-relaxed text-ink-soft">
                    {block.text}
                  </p>
                ),
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default function Knowledge() {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const results = useMemo(() => searchKnowledge(query), [query])
  const selected = KNOWLEDGE.find((entry) => entry.id === selectedId)

  if (selected !== undefined) {
    return (
      <>
        <AppBar title={selected.title} subtitle="知识条目" backTo="/profile" />
        <EntryDetail entry={selected} onBack={() => setSelectedId(null)} />
      </>
    )
  }

  return (
    <>
      <AppBar title="知识管理" subtitle="Markdown 条目 · 关键词检索" backTo="/profile" />

      <div className="space-y-5 px-4 pt-4">
        <StageNotice>
          方案 §16 的第一版形态：知识就是 Markdown 文件，检索先用关键词，不引向量库。第五阶段再升级为
          Chunk + Embedding + RAG。每个条目都带来源与复核状态，且两者分离。
        </StageNotice>

        {/* 检索 */}
        <div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="检索知识条目，例如：咖啡因 / 就医 / 基线"
            aria-label="检索知识条目"
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] outline-none placeholder:text-muted focus:border-brand"
          />
          <p className="mt-2 px-1 text-[11px] text-muted">
            {query.trim() === ''
              ? `共 ${KNOWLEDGE.length} 个条目，点击查看全文`
              : `匹配 ${results.length} 个条目`}
          </p>
        </div>

        {/* 条目列表 */}
        <section>
          <SectionTitle title="知识条目" />
          <ul className="card divide-y divide-line-soft overflow-hidden">
            {results.map((entry) => {
              const hit = query.trim() === '' ? undefined : firstMatchingSection(entry, query)
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(entry.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-ink">{entry.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {entry.sections.length} 个段落 · {entry.review}
                        {hit !== undefined && ` · 命中「${hit}」`}
                      </p>
                    </div>
                    <IconChevronRight className="size-4 shrink-0 text-muted" />
                  </button>
                </li>
              )
            })}
          </ul>
          {results.length === 0 && (
            <p className="card px-4 py-6 text-center text-[12px] leading-relaxed text-muted">
              没有匹配的条目。
              <br />
              试试「睡眠」「咖啡因」「就医」这类关键词。
            </p>
          )}
        </section>

        <StageNotice>
          知识条目的作用是给判断提供依据：{`小满`}给出建议时会指向具体条目，而不是自由发挥。
        </StageNotice>
      </div>
    </>
  )
}
