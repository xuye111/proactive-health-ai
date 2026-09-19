# 主动健康助手「小满」

> 面向个人长期健康管理场景的**主动**健康智能体。核心不是「用户问、AI 答」，而是：
> **健康档案 → 持续数据 → 变化识别 → 判断 → 主动追问 → 行动计划 → 执行 → 反馈 → 更新认知**

[![CI](https://github.com/xuye111/proactive-health-ai/actions/workflows/ci.yml/badge.svg)](./.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
![Eval](https://img.shields.io/badge/eval-275%2B38%20assertions-brightgreen)

**它是什么**：一个可运行的移动端 PWA，演示主动健康管理的完整闭环。
**它不是什么**：不是医疗服务，不做诊断、处方、治疗决策，也不做个体风险评分。

## 3 分钟看懂

| | 它做了什么 | 为什么这么做 |
| --- | --- | --- |
| **首页** | 第一屏是「今天发现 N 处变化，有 1 件事需要你确认」+ 现在就回答；健康分退到「今日状态」 | 分数打头是**被动**产品的形态，会把产品做成一屏数据看板 |
| **助手** | 两条路径共存：主动追问（发现→追问→**改写今日行动**→写记忆）+ 你发起（随时提问，每条回答带输出分级） | 只做主动，用户有疑问时无处可问；只做问答，就退化成通用聊天框 |
| **记录** | 一个入口两个时间尺度：「今天」（行动/数据/目标达成/闭环）与「趋势」（7/30 天图表/判断依据） | 计划与实际必须同屏，分开时用户看不到「计划 vs 实际」 |
| **边界** | 急症征兆优先于所有话题、用药提问一律转介、答不了就如实说 | 医疗产品的风险不是答错事实，而是在不该给建议时给了建议 |

<p align="center">
  <img src="./docs/images/01-home.png" width="230" alt="首页：主动追问横幅 + 小满今天的动作" />
  <img src="./docs/images/02-assistant.png" width="230" alt="助手页：主动与自主两条路径" />
  <img src="./docs/images/06-graph.png" width="230" alt="知识图谱：实体邻域视图" />
</p>

## 评测：先定义「答对了」，再接模型

```
$ npm run eval

① 行为套件   用例 28 · 断言 275 · 通过 275 (100.0%) · 失败 0
     A 11/11   B 5/5   C 6/6   D 3/3   F 3/3
② 守门套件   用例 11 · 断言 38 · 通过 38 (100.0%) · 失败 0     ← 不需要 API key
```

- **行为套件**（28 条用例 / 275 条断言）跑真实流水线，覆盖应给建议 / 应解释边界 / 应升级转介 / 信息不足不得编造 / 架构行为；
- **守门套件**（11 条用例 / 38 条断言）用**脚本化假模型**喂进故意越界的输出（诊断结论、用药剂量、对胸痛问题给运动建议、自造分级、无依据、6 条行动、假引用、超长回答），断言守门层拦得住、降级降得下去。**换成真实模型后这套照跑**——它测的是「不管模型说什么，系统都不会越界」；
- **评测第一次运行就抓到一个真实安全缺陷**：「我该吃什么降压药」被路由到饮食建议（药物关键词漏掉了中间插词，而饮食意图用了过宽的裸「吃」）。修法与取舍见 [ADR-0010](./docs/adr/0010-药物相关提问改为最宽匹配-评测驱动.md)；
- **4 条已知缺口如实登记为 xfail**（多轮指代 / 口语同义表达 / HRV 误路由 / 非中文急症漏报），不计入通过率也不让 CI 变红，修好一条 runner 会提示；
- 判分不用裸关键词：合规的**拒答**里本来就会出现「剂量」，用裸词会把正确行为判成违规 —— 详见 [`docs/eval.md`](./docs/eval.md)。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [CASE_STUDY.md](./CASE_STUDY.md) | **面向招聘方的项目说明**：Problem → Insight → Design → Architecture → Product → Result |
| [docs/architecture.md](./docs/architecture.md) | **AI 架构**：分层、Provider 接缝、守门层、降级路径、Trace、模型接入边界 |
| [docs/metrics.md](./docs/metrics.md) | 指标体系与埋点方案：北极星（7 日行动计划完成率）、漏斗、质量指标、医疗护栏指标 |
| [docs/eval.md](./docs/eval.md) | 评测方法与判分模型、当前结果、已知缺口、接入 LLM 后的用法 |
| [docs/compliance.md](./docs/compliance.md) | 法规边界、敏感个人信息、审计与可追溯、HITL 复核流程、风险登记表 |
| [docs/adr/](./docs/adr/README.md) | 13 条决策日志：每条都写清备选方案与被放弃的代价 |
| [MODEL_CARD.md](./MODEL_CARD.md) | 判断层的适用范围、评测结果、已知限制、失败模式与更新策略 |
| [docs/product-plan.md](./docs/product-plan.md) | 原始产品方案（产品定位、页面设计、五阶段路线）；与实现的差异见 ADR |

## 快速开始

```bash
npm install
npm run dev        # http://127.0.0.1:4173/

npm run eval       # AI 流水线评测：行为套件 + 守门套件（有失败时退出码 1）
npm run eval -- --provider=llm   # 换成真实模型跑行为套件（需 LLM_API_KEY）
npm run build      # 类型检查 + 生产构建
npm run preview    # 预览构建产物
```

## 当前进度

**第一阶段「移动端产品外壳」已完成**：不接 LLM、不接数据库、不接真实硬件，先把产品流程、交互与信息架构立起来。

| 已实现 | 说明 |
| --- | --- |
| 健康小助手「小满」 | 界面上一律用名字称呼，不出现「AI」；极简拟人头像 + 在线状态点 |
| 四个一级入口 | 首页 / 小满 / 记录 / 我的 |
| 首页按「主动」组织 | 第一屏是小满主动追问的横幅 + 小满今天的动作时间线；健康分退到「今日状态」作为判断依据 |
| 记录 = 今天 + 趋势 | 一个入口两个时间尺度：今天（行动 / 数据 / 目标达成 / 闭环）与趋势（7 天 / 30 天图表与判断依据） |
| 小满会话流 | 两条路径共用同一份上下文：小满主动（发现 → 追问 → 更新判断）+ 你发起（随时提问，回答带输出分级） |
| AI 分层架构 | `src/ai/`：信号识别 / 记忆召回 / Context Builder / Provider 接缝 / 守门层 / 编排 + Trace；页面只消费视图模型 |
| 三个 provider | rules（默认，离线可跑，也是降级兜底）/ llm（真实适配器，OpenAI 兼容 + 结构化校验）/ mock（喂越界输出验证守门） |
| 判断过程面板 | 每条 AI 消息下可展开：6 个阶段耗时、识别到的信号（含阈值）、召回的记忆（含相关性分数）、知识引用、守门判定 |
| 我的下四个二级页 | 长期记忆 / 知识管理 / 知识图谱 / 数据与安全，四个入口全部可用 |
| 长期记忆 | 按类型筛选；记忆会随使用增长（在助手页回答或提问后，这里立刻多一条） |
| 知识管理 | 4 个 Markdown 知识条目 + 关键词检索 + 全文详情，每条带来源与复核状态 |
| 知识图谱 | 12 个实体 / 12 条关系，点节点可沿关系继续走（局部邻域视图，非全图推理） |
| 30 天演示数据 | 睡眠 / 运动 / 饮食 / 主观状态，页面所有数字由数据算出，不写死文案 |
| 图表 | 睡眠与步数柱状图，含个人基线、低于基线的着色，7 天 / 30 天切换 |
| 跨页共享状态 | 今日行动勾选、对话反馈、自主提问、主观状态按日期存在本机，刷新与跨页都保留 |
| PWA | manifest、图标、Service Worker（仅生产构建注册） |

**未实现（后续阶段）**：真实模型接入（适配器已就绪，默认关闭）、Signal Detection 的阈值校准、向量召回、知识 RAG、设备同步、后端与审计日志。详见 [CASE_STUDY 的下一步](./CASE_STUDY.md)。

## 演示数据

`src/data/healthRecords.json` 由 `scripts/generate-mock-data.mjs` 生成，目的是让方案里的示例数字在数据里**真实成立**：

| 方案示例 | 数据中的体现 |
| --- | --- |
| 今日睡眠 6 小时 12 分 | `sleepHours: 6.2`，页面用 `formatSleep()` 渲染 |
| 睡眠评分 72 / 入睡 00:42 / 起床 07:16 | 由睡眠时长与固定入睡潜伏期推出 |
| 今日 3,241 步，较过去 7 日下降 28% | 过去 7 日均值恰为 4,500，降幅 28.0% |
| 近 7 日睡眠 7.3 / 6.9 / 7.1 / 6.8 / 6.3 / 6.1 / 6.2 | 与方案 §8 一致 |
| 个人 30 天基线 7.0 小时 | 30 天均值 7.03 |

所以「连续 N 天低于个人平均值」这类文案由 `consecutiveDaysBelow()` 实时算出，改数据即改文案，图表与结论不会打架。

## 项目结构

```
proactive-health-ai/
├── eval/
│   ├── cases.json               # 行为用例（28 条，含 xfail 已登记缺口）
│   └── guardrail-cases.json     # 守门用例（10 条越界/畸形输出）
├── docs/                        # 指标 / 评测 / 合规 / ADR / 截图
├── public/                      # PWA manifest、图标、Service Worker
├── scripts/
│   ├── run-eval.mjs             # 评测 runner（用 Vite ssrLoadModule 加载真实规则）
│   ├── generate-mock-data.mjs   # 30 天演示数据生成器
│   └── make_icons.py            # 图标生成器
└── src/
    ├── ai/                      # AI 层（见 docs/architecture.md）
    │   ├── agent.ts             #   编排：11 步 Workflow + Trace
    │   ├── guardrails.ts        #   守门层（致命违规整体替换）
    │   ├── safety.ts            #   安全规则单一来源（生成层与守门层共用）
    │   ├── signals.ts           #   信号识别（阈值显式）
    │   ├── memory-recall.ts     #   记忆召回（相关性 + 时间衰减）
    │   ├── context.ts           #   Context Builder
    │   ├── provider.ts          #   Provider 接缝
    │   ├── providers/           #   rules / llm / mock
    │   ├── transport.ts         #   传输层（fetch + 脚本化）
    │   ├── schema.ts            #   结构化输出校验
    │   └── hooks.ts             #   异步会话缓存
    ├── components/              # AppBar / BottomNav / AssistantAvatar / ScoreRing / BarChart / DotScale …
    ├── data/                    # profile / plan / insights / healthRecords / memories / graph
    │   └── knowledge/           # 4 个 Markdown 知识条目（方案 §16 第一版形态）
    ├── lib/
    │   ├── derive.ts            # 全部展示数值的计算
    │   ├── agentRules.ts        # 规则表 + 急症优先规则（判断层）
    │   ├── agentStore.ts        # 跨页共享状态（反馈 / 提问 / 主观状态）
    │   ├── knowledge.ts         # Markdown 解析 + 关键词检索
    │   ├── memory.ts / graph.ts # 记忆合并 / 图谱邻域推导
    │   └── assistant.ts         # 助手身份（名字集中在这里，改名只改一处）
    └── pages/                   # Home / Agent / Record（+ record/ 两个面板）/ Profile / Safety / profile/ 三个二级页
```

## 技术选型

- **React 19 + Vite + TypeScript + Tailwind CSS v4**；零 UI 组件库、零图表库——环形分数与柱状图是手写 CSS/SVG，基线着色与 30 天紧凑布局都是自己算的
- **HashRouter**：PWA 与静态托管不需要服务端 rewrite
- **状态**：模块级 store + `useSyncExternalStore` + localStorage，按日期分桶；上后端时只替换持久化层
- **评测**：runner 用 Vite 的 `ssrLoadModule` 直接加载生产代码里的规则，不存在「测试用的是另一份实现」

## 医疗边界

本项目是产品演示，**不提供医疗服务**：不诊断、不开处方、不做治疗决策、不替代急症判断、不生成个体风险评分。演示数据不含任何真实用户信息，全部处理在浏览器本机完成。

产品内部的四级输出分级、急症升级流程与风险登记见 [`docs/compliance.md`](./docs/compliance.md) 与应用内「我的 → 数据与安全」。

## License

[MIT](./LICENSE)（请把 LICENSE 里的 `[你的名字]` 替换成你自己的署名）
