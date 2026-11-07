> 历史档案。本文是项目启动时的通用健康方案，包含早期睡眠场景和开发设想。现行产品为[小满痛风主动随访](../README.md)，当时的实现取舍见[早期设计档案](./adr/README.md)。

# 主动健康 AI Agent｜移动端产品开发方案

## 1. 项目定位

### 1.1 项目名称

**主动健康 AI Agent**

英文名可暂定为：

**Proactive Health AI**

### 1.2 产品定义

面向个人长期健康管理场景，基于用户健康档案、连续健康数据和医学健康知识，持续识别用户健康状态变化，并主动生成可执行的健康行动计划。

产品核心不定位为传统“医疗问答机器人”，而是：

> 通过持续获取用户健康数据，识别变化，形成判断，生成行动，并根据用户反馈不断更新长期健康认知的主动健康智能体。

### 1.3 核心价值

传统健康类 AI 产品通常是：

```text
用户提问
↓
AI 回答
```

本项目希望构建：

```text
健康档案
↓
持续健康数据
↓
状态变化识别
↓
AI 判断
↓
主动追问
↓
行动计划
↓
用户执行
↓
结果反馈
↓
更新健康档案与 Memory
↓
下一轮判断
```

核心概念：

**Health Agent Loop**

即：

> 数据 → 理解 → 判断 → 干预 → 反馈 → 再理解

---

# 2. 产品形态

产品采用移动端 PWA 形态。

技术本质仍然是 Web 应用，但最终体验按照移动端 App 进行设计。

目标体验：

```text
手机打开
↓
全屏移动端界面
↓
可添加到手机桌面
↓
独立图标
↓
接近 App 的使用体验
```

产品定位上不强调“网页”，而是以：

> 移动端主动健康 AI 产品

进行设计和展示。

---

# 3. 整体产品架构

系统划分为五个核心层级：

```text
┌─────────────────────────────┐
│        Mobile PWA           │
│      移动端主动健康应用       │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│        Health Agent         │
│                             │
│ Profile / Memory / Planner  │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│   Health Reasoning Engine   │
│                             │
│ 规则判断 + LLM + Workflow    │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│       Knowledge Layer       │
│                             │
│  健康知识库 / RAG / 指南      │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│         Data Layer          │
│                             │
│ 用户档案 / 睡眠 / 运动 / 饮食  │
└─────────────────────────────┘
```

---

# 4. 核心产品结构

第一版 MVP 不追求大而全。

建议只做：

- 首页
- AI 助手
- 健康记录
- 健康趋势
- 健康计划
- 健康档案

底部导航保持 5 个核心入口：

```text
首页
AI
记录
计划
我的
```

健康趋势可以作为首页或记录页的二级页面进入。

---

# 5. 页面设计

## 5.1 首页

首页是整个产品最重要的页面。

首页的核心目标不是展示功能，而是回答：

> AI 今天发现了什么，我今天应该做什么。

示例：

```text
早上好

今日健康状态
78 分
整体稳定

━━━━━━━━━━━━━━

今日值得关注

睡眠
6 小时 12 分钟
连续 3 天低于个人平均值

活动
3,240 步
较过去 7 日下降 28%

━━━━━━━━━━━━━━

AI 发现

最近三天睡眠时间持续下降，
同时白天活动量减少。

今晚建议优先恢复睡眠节律。

[查看分析]

━━━━━━━━━━━━━━

今日健康计划

□ 午饭后步行 20 分钟
□ 下午 4 点后避免咖啡因
□ 23:30 前准备入睡
```

首页的核心逻辑：

```text
数据
↓
变化
↓
AI 判断
↓
行动
```

---

# 6. AI 健康助手

AI 页面不能做成普通 ChatGPT 对话框。

AI 需要体现“它已经了解用户”。

例如：

```text
AI 当前了解

睡眠下降
活动减少
近期压力较高
```

AI 可以主动发起询问：

```text
我注意到你最近三天平均睡眠
从 7.1 小时下降到了 6.2 小时。

最近是否出现：

○ 入睡困难
○ 夜间醒来
○ 工作较晚
○ 情绪压力
○ 没有明显感觉
```

核心交互从：

```text
用户问
↓
AI 答
```

升级为：

```text
AI 发现
↓
AI 主动追问
↓
用户反馈
↓
更新判断
```

这部分是整个产品区别于普通健康问答机器人的关键。

---

# 7. 健康记录

第一版只保留四类核心数据：

```text
睡眠
运动
饮食
主观状态
```

## 7.1 睡眠数据

示例：

```text
睡眠时间
6h 12min

入睡时间
00:42

起床时间
07:16

睡眠评分
72
```

## 7.2 运动数据

