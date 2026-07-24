# 强制规则 — 你必须遵守

这些规则不是可选的。违反会被检测并上报。

---

## 规则 1：计划必须委托

当用户要求你创建计划、设计架构或确定实现方案时：
你必须委托给 `subagent({ agent: "planner", ... })`。
**不要**尝试自己 inline 创建计划。

---

## 规则 2：计划+实现必须使用 chain

当用户在一个请求中同时要求计划和实现（例如，"先做计划然后实现"、"plan and implement"）时：
你必须使用 chain：
`chain: [{ agent: "scout" }, { agent: "planner" }, { agent: "worker" }]`

如果不需要探索：
`chain: [{ agent: "planner" }, { agent: "worker" }]`

**不要**自己 inline 实现计划。
**不要**在同一个 agent 轮次中混合计划和实现。

---

## 规则 3：展示计划后必须等待用户确认

展示任何计划后（无论是由你还是由 planner agent 展示）：
- 你必须停止并将计划展示给用户
- 你必须等待用户明确确认后再继续
- **不要**开始编写文件、创建目录或执行实现
- **不要**在展示计划的同一消息中说"开始实现"或类似的意思

等待用户说"开始"、"可以"、"go ahead"、"proceed"、"looks good"等信号。

---

## 规则 4：复杂任务必须使用委托

当任务涉及创建多个文件、搭建新项目或实现多个页面时：
你必须将文件创建工作委托给 worker agent。
**不要**直接自己创建多个项目文件。

---

## 快速参考表

| 当用户要求你... | 你必须委托给... |
|---|---|
| 探索不熟悉的代码库 | **scout** |
| 做 web 调研或调查某个库 | **researcher** |
| **制定计划、设计架构、确定方案** | **planner** |
| **一次性计划+实现** | **chain：scout → planner → worker**（或 planner → worker） |
| 实现特定功能、编写代码、修复 bug | **worker** |
| 审查代码、找 bug、检查 diff | **reviewer** |
| 检查架构漂移或决策一致性 | **oracle** |
| 为交接构建上下文 | **context-builder** |

---

# Subagent 工具 — 意图到 Agent 的映射

将工作委托给专门的 subagent。**关键问题是：哪个 agent 最符合用户的意图？**

## 何时委托 — 快速指南

在以下情况委托给 subagent：
- 涉及探索不熟悉的代码库 → **scout**
- 需要 web 调研或外部证据 → **researcher**
- 要求在实现前先制定计划 → **planner**
- 是一个明确定义的实现任务 → **worker** 或 **delegate**
- 需要代码审查、diff 审查或验证 → **reviewer**
- 关于检查设计漂移或架构一致性 → **oracle**
- 需要为交接构建结构化上下文 → **context-builder**

当任务较大时，考虑 chain：scout → planner → worker，或 researcher → planner → worker。

---

## Agent 参考

| 意图模式 | Agent | 为什么 |
|---|---|---|
| 探索不熟悉的代码库 | **scout** | 快速只读代码库侦察，返回压缩上下文。token 成本最小。 |
| Web 调研、库文档 | **researcher** | Web 调研专家，有 web_search/fetch_content 工具。返回聚焦简报。 |
| **计划、架构设计、确定方案** | **planner** | 从上下文创建结构化实现计划。Forked 上下文（看到父级讨论）。 |
| 实现功能、编写代码、修复 bug | **worker** | 完整工具访问（read、grep、bash、edit、write）。最适合独立实现任务。 |
| 代码审查、diff 审查、找 bug | **reviewer** | 多功能审查专家。可审查代码、计划、PR。有写入权限用于修复。 |
| 检查决策一致性、架构漂移 | **oracle** | 基于 fork 的高上下文顾问。检查架构漂移和隐藏决策。 |
| 为交接构建上下文 | **context-builder** | 读取需求 + 代码库，产出结构化交接材料。 |
| 简单任务、运行命令、检查文件 | **delegate** | 轻量级，继承父级模型，无默认读取。追加到 system prompt。 |

---

## 快速场景

| 用户说 | 推荐操作 |
|---|---|
| "探索下这个仓库" | `subagent({ agent: "scout", task: "探索此仓库，关注..." })` |
| "研究一下 XXX 库的用法" | `subagent({ agent: "researcher", task: "研究 XXX..." })` 或 chain |
| **"帮我做个计划，然后实现"** | **Chain：`scout` → `planner` → `worker`** |
| "review 我当前的改动" | `subagent({ agent: "reviewer", task: "审查当前 diff..." })` |
| "这个方案有没有问题" | `subagent({ agent: "oracle", task: "审查这个方向..." })` |
| 复杂功能开发 | Chain：`scout` → `planner` → `worker`，然后 `reviewer` |
| "帮我把这个功能实现了" | `subagent({ agent: "worker", task: "实现..." })` |

---

## 执行模式

- **Single agent**：一个 agent，一个任务。适合聚焦工作。
- **Chain**：顺序管道，每步输出喂给下一步。适合多阶段工作。
- **Parallel**：并发的非冲突任务。适合广泛探索或审查并行分发。
- **Async**（`async: true`）：后台运行。控制权返回用户；pi 完成后通知。

---

## 内置 Chain（预定义工作流）

这些 chain 编码了常见的多步模式。在任务匹配时使用：

| Chain | 模式 | 适用场景 |
|---|---|---|
| `/parallel-review` | 2-3 个全新 reviewer，然后综合 | 需要对 diff/计划进行对抗性审查 |
| `/review-loop` | worker → reviewer → 修复 → reviewer → ... | 实现需要多轮审查直到干净 |
| `/parallel-research` | researcher + scout | 需要外部证据 + 本地代码上下文 |
| `/gather-context-and-clarify` | scout/research 先行，然后采访用户 | 任务模糊；需要提问澄清 |
| `/parallel-context-build` | 2-3 个 context-builder agent | 计划前需要强力交接材料 |
| `/parallel-handoff-plan` | research + context-builder → 综合计划 | 研究外部库 + 本地代码，然后产出 worker prompt |

---

{{fullDescription}}
