# AGENTS.md

小满当前默认用户端是已确诊成人的痛风随访原型。移动端 PWA，React 19 + Vite 8 + TypeScript + Tailwind v4，HashRouter；状态存本机 `localStorage`。项目历史上曾有睡眠与健康方案原型，其代码和领域测试暂保留作回归，不得误当当前页面。

## 运行和验证

```bash
npm install
npm run dev
npm run eval
npm run check:v2
npm run build
```

修改后 `build`、`eval`、`check:v2` 都须通过。`eval` 检查保留的通用健康 AI 流水线，不是痛风问答的临床验证；当前痛风流程由 `check-follow-ups` 和 `check-gout-app` 验证。

## 目录与边界

- `src/ai/goutFollowUp.ts`：痛风随访状态、日期校验、报告关联与摘要。
- `src/ai/goutChat.ts`：当前小满离线规则问答，先调用 `safety.ts`。
- `src/ai/safety.ts`：急症/用药规则唯一来源；不要在页面复制。
- `src/lib/followUpStore.ts`：旧事项和痛风事项共用本机存储；页面只以 `isGoutFollowUp` 读取痛风事项。安全事项单独优先显示。
- `src/lib/healthStore.ts`：旧健康记录与个人资料、提醒设置的兼容存储。旧睡眠字段不得展示为痛风资料。
- `src/pages/`：首页、小满、记录、我的；旧页面模块保留，但不在默认路由暴露。

页面不写医疗判断。用户端不出现“AI”，称小满。数字、日期、单位与来源均从本人记录读取；空值保持未知，不造病例。不得给疾病诊断、药物剂量/停换药或个人化检验结论。判断规则改变时递增 `src/ai/version.ts` 并同步 `MODEL_CARD.md`。

保留的通用流水线也遵守原工程约束：判断逻辑放在 `src/ai/`，页面只消费结果；`safety.ts` 是安全单一来源；守门层遇到致命违规须整体替换输出，不按句删改；页面数字须从数据算出。不可为了让测试变绿而放宽断言。

`eval/cases.json` 的 `input.kind` 仅 `question`、`reflection`、`daily`，字段分别为 `text`、`answers`、无。评测失败先查用例格式与实现，不放宽断言；预期缺口用 `expectedFail` 与 `gap` 登记。
