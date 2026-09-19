# AGENTS.md

主动健康助手「小满」：移动端 PWA，演示主动健康管理闭环（发现 → 追问 → 改写行动 → 写记忆）。
产品方案在 `docs/product-plan.md`；架构见 `docs/architecture.md`。

## 怎么跑

```bash
npm install
npm run dev        # http://127.0.0.1:4173/
npm run eval       # 必跑：行为套件 + 守门套件（不需要 API key）
npm run build      # 类型检查 + 构建
```

改完必须让 `npm run build` 与 `npm run eval` 都通过。评测失败时**不要**放宽断言，
先判断是实现退化还是用例数据写错（见「评测用例约定」）。

## 技术栈

React 19 + Vite 8 + TypeScript + Tailwind v4；零 UI 库、零图表库；HashRouter；状态是本机 localStorage。

## 目录与约定

```
src/ai/       判断层（只在这里）：safety 安全唯一来源 / signals / context / guardrails 守门
              providers/{rules,llm,mock} / agent 编排+Trace / version 版本锚点
src/pages/    页面：只消费视图模型与 Trace，不写判断规则
src/lib/      UI 适配层（agentRules.ts 只转发 hook 与文案）、数据派生、本机 store
src/data/     数据与 knowledge/*.md；eval/ 评测用例；docs/ 指标/评测/合规/架构/ADR
```

必须遵守的边界：

1. **判断逻辑不写进页面**。新增规则加到 `src/ai/`；页面只渲染 `useTodayPlan()` / `useAnswerView()`。
2. **安全规则只有一个来源**。急症关键词、禁区正则、兜底文案都放 `safety.ts`，两层共用；写两份必然漂移，代价是漏报。
3. **守门层的致命违规是整体替换**，不要改成「删掉违规那句」——被污染的结论无法局部修补。
4. **界面文案不出现「AI」**，一律用 `ASSISTANT_NAME`（小满）；技术说明里保留 AI/LLM 术语。
5. **页面数字由数据算出**，不在文案里写死（「连续 4 天」必须调 `consecutiveDaysBelow()`）。
6. 改判断行为（规则/守门/提示词/schema）→ 递增 `src/ai/version.ts` 并同步 `MODEL_CARD.md`。

## 评测用例约定（踩过坑）

`eval/cases.json` 的 `input.kind` 只有三种，且字段名与 kind 绑定：

| kind | 含义 | 必填字段 |
| --- | --- | --- |
| `question` | 用户主动提问 | `text` |
| `reflection` | 追问反馈 → 行动变化 | `answers` |
| `daily` | 日程默认态 | — |

runner 开跑前预检 kind 与字段，格式不对退出码 2。**历史上三次「大量用例突然失败」都是这里的
约定不一致，不是产品退化**——遇到大面积失败先查用例数据。

有意为之的缺口用 `expectedFail: true` + `gap` 登记为 xfail：不计入通过率、不让 CI 变红，
修好后 runner 会提示摘掉标记。**不要为了让评测变绿而删除用例。**

## 当前状态与下一步

第一阶段（移动端外壳 + AI 分层架构）已完成：4 个一级入口、记录/趋势双视图、助手两条路径、
长期记忆/知识管理/知识图谱、守门层 + 11 步流水线 + 判断过程面板。

下一步（详见 `CASE_STUDY.md`）：接真实模型（适配器就绪，默认关闭）→ 埋点与指标上报 →
医学复核流程 → 记忆向量召回 → 后端与审计日志。
已知缺口（`npm run eval` 会打印）：多轮指代、口语同义表达、指标术语（HRV）、非中文急症漏报。
