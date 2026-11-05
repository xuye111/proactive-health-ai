// 痛风知识边以概念关系标识。每条回答和证据在同一处维护。
const NICE_GOUT = 'https://www.nice.org.uk/guidance/ng219/chapter/Recommendations'

const facts = {
  'flare-urate-crystals': {
    edge: { from: '痛风发作', label: '相关机制', to: '尿酸盐结晶' },
    answer: '痛风发作与尿酸盐结晶在关节内或周围沉积、引起炎症有关。具体这次为什么发作，需要结合你的情况由医生判断。',
    source: { label: 'NHS《Gout》 · Who gets gout', url: 'https://www.nhs.uk/conditions/gout/' },
  },
  'flare-follow-up': {
    edge: { from: '发作缓解', label: '考虑复诊', to: '复核血尿酸和长期管理' },
    answer: '发作缓解后的复诊，可以让医生结合血尿酸、近期发作和其他健康情况，与你讨论怎样减少今后发作。你的复诊与复查时间以医生安排为准。',
    source: { label: 'NICE NG219 · 1.3.6 发作缓解后的随访', url: `${NICE_GOUT}#follow-up-after-a-gout-flare` },
  },
  'diet-evidence': {
    edge: { from: '特定饮食', label: '证据不足', to: '预防发作或降低血尿酸' },
    answer: 'NICE 认为，目前证据不足以证明某一种特定饮食能预防痛风发作或降低血尿酸。一般建议是保持均衡饮食，个人饮食安排可与医生讨论。',
    source: { label: 'NICE NG219 · 1.4.1 饮食与生活方式', url: `${NICE_GOUT}#diet-and-lifestyle` },
  },
} as const

type GoutKnowledgeId = keyof typeof facts

const intents: [GoutKnowledgeId, RegExp][] = [
  ['flare-urate-crystals', /(?:为什么|为何|怎么会).*痛风.*(?:发作|复发)|痛风.*(?:为什么|为何|怎么会).*(?:发作|复发)|痛风.*(?:病因|成因|发作原理)|(?:什么是|什么叫)痛风/],
  ['flare-follow-up', /(?:发作|缓解|不疼).*(?:为什么|为何|还要).*(?:复诊|复查)|(?:为什么|为何).*(?:缓解|不疼).*(?:复诊|复查)|(?:缓解|不疼).*(?:复诊|复查).*(?:为什么|为何|有什么用)/],
  ['diet-evidence', /(?:特定饮食|饮食|食谱|食疗).*(?:预防|防止|降低|降尿酸).*(?:痛风|发作|尿酸)|痛风.*(?:饮食|食谱|食疗).*(?:预防|防止|降低|降尿酸)|(?:食疗|饮食).*降尿酸/],
]

export function goutKnowledgeById(id: string) {
  return Object.hasOwn(facts, id) ? facts[id as GoutKnowledgeId] : undefined
}

export function matchGoutKnowledge(question: string) {
  const matches = intents.filter(([, pattern]) => pattern.test(question))
  if (matches.length !== 1) return undefined
  const [id] = matches[0]
  return { id, ...facts[id] }
}