```text
步数
3,241

活动时间
28 min
```

## 7.3 饮食记录

第一版不做复杂营养分析，只记录：

```text
早餐
午餐
晚餐
饮水量
咖啡因
```

## 7.4 主观状态

```text
今天感觉如何？

精力   ●●●○○
压力   ●●●●○
情绪   ●●●○○
```

主观状态非常重要，因为主动健康不能只依赖传感器数据。

---

# 8. 健康趋势

健康趋势页面主要体现长期数据理解能力。

例如：

```text
过去 7 天睡眠

7.3
6.9
7.1
6.8
6.3
6.1
6.2
```

AI 自动生成解释：

```text
过去三天睡眠持续低于你的个人基线。

当前未发现明显异常，
建议优先观察睡眠节律变化。
```

健康判断不能只看医学正常范围。

建议形成：

```text
医学参考范围
+
个人历史基线
+
短期变化趋势
+
生活事件
```

四层判断结构。

即：

**Population Baseline + Personal Baseline + Trend + Context**

---

# 9. 健康计划

健康计划不是普通 Todo List。

它应该来自 Agent 的判断结果。

例如：

```text
本周目标

睡眠
平均睡眠恢复到 7 小时以上

运动
完成 4 次 30 分钟活动

生活方式
减少晚间咖啡因

━━━━━━━━━━

今日行动

□ 午饭后步行 20 分钟
□ 下午 4 点后不喝咖啡
□ 23:30 准备入睡
```

整个闭环：

```text
AI 判断
↓
生成行动
↓
用户执行
↓
记录结果
↓
评估效果
↓
重新规划
```

---

# 10. 健康档案

健康档案是整个 Health Agent 的长期 Context。

第一版数据模型：

```text
User Profile

├── 基础信息
│   ├── 年龄
│   ├── 性别
│   ├── 身高
│   └── 体重
│
├── 健康背景
│   ├── 既往史
│   ├── 家族史
│   ├── 药物
│   └── 过敏史
│
├── 生活方式
│   ├── 睡眠
│   ├── 饮食
│   ├── 运动
│   └── 烟酒
│
└── 健康目标
    ├── 改善睡眠
    ├── 控制体重
    └── 提升运动
```

后续可增加：

```text
检验指标
设备数据
问卷
症状
诊疗记录
健康事件
```

---

# 11. Health Agent 设计

整个项目的核心不是前端，而是 Health Agent。

建议第一版设计一个：

## Health Daily Agent

每天或者每次用户进入 App 时运行一次。

Workflow：

```text
STEP 1
读取用户健康档案

↓

STEP 2
读取最近健康数据

↓

STEP 3
计算用户个人基线

↓

STEP 4
识别近期变化

↓

STEP 5
生成 Health Signal

↓

STEP 6
判断重要程度

↓

STEP 7
调用健康知识

↓

STEP 8
LLM 生成解释

↓

STEP 9
生成行动计划

↓

STEP 10
用户反馈

↓

STEP 11
更新 Memory
```

---

# 12. Health Signal 设计

AI 不应该直接读取全部原始数据后自由判断。

中间应该有一层结构化信号。

例如：

```text
sleep_decline
activity_decline
stress_increase
weight_increase
low_energy
irregular_sleep
```

例如规则：

```text
最近 3 天平均睡眠
<
个人 30 天平均睡眠 × 0.85
```

生成：

```text
sleep_decline
```

另一个示例：

```text
最近 7 天平均步数
<
过去 30 天平均步数 × 0.75
```

生成：

```text
activity_decline
```

整体架构：

```text
原始健康数据
↓
规则 / 统计计算
↓
Health Signal
↓
Agent
↓
健康解释与计划
```

---

# 13. AI Context 设计

Agent 不直接向模型发送完整数据库。

先构建结构化 Context。

例如：

```json
{
  "profile": {
    "age": 33,
    "goal": "improve_sleep"
  },
  "baseline": {
    "sleep": 7.1,
    "steps": 7200
  },
  "recent": {
    "sleep": 6.2,
    "steps": 3241
  },
  "signals": [
    "sleep_decline",
    "activity_decline"
  ]
}
```

再交给模型。

---

# 14. AI 输出结构

AI 输出尽量采用结构化 JSON。

例如：

```json
{
  "summary": "近期睡眠和活动水平同时下降",
  "priority": "sleep",
  "reason": "连续三日睡眠低于个人基线",
  "actions": [
    "下午4点后减少咖啡因",
    "23:30前准备入睡",
    "白天增加20分钟步行"
  ]
}
```

这样可以让前端直接消费 AI 结果。

整体流程：

```text
Health Context
↓
LLM
↓
Structured Output
↓
UI Component
```

避免：

