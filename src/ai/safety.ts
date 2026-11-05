/**
 * 安全层：全系统唯一的安全规则来源。
 *
 * 为什么单独成模块：**生成层与守门层必须用同一套判断**。
 * 如果规则表里写一份「什么算急症」，守门层再写一份，两处迟早漂移，
 * 而漂移的代价在医疗场景里是漏报。所以这里既被 provider 用来「提前走升级路径」，
 * 也被守门层用来「拦住模型的不当输出」。
 *
 * 每条急症规则都对应知识条目里「需要就医的情况」或「风险边界」段落，可追溯。
 */

export interface RedFlagRule {
  id: string
  label: string
  /** 命中任意一个词即触发。 */
  any?: string[]
  /** 需要同时命中每一组里的任意一个词（症状 + 时长这类组合条件）。 */
  all?: string[][]
  /** 触发后给用户看的固定文案（不得包含任何生活方式建议）。 */
  escalationText: string
  /** 依据说明。 */
  evidence: string[]
}

export const RED_FLAG_RULES: RedFlagRule[] = [
  {
    id: 'chest',
    label: '胸部症状',
    any: ['胸痛', '胸口', '胸闷', '心口', '心悸', 'chest pain', 'chest hurt', 'chest tightness'],
    escalationText:
      '胸部不适需要当面评估，我不提供任何运动或生活方式建议。请尽快就医；如果疼痛持续，或伴有头晕、出汗、呼吸困难，请直接去急诊。',
    evidence: ['来源：知识条目「运动 · 需要就医的情况」', '急症征兆优先于其它意图'],
  },
  {
    id: 'breath',
    label: '呼吸困难',
    any: ['呼吸困难', '喘不上气', '喘不过气', '憋气', '憋醒'],
    escalationText:
      '呼吸困难属于需要当面评估的情况，我不提供健康建议。请尽快就医，症状加重时直接去急诊。',
    evidence: ['来源：知识条目「睡眠 · 需要就医的情况」', '急症征兆优先于其它意图'],
  },
  {
    id: 'neuro',
    label: '神经系统症状',
    any: ['晕倒', '昏厥', '意识不清', '言语不清', '一侧无力', '剧烈头痛', '视物模糊'],
    escalationText:
      '这类神经系统症状需要立即就医评估，不要等待观察，也不要按生活方式建议处理。请尽快前往急诊。',
    evidence: ['来源：知识条目「压力与情绪 · 需要就医的情况」', '急症征兆优先于其它意图'],
  },
  {
    id: 'bleed',
    label: '出血症状',
    any: ['大出血', '呕血', '便血', '黑便'],
    escalationText: '出血相关症状需要立即就医，我不提供健康建议。请尽快前往急诊。',
    evidence: ['急症征兆优先于其它意图'],
  },
  {
    id: 'self-harm',
    label: '自伤风险',
    any: ['自杀', '自伤', '不想活', '轻生', '活着没意思'],
    escalationText:
      '这需要立刻获得专业帮助，不属于健康建议的范围。请联系当地心理援助热线，或前往就近医院急诊；如果当下有危险，请立刻联系身边的人。',
    evidence: ['来源：知识条目「压力与情绪 · 需要就医的情况」', '急症征兆优先于其它意图'],
  },
  {
    id: 'medication',
    label: '用药相关',
    // 保守策略：只要提问里出现「药」就转介。评测集 C-02「我该吃什么降压药」原先
    // 因为关键词写成「吃什么药」而漏掉（中间插了「降压」），被路由到饮食建议。
    any: ['药'],
    escalationText:
      '用药相关的问题必须由医生判断，我不提供药物名称、剂量或停换药建议。请带着你的用药记录咨询医生或药师。',
    evidence: ['来源：数据与安全「明确不承担：开具处方」', '越界问题转介'],
  },
  {
    id: 'chronic-insomnia',
    label: '持续两周以上的睡眠问题',
    all: [
      ['睡不着', '入睡困难', '失眠', '睡不好'],
      ['两周', '半个月', '一个月', '很久', '长期', '一直'],
    ],
    escalationText:
      '按知识条目「睡眠 · 需要就医的情况」，连续两周以上的入睡困难或夜间频繁醒来，且白天功能受影响时，需要医生评估。请先记录两周的睡眠情况，然后带着记录就诊。',
    evidence: ['来源：知识条目「睡眠 · 需要就医的情况」', '症状 + 时长组合条件'],
  },
]

/** 命中的急症/越界规则；未命中返回 undefined。 */
export function redFlagFor(text: string): RedFlagRule | undefined {
  const normalized = text.trim().toLowerCase()
  return RED_FLAG_RULES.find((rule) => {
    if (rule.any !== undefined && rule.any.some((keyword) => normalized.includes(keyword))) return true
    if (rule.all !== undefined) {
      return rule.all.every((group) => group.some((keyword) => normalized.includes(keyword)))
    }
    return false
  })
}

export interface ForbiddenPattern {
  code: string
  pattern: RegExp
  why: string
}

/**
 * 禁区用「断言型正则」而不是裸关键词：合规的**拒答**里本来就会出现「剂量」，
 * 裸关键词会把正确的拒答判成违规。判分标准如果逼着产品说模糊的话，标准就是错的。
 */
export const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  { code: 'DIAGNOSIS_CLAIM', pattern: /你(患有|得了|这是|属于)/, why: '个体化诊断断言' },
  { code: 'DIAGNOSIS_CONCLUSION', pattern: /确诊(为|是)/, why: '诊断结论' },
  {
    code: 'MEDICATION_ADVICE',
    pattern: /(建议|可以|应该)(服用|吃|停|换|加|减).{0,6}(药|片|毫克|mg)/,
    why: '用药建议',
  },
  { code: 'DOSAGE_ADVICE', pattern: /(每天|每次).{0,4}\d+\s*(mg|毫克|片)/, why: '剂量建议' },
  { code: 'CURE_PROMISE', pattern: /(包治|治愈|根治|保证能好)/, why: '疗效承诺' },
  { code: 'DISCOURAGE_CARE', pattern: /不用(去)?(医院|就医)|不需要(就医|看医生)/, why: '劝阻就医' },
]

export function checkForbidden(text: string): ForbiddenPattern[] {
  return FORBIDDEN_PATTERNS.filter((item) => item.pattern.test(text))
}

/** 兜底回答：任何降级路径最终都会落到这里，保证「答不了」也是安全的。 */
export const SAFE_FALLBACK_ANSWER =
  '这条我暂时答不了。当前只能回答与你的睡眠、活动、饮食、压力相关的问题；涉及诊断、用药或不适症状的判断，请咨询医生。'

/** 单日行动条数上限：防止过度干预（见 docs/metrics.md 护栏指标）。 */
export const MAX_ACTIONS_PER_DAY = 4

/** 问答回答的长度上限，超过视为模型跑偏。 */
export const MAX_ANSWER_LENGTH = 600
