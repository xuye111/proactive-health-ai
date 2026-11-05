/** 对话记录只提取明确说出的数值；不从模糊描述猜测量表分值。 */
export function parseConversationRecord(text: string): Record<string, number | string> {
  const result: Record<string, number | string> = {}
  const scales = [
    { key: 'energy', pattern: /(?:精力|精神)(?:大概|是|有)?\s*([1-5])\s*分?/ },
    { key: 'stress', pattern: /压力(?:大概|是|有)?\s*([1-5])\s*分?/ },
    { key: 'mood', pattern: /(?:心情|情绪)(?:大概|是|有)?\s*([1-5])\s*分?/ },
  ]
  for (const { key, pattern } of scales) {
    const match = pattern.exec(text)
    if (match) result[key] = Number(match[1])
  }
  const caffeine = /(?:咖啡|咖啡因)(?:喝了|是|有)?\s*(\d{1,2})\s*杯/.exec(text)
  if (caffeine && Number(caffeine[1]) <= 20) result.caffeineCups = Number(caffeine[1])
  const bedtime = /(?:入睡|睡着|睡了)(?:大约|约|在)?\s*([01]?\d|2[0-3]):([0-5]\d)|([01]?\d|2[0-3]):([0-5]\d)(?:左右)?\s*(?:入睡|睡着|睡了)/.exec(text)
  if (bedtime) result.bedTime = `${String(Number(bedtime[1] ?? bedtime[3])).padStart(2, '0')}:${bedtime[2] ?? bedtime[4]}`
  if (/(?:记录|补充).{0,12}(?:昨晚|昨天)/.test(text)) {
    if (/(?:刷手机|玩手机|看手机)/.test(text) && !/(?:没|没有|未).{0,2}(?:刷手机|玩手机|看手机)/.test(text)) result.sleepBarrier = '使用手机'
    else if (/(?:工作|加班|家务|事务)/.test(text)) result.sleepBarrier = '睡前事务'
    else if (/(?:不困|没困意)/.test(text)) result.sleepBarrier = '到了时间不困'
  }
  return result
}

export const conversationFieldLabels: Record<string, string> = {
  energy: '精力', stress: '压力', mood: '情绪', caffeineCups: '咖啡因', bedTime: '入睡时间', sleepBarrier: '睡前阻碍',
}
