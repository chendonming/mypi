# Plan: Skill Router — 专项审查 Skill 自动路由

## 目标

让 pi 主代理在委托 reviewer subagent 时，**自动根据任务涉及的技术栈，注入对应的语言/框架专项 skill**。无需用户手动指定，无需 AGENTS.md 声明。

## 设计思路

遵循现有 `delegation-rules` skill 的模式（强制规则 + 快速决策表），创建一个 `skill-router` skill，作为父代理的"路由指南"。同时创建第一批语言专项 skill（内容从 ECC 项目移植），形成一个可扩展的体系：

```
父代理接到用户审查请求
    │
    ├── delegation-rules skill 触发：必须用 reviewer
    │
    └── skill-router skill 触发：根据文件类型选 skill
            │
            ├── .vue   → subagent({ agent: "reviewer", skill: "vue-review" })
            ├── .py    → subagent({ agent: "reviewer", skill: "python-review" })
            ├── .go    → subagent({ agent: "reviewer", skill: "go-review" })
            ├── .ts/.tsx (React) → subagent({ agent: "reviewer", skill: "react-review" })
            └── 纯 TS 无框架 → subagent({ agent: "reviewer" })  // 无额外 skill
```

## 需要创建/修改的文件

### 新建文件

| 文件 | 说明 |
|------|------|
| `skills/skill-router/SKILL.md` | 核心路由规则 skill，强制父代理在委托 reviewer 时传递正确的语言 skill |
| `skills/vue-review/SKILL.md` | Vue.js 审查 skill — Composition API 正确性、响应式、composable 模式、模板安全、Pinia/Router、SSR |
| `skills/python-review/SKILL.md` | Python 审查 skill — PEP 8、Pythonic 惯用法、类型安全、异步正确性、安全 |
| `skills/go-review/SKILL.md` | Go 审查 skill — Go 惯用法、并发安全、错误处理、接口设计 |
| `skills/react-review/SKILL.md` | React 审查 skill — hooks 规则、RSC 边界、状态管理、a11y、性能 |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `skills/delegation-rules/SKILL.md` | 在快速决策表末尾追加一行：审查代码时附带加载 `skill-router` 选择正确的语言 skill |
| `AGENTS.md` | 无需修改（skill-router 通过 pi 的 skill 自动发现机制生效） |

## 交付物详解

### 1. `skills/skill-router/SKILL.md`（核心）

**功能**：当父代理决定将审查任务委托给 reviewer 时，此 skill 提供文件类型 → language skill 的精确映射表。

**设计要点**：
- 遵循现有 `delegation-rules` 的格式：frontmatter + 强制规则 + 快速决策表
- 使用 pi 标准的 `skill` 参数传递机制
- 覆盖最常见的 5 个技术栈（Vue / React / Python / Go / TypeScript）
- 明确 fallback 规则：未知文件类型时，只传 reviewer 自身，不加额外 skill
- 说明 parallel review 模式：框架 skill + 语言通用 skill 同时运行

**结构**：

```markdown
---
name: skill-router
description: "强制 skill 路由规则。当你要将审查任务委托给 reviewer subagent 时，必须根据涉及的文件类型或技术栈，传递对应的语言/框架专项 review skill。"
---

# Skill 路由规则

## 规则：审查委托必须附带语言 skill

当用户要求审查代码、检查 diff、review PR 时，你必须...

## 路由表

| 文件类型 | 必须传递的 skill | 补充 skill（并行） | 说明 |
|---------|-----------------|-------------------|------|
| .vue | vue-review | ts-review（若含 TS） | 三层分离：框架 + 语言 |
| .tsx/.jsx (React) | react-review | — | hooks/RSC/a11y |
| .py | python-review | — | PEP 8 + 安全 |
| .go | go-review | — | 并发 + 错误处理 |
| 纯 .ts/.js（无框架） | — | — | reviewer 自身足够 |

## Parallel 模式

当文件同时涉及框架和语言时...

## Fallback

未知技术栈时，仅使用 reviewer 自身...

## 快速决策表

| 如果用户要求... | 你必须... |
|---|---|
| 审查 Vue 组件 | 调用 reviewer + skill: "vue-review" |
| ...
```

### 2. 语言专项 skill（5 个）

每个 skill 从 ECC 项目的对应 agent 和 rules 中提取审查清单，按 pi skill 标准重写。

