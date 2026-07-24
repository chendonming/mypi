---
name: grilling
description: 通过并行 subagent 收集环境事实，然后逐一向用户提问，对计划、决策或想法进行压力测试。当用户说"grill me"、"压力测试一下"、"挑战我的想法"或类似表述时使用。
---

# 压力测试（Grilling）

当用户希望对其计划、决策或想法进行压力测试时：

1. **明确范围** — 确定被测试的主题（计划、决策、架构选择、功能设计等）
2. **启动并行异步 subagent** 从环境中收集事实（代码库、文档、配置等）
3. **等待所有 subagent 完成** 使用 `subagent_wait({ all: true })`
4. **逐一向用户提问**，基于收集到的上下文
5. **不要行动** 直到用户确认达成共识

## 步骤 1：确定主题

提取用户希望进行压力测试的内容。仅在主题确实模糊时才要求澄清；否则直接继续。

## 步骤 2：启动并行 subagent

使用 `subagent()` 搭配 `async: true` 启动并行的事实收集 subagent。至少启动一个 `scout` 来探索与主题相关的代码库/配置。当主题涉及**外部因素** — 第三方依赖、安全公告、行业最佳实践或工具对比 — 时，还需添加一个 `researcher` subagent 通过 web 搜索收集外部上下文。

```typescript
// 从对话上下文中检测用户语言
const userLang = "Chinese" // ← 从用户消息中推断，如用户用中文写作则为 "Chinese"

// 启动上下文收集器
const grillRun = subagent({
  tasks: [
    {
      agent: "scout",
      task: `探索代码库中与以下主题相关的所有内容：${subject}。
      
      查看：
      - 相关源文件、导入和依赖
      - 配置文件
      - 测试和测试模式
      - 文档和注释
      - 任何现有问题或 TODO
      
      返回结构化的发现摘要：存在什么、使用了什么模式、存在什么约束、缺少什么或不明确。
      
      用 ${userLang} 编写你的报告。`,
      output: "grill-context/scout-findings.md",
      outputMode: "file-only",
      progress: true
    }
  ],
  concurrency: 2,
  async: true,
  context: "fresh"
})
```

### 为外部上下文添加 researcher

当主题涉及外部因素 — 第三方库、行业最佳实践、安全公告或工具对比 — 时，在 scout 之外添加一个 `researcher` subagent：

```typescript
{
  agent: "researcher",
  task: `研究与以下主题相关的外部信息：${subject}。
  
  使用 web 搜索查找：
  - 相关库/工具的最新版本和发布说明
  - 已知安全漏洞（CVE）和公告
  - 社区最佳实践和迁移指南
  - 替代方案及其权衡
  - 真实世界的采用和迁移经验
  
  返回结构化的外部发现摘要：存在什么选项、它们的优缺点、任何关键风险或时间线注意事项，以及什么不清楚或需要进一步调查。
  
  用 ${userLang} 编写你的报告。`,
  output: "grill-context/research-findings.md",
  outputMode: "file-only",
  progress: true
}
```

根据主题调整 subagent：

| 场景 | 必需 | 推荐 | 理由 |
|----------|----------|-------------|-----------|
| **纯内部重构**（重命名、拆分模块） | `scout` | — | 仅需本地代码库上下文 |
| **架构/设计决策**（引入新模式） | `scout` | `researcher` | 外部最佳实践和行业替代方案 |
| **依赖/工具选择**（切换库、升级） | `scout` | `researcher` | 最新版本、CVE、社区迁移经验 |
| **安全敏感**（认证、加密、权限） | `scout` | `researcher` + 可选 `reviewer` | CVE 和不断演进的安全最佳实践 |
| **技术栈升级/迁移**（Vue 2 → 3 等） | `scout` | `researcher` | 迁移文档、EOL 时间线、已知陷阱 |
| **简单代码级决策**（实现细节） | `scout` | — | Scout 通常足够 |