```text
LLM
↓
一大段自然语言
↓
前端无法结构化使用
```

---

# 15. Memory 设计

Memory 用于体现长期健康管理。

例如：

第一天：

```text
AI 建议：
23:30 前入睡
```

用户：

```text
没有完成

原因：
加班
```

系统记录：

```text
最近睡眠不足与工作日晚间加班相关
```

下一次 Agent 执行时：

```text
Recent Data
+
User Profile
+
Memory
```

AI 可以输出：

```text
最近几次睡眠不足都发生在工作日晚间加班之后。

今天不再只建议“早点睡”，
而是优先建议提前安排晚间工作结束时间。
```

最终形成：

## Longitudinal Health Agent

即：

> 长期理解用户，而不是只理解一次对话。

---

# 16. Knowledge Layer

第一版知识库不要复杂化。

可以直接使用 Markdown 文件：

```text
knowledge/

sleep.md
exercise.md
nutrition.md
stress.md
```

每份文件包含：

```text
基础知识
建议原则
风险边界
需要就医的情况
生活方式建议
```

第一版：

```text
Markdown
↓
关键词 / 简单检索
↓
Agent
```

第二版再升级：

```text
文档
↓
Chunk
↓
Embedding
↓
Vector Database
↓
RAG
↓
Agent
```

---

# 17. 数据层设计

第一阶段使用 Mock Data。

例如：

```json
{
  "date": "2026-09-19",
  "sleep": 6.2,
  "steps": 3241,
  "stress": 7,
  "energy": 5
}
```

建议准备至少 30 天的数据。

这样可以模拟：

```text
个人基线
趋势变化
异常信号
Agent 判断
```

第一版不需要接真实 Apple Health、Health Connect 或智能硬件。

重点是验证：

> 健康数据进入系统之后，AI 如何理解和使用这些数据。

---

# 18. 技术架构

整体技术方案：

```text
客户端
React
+
Vite
+
Tailwind CSS
+
PWA

↓

业务层
Health Profile
Health Record
Health Trend
Health Plan

↓

Agent Layer
Signal Detection
Context Builder
Planner
Memory

↓

AI
LLM API

↓

Knowledge
Markdown
↓
后续升级 RAG

↓

Data
Mock JSON
↓
后续升级 Supabase

↓

Deploy
GitHub
+
Vercel
```

---

# 19. 项目代码结构

建议项目目录：

```text
proactive-health-ai/

├── src/
│
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Agent.tsx
│   │   ├── Record.tsx
│   │   ├── Trends.tsx
│   │   ├── Plan.tsx
│   │   └── Profile.tsx
│
│   ├── components/
│   │   ├── HealthScore.tsx
│   │   ├── HealthCard.tsx
│   │   ├── TrendChart.tsx
│   │   ├── ActionCard.tsx
│   │   └── BottomNav.tsx
│
│   ├── agent/
│   │   ├── healthAgent.ts
│   │   ├── signals.ts
│   │   ├── contextBuilder.ts
│   │   ├── planner.ts
│   │   ├── memory.ts
│   │   └── prompts.ts
│
│   ├── data/
│   │   ├── profile.json
│   │   ├── sleep.json
│   │   ├── activity.json
│   │   └── healthRecords.json
│
│   ├── knowledge/
│   │   ├── sleep.md
│   │   ├── exercise.md
│   │   ├── nutrition.md
│   │   └── stress.md
│
│   ├── services/
│   │   ├── ai.ts
│   │   └── healthData.ts
│
│   └── App.tsx
│
├── public/
│   ├── icon.png
│   └── manifest.json
│
└── package.json
```

---

# 20. 开发阶段

整个项目建议分为 5 个阶段。

---

## 第一阶段：完成移动端产品外壳

目标：

> 先让整个产品看起来像一个真正可以使用的移动端产品。

完成：

- 首页
- AI 助手
- 健康记录
- 健康趋势
- 健康计划
- 健康档案
- 底部导航
- 移动端适配
- Mock Data

这一阶段：

```text
不接 AI
不接数据库
不接真实硬件
```

重点：

```text
产品流程
+
UI
+
信息架构
```

---

# 21. 第二阶段：健康数据与规则引擎

目标：

> 让系统开始真正理解健康数据。

完成：

- 30 天 Mock Data
- Personal Baseline
- Trend Calculation
- Signal Detection
- Health Score

形成：

```text
Health Data
↓
Baseline
↓
Trend
↓
Signal
```

---

# 22. 第三阶段：接入 Health Agent

加入：

- Context Builder
- LLM API
- Structured Output
- AI 健康解释
- 主动追问
- 今日健康计划

形成：

```text
Profile
+
Recent Data
+
Health Signal
↓
Context Builder
↓
LLM
↓
Health Insight
↓
Health Plan
```