**统一结构**：
```markdown
---
name: xxx-review
description: 专项代码审查规范。当审查 xxx 代码时激活。
---

# XXX Code Review Checklist

## CRITICAL（阻断合并）

### 安全
- ...

### 正确性
- ...

## HIGH（应修复）

### 模式与惯用法
- ...

### 性能
- ...

## MEDIUM（建议）

- ...

## 常见误报（跳过）

- ...
```

**vue-review 重点关注**（移植自 ECC `agents/vue-reviewer.md` + `rules/vue/`）：
- CRITICAL: v-html XSS、响应式破坏（解构 props、reactive 替换）、Pinia store 泄露
- HIGH: composable 无 cleanup、v-for key 错误、props mutation、SSR 安全
- MEDIUM: SFC 行数、Options API 残留、defineExpose 暴露过度

**python-review 重点关注**（移植自 ECC `agents/python-reviewer.md`）：
- CRITICAL: eval/exec、硬编码密钥、SQL 注入、路径遍历
- HIGH: 可变默认参数、裸 except、资源未关闭、async 竞态
- MEDIUM: 类型注解缺失、f-string 中表达式过复杂

**go-review 重点关注**（移植自 ECC `agents/go-reviewer.md`）：
- CRITICAL: goroutine 泄露、未处理 error、竞态条件
- HIGH: defer 顺序、nil 指针、context 未传递
- MEDIUM: interface{} 滥用、裸 panic

**react-review 重点关注**（移植自 ECC `agents/react-reviewer.md`）：
- CRITICAL: hook 条件调用、RSC 泄露敏感数据、XSS via dangerouslySetInnerHTML
- HIGH: missing deps、状态直接突变、useEffect 竞态
- MEDIUM: 过度 memo、组件过大

### 3. `skills/delegation-rules/SKILL.md` 修改

在快速决策表的 `审查代码 / 检查 diff` 行，追加 `skill-router` 引用：

```
| 审查代码 / 检查 diff / 找 bug | 调用 **reviewer** agent，同时加载 `skill-router` 选择正确的语言 skill |
```

## 实施顺序

### Phase 1：核心路由（1 个文件）

1. 创建 `skills/skill-router/SKILL.md`
2. 修改 `skills/delegation-rules/SKILL.md` 追加一行
3. `/reload` 验证 skill 被发现

### Phase 2：第一批语言 skill（5 个文件，建议按需创建）

1. 创建 `skills/vue-review/SKILL.md`（优先级最高，已有 ECC 完整参照）
2. 创建 `skills/python-review/SKILL.md`
3. 创建 `skills/go-review/SKILL.md`
4. 创建 `skills/react-review/SKILL.md`
5. 按需创建 `skills/ts-review/SKILL.md`（如果内置 reviewer 的 TS 能力不够用）

### Phase 3：验证

1. 在 pi 中 `/reload` 加载所有 skill
2. 测试：`/skill:skill-router` 确认父代理加载
3. 端到端测试：提交一个 Vue diff → 观察父代理是否正确传递 `skill: "vue-review"`
4. 端到端测试：提交一个 Python diff → 观察是否正确传递 `skill: "python-review"`

## 不做什么（非目标）

- ❌ 不创建新的 subagent（不复制 ECC 的 20+ reviewer agent）
- ❌ 不写 extension 做自动注入（留给 Phase 4 的可选优化）
- ❌ 不修改 AGENTS.md 添加路由规则
- ❌ 不修改内置 reviewer agent 的 `inheritSkills` 配置
- ❌ 不创建所有 ECC 存在的语言 skill（按需增量添加）
- ❌ 不修改系统 prompt

## 设计决策

| 决策 | Why |
|------|-----|
| 路由规则用 skill 而非 extension | 与语言 skill 放在同一目录，一致的管理体验；无需写代码 |
| 语言 skill 的内容从 ECC 移植而非自创 | ECC 已有经过验证的审查清单，避免重复造轮子 |
| 先做 5 个语言 skill 而非全部 | 覆盖 90% 使用场景，后续按需增量 |
| skill-router 不遍历目录自动发现 | pi 的 skill 发现机制本身不暴露"有哪些 skill"的元信息给父代理；显式路由表更可靠 |
| 不把路由规则放进 delegation-rules | 职责分离：delegation-rules 管"何时委托"，skill-router 管"委托时带什么" |