> **建议**：有疑问时默认包含 `researcher` — 并行开销极小（仅多一个任务条目），而外部上下文往往能揭示本地代码库中不可见的风险或机会。

## 步骤 3：等待所有 subagent 完成

**这是关键步骤。** 在所有并行 subagent 完成之前，不要开始提问。使用 `subagent_wait({ all: true })` 阻塞直到每个异步任务完成。

```typescript
// 在提出任何问题之前等待所有 subagent 完成
const results = subagent_wait({ all: true })
```

如果你用上面的 `grillRun` 启动了 subagent，`subagent_wait({ all: true })` 确保在开始采访之前收集了所有发现。

> **为什么用 `{ all: true }`？** 该技能不能让用户回答 subagent 本可以通过探索环境就能回答的问题。使用 `{ all: true }` 保证每个事实收集任务都在第一个问题提出前完成。仅使用 `subagent_wait()`（在*第一个*完成时返回）会冒着问用户某个仍在运行的 subagent 已经知道的问题的风险。

## 步骤 4：逐一向用户提问

读取收集到的发现（从 chain 目录读取输出文件），然后采访用户：

- 沿决策树的每个分支向下走
- 逐个解决决策之间的依赖关系
- **一次只问一个问题** — 一次问多个会让人困惑
- **对每个问题，基于收集到的事实提供你的推荐答案**
- 如果某个*事实*可以通过进一步探索环境找到，去查找而不是询问
- 只有*决策*是用户的事
- **使用与用户相同的语言** — 如果用户说中文，全程用中文进行采访。始终匹配用户的语言。

### 问题格式

每个问题按以下结构组织：

```
## 问题 N：[主题]

**背景：** [subagent 发现的与此问题相关的内容]

**我的建议：** [基于最佳实践和代码库上下文]

**问题：** [向用户提出的单一清晰问题]
```

> **语言提示：** subagent 可能返回英文报告，但在向用户展示时应将发现翻译为用户的语言。始终匹配用户的语言。

## 步骤 5：在达成共识前不要行动

在用户明确确认已达成共识之前，不要实现、更改或提交任何内容。目标是压力测试，而不是执行。

## 完整工作流示例

```typescript
// 1. 确定主题
const subject = "将认证模块从 JWT 迁移到基于 session 的认证"

// 2. 启动并行事实收集器
//    scout → 探索本地代码库
//    researcher → 收集外部安全最佳实践和迁移指南
const grillRun = subagent({
  tasks: [
    {
      agent: "scout",
      task: `探索代码库中与以下主题相关的所有内容：${subject}。
      查看当前认证实现、中间件、token 处理、存储、测试。
      返回结构化的发现摘要。
      用 ${userLang} 编写你的报告。`,
      output: "grill-context/scout-findings.md",
      outputMode: "file-only",
      progress: true
    },
    {
      agent: "researcher",
      task: `研究与以下主题相关的外部信息：${subject}。
      搜索：
      - JWT vs session 认证的安全对比
      - OWASP session 管理最佳实践
      - 当前技术栈的已知漏洞
      - 真实世界的迁移经验（JWT → session）
      返回结构化的发现摘要。
      用 ${userLang} 编写你的报告。`,
      output: "grill-context/research-findings.md",
      outputMode: "file-only",
      progress: true
    }
  ],
  concurrency: 2,
  async: true,
  context: "fresh"
})

// 3. 在提问前等待所有任务完成
subagent_wait({ all: true })

// 4. 读取发现
// （使用 read 工具读取 chain 目录中的输出文件）
//   → read "grill-context/scout-findings.md"
//   → read "grill-context/research-findings.md"

// 5. 逐一采访，每次一个问题并附上建议
```

## 注意事项

- Subagent 是只读的；它们不会修改任何文件
- 使用 `outputMode: "file-only"` 使结果保存到文件，避免膨胀对话
- `subagent_wait({ all: true })` 之后，在提问前读取 chain 产物目录中的输出文件以获取完整上下文
- Chain 目录路径在 subagent 启动结果中报告 — 查找产物目录
