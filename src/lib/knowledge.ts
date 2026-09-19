import exerciseMd from '../data/knowledge/exercise.md?raw'
import nutritionMd from '../data/knowledge/nutrition.md?raw'
import sleepMd from '../data/knowledge/sleep.md?raw'
import stressMd from '../data/knowledge/stress.md?raw'

/**
 * 知识层（方案 §16 第一版）：Markdown 文件 + 关键词检索，不引入向量库。
 * 每个条目都带来源与复核状态，两者分离——这也是「数据与安全」页里那句
 * 「知识条目标明来源与医学复核状态」的实现依据。
 */

export type KnowledgeBlock = { kind: 'text' | 'bullet'; text: string }

export interface KnowledgeSection {
  heading: string
  blocks: KnowledgeBlock[]
}

export interface KnowledgeEntry {
  id: string
  title: string
  source: string
  review: string
  updated: string
  sections: KnowledgeSection[]
  /** 检索用纯文本。 */
  haystack: string
}

function parse(id: string, raw: string): KnowledgeEntry {
  const lines = raw.split('\n')
  let title = id
  let source = ''
  let review = ''
  let updated = ''
  const sections: KnowledgeSection[] = []
  let current: KnowledgeSection | null = null

  for (const line of lines) {
    if (line.startsWith('# ')) {
      title = line.slice(2).trim()
      continue
    }
    if (line.startsWith('> ')) {
      const text = line.slice(2).trim()
      if (text.startsWith('来源：')) source = text.slice(3).trim()
      else if (text.startsWith('复核状态：')) review = text.slice(5).trim()
      else if (text.startsWith('更新日期：')) updated = text.slice(5).trim()
      continue
    }
    if (line.startsWith('## ')) {
      current = { heading: line.slice(3).trim(), blocks: [] }
      sections.push(current)
      continue
    }
    if (current === null) continue
    const trimmed = line.trim()
    if (trimmed === '') continue
    current.blocks.push(
      trimmed.startsWith('- ') ? { kind: 'bullet', text: trimmed.slice(2).trim() } : { kind: 'text', text: trimmed },
    )
  }

  return {
    id,
    title,
    source,
    review,
    updated,
    sections,
    haystack: `${title} ${sections.map((s) => `${s.heading} ${s.blocks.map((b) => b.text).join(' ')}`).join(' ')}`.toLowerCase(),
  }
}

export const KNOWLEDGE: KnowledgeEntry[] = [
  parse('sleep', sleepMd),
  parse('exercise', exerciseMd),
  parse('nutrition', nutritionMd),
  parse('stress', stressMd),
]

/** 关键词检索：空格分词，全部命中才算匹配；空查询返回全部。 */
export function searchKnowledge(query: string): KnowledgeEntry[] {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token !== '')
  if (tokens.length === 0) return KNOWLEDGE
  return KNOWLEDGE.filter((entry) => tokens.every((token) => entry.haystack.includes(token)))
}

/** 该条目里第一个命中的段落，用于搜索结果里给出来源位置。 */
export function firstMatchingSection(entry: KnowledgeEntry, query: string): string | undefined {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token !== '')
  if (tokens.length === 0) return undefined
  const section = entry.sections.find((s) =>
    tokens.some((token) => `${s.heading} ${s.blocks.map((b) => b.text).join(' ')}`.toLowerCase().includes(token)),
  )
  return section?.heading
}