---

# 23. 第四阶段：加入 Memory

实现：

```text
用户行为
用户反馈
用户偏好
计划完成情况
重要健康事件
```

进入 Memory。

Agent Context：

```text
Profile
+
Health Data
+
Signals
+
Memory
```

形成长期健康理解。

---

# 24. 第五阶段：知识库与 RAG

最后再加入：

```text
健康指南
专业资料
疾病知识
营养知识
运动知识
```

形成：

```text
Health Signal
↓
检索相关知识
↓
Relevant Knowledge
↓
Agent
↓
Personalized Recommendation
```

第一版作品集做到这里已经非常完整。

---

# 25. MVP 范围控制

第一版明确不做：

```text
Apple Health 接入
HealthKit
智能手表
医院 HIS
EMR
复杂检验数据
医疗影像
复杂疾病诊断
复杂多 Agent
完整知识图谱
微服务
Docker
Kubernetes
```

这些都不属于第一阶段重点。

第一版重点是：

```text
个人健康数据
↓
AI 理解
↓
主动健康服务
```

---

# 26. 产品安全边界

健康 AI 产品必须考虑风险控制。

Agent 输出需要区分：

```text
Lifestyle Advice
健康生活建议

Health Information
健康知识解释

Risk Alert
健康风险提示

Medical Escalation
建议进一步医疗咨询
```

AI 不直接承担：

```text
疾病诊断
处方
治疗决策
急症判断替代
```

如果触发高风险信号：

```text
Agent
↓
停止普通健康建议
↓
进入 Escalation Flow
↓
建议用户寻求专业医疗帮助
```

这一设计可以作为项目中的医疗 AI Safety 能力展示。

---

# 27. 最终作品集交付物

整个项目最终应该形成四类成果。

## 27.1 可运行产品

```text
Mobile PWA
```

招聘方可以通过手机直接访问。

---

## 27.2 项目二维码

简历或作品集加入：

```text
主动健康 AI Agent

扫码体验 Demo
```

---

## 27.3 产品架构图

包括：

```text
Mobile
↓
Agent
↓
Reasoning
↓
Knowledge
↓
Data
```

---

## 27.4 Case Study

作品集说明：

```text
Problem

为什么传统健康 App 不够主动？

↓

Insight

健康服务需要持续理解用户状态

↓

Design

Health Agent Loop

↓

Architecture

Data + Signal + Agent + Knowledge + Memory

↓

Product

Mobile PWA

↓

Result

主动健康管理 Demo
```

---

# 28. 简历能力映射

该项目重点体现以下能力：

```text
医疗健康产品设计

用户健康档案建模

健康数据 Schema

长期用户状态建模

个人健康基线

健康趋势识别

规则引擎

LLM

Structured Output

RAG

Agent Workflow

Long-term Memory

主动健康干预

AI Safety

Human-in-the-loop

移动端产品设计

Vibe Coding
```

最终能力组合：

```text
医疗行业经验
+
医疗健康产品
+
健康数据
+
知识工程
+
AI Agent
+
Vibe Coding
```

---

# 29. 项目核心创新点

本项目最终重点表达三个核心概念。

## 29.1 Personal Health Baseline

不是只依赖人群医学正常范围。

而是：

```text
Population Baseline
+
Personal Baseline
```

让健康判断更加个体化。

---

## 29.2 Health Agent Loop

健康 AI 不只是回答问题。

而是：

```text
Observe
↓
Understand
↓
Decide
↓
Act
↓
Learn
```

即：

```text
观察
↓
理解
↓
判断
↓
行动
↓
学习
```

---

## 29.3 Longitudinal Health Agent

真正的主动健康 AI 应该理解：

```text
用户过去是什么状态
↓
最近发生什么变化
↓
之前尝试过什么
↓
什么方法对这个用户有效
↓
下一步应该做什么
```

因此系统的最终目标不是建立一个：

> Health Chatbot

而是建立一个：

> Longitudinal Health Agent

即：

**长期个人健康智能体。**

---

# 30. 最终开发路线

整个项目按照以下顺序推进：

```text
移动端 UI
↓
Mock Data
↓
Personal Baseline
↓
Trend Detection
↓
Health Signal
↓
Health Agent
↓
Structured Output
↓
Memory
↓
Knowledge / RAG
↓
PWA
↓
Vercel
↓
简历二维码
```

项目开发原则：

> 先完成产品闭环，再逐渐增加 AI 能力。

而不是先搭建复杂技术架构。

最终目标不是证明自己可以开发一个 App，而是证明：

> 能够从医疗健康场景、健康数据、AI Agent 和产品系统四个层面，设计并实现一套完整的主动健康服务闭环。
