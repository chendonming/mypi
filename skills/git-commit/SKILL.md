---
name: git-commit
description: 按照约定式提交规范自动提交Git代码并以 rebase 方式推送，无需用户确认。自动从 git 历史推断提交信息的语言偏好，无需强制指定。
---

# git-commit 技能

## 概述

按照 [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) 规范自动提交 Git 代码。

AI 自行分析变更内容、结合当前会话上下文理解变更意图，生成规范的提交信息并自动提交。提交后以 rebase 方式变基到远程最新代码之上，再自动推送到远程仓库，确保提交历史线性美观。

此技能仅在用户主动输入 `/git-commit` 或明确提出"提交代码"等意图时触发，不会自动调用。

## 语言偏好检测

**核心变更**：不再强制使用中文书写提交信息。每次执行时，通过分析当前仓库的 git 历史记录来推断语言偏好：

### 检测流程

1. 执行 `git log --format="%s" -5` 获取最近 5 条提交信息（排除 Merge 提交）
2. 逐条检测是否包含 CJK 字符（中文、日文、韩文）
3. 统计中文提交占比：
   - **中文占比 ≥ 30%** → 使用中文书写 description 和 body（保留技术英文术语）
   - **中文占比 < 30%** → 使用英文书写 description 和 body
   - **历史为空或不足 5 条** → 默认使用英文

### 语言规则
- 如果检测结果为**中文**：description 和 body 使用中文书写，保留专业术语、技术名词、类名/变量名、框架名、协议名等为**英文**（如 `JWT`、`VO`、`DTO`、`Redis`、`MySQL`、`PetProductBehavioralSaveVo` 等）。避免中英混写日常词汇（如不要写"新增 delete 功能"，应写"新增删除功能"），纯技术名词才保留英文。
- 如果检测结果为**英文**：description 和 body 使用英文书写，遵循 Conventional Commits 英文规范。
- 技术术语的保留规则始终适用，无论使用哪种语言。

## 约定式提交规范摘要

### 提交格式

```
type(scope): description

[optional body]

[optional footer(s)]
```

### 类型（type）

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `build` | 构建系统或外部依赖变更 |
| `chore` | 杂项（构建过程或辅助工具的变动） |
| `ci` | CI 配置变更 |
| `docs` | 仅文档变更 |
| `style` | 不影响代码含义的格式变更 |
| `refactor` | 重构 |
| `perf` | 性能优化 |
| `test` | 添加或修正测试 |
| `revert` | 回退提交 |

### scope（可选）

影响范围的简短描述，如 `(auth)`、`(api)`、`(ui)`。

### description（必填）

简洁的变更描述，祈使句、小写开头、末尾不加句号。从变更内容中归纳总结。语言根据上述检测结果决定。

### body（可选）

当变更需要额外背景说明时补充。每行不超过 72 字符。语言与 description 一致。

### footer（可选）

- 关联 Issue：`Closes #123`
- BREAKING CHANGE：`feat(api)!: ...` 或 footer 中写 `BREAKING CHANGE: ...`

### 示例（中文历史偏好时）

```
feat(auth): 新增 JWT 认证支持

实现 JWT token 生成与校验，支持 refresh token 机制。
Closes #234
```

```
fix(api): 处理用户查询中的 null 响应
```

```
refactor(core): 提取校验逻辑为独立模块
```

### 示例（英文历史偏好时）

```
feat(auth): add JWT authentication support

Implement JWT token generation and validation with refresh token mechanism.
Closes #234
```

```
fix(api): handle null response in user query
```

```
refactor(core): extract validation logic into standalone module
```

## 工作流程

### Step 1: 检测语言偏好

执行 `git log --format="%s" -5` 并按上述"语言偏好检测"规则统计推断，确定本次使用的语言。执行 `git status` 和 `git diff --cached --stat` 查看暂存区。

**情况 A — 暂存区有变更**：进入 Step 2。

**情况 B — 工作区有变更但未暂存**：自动执行 `git add` 暂存所有变更（或询问用户是否暂存所有），然后进入 Step 2。如果用户明确表示只提交部分文件，按用户要求 add 指定文件。

**情况 C — 无任何变更**：告知用户当前没有变更需要提交，结束流程。

### Step 2: 回顾会话上下文

在分析 diff 之前，先回顾当前会话的历史消息，理解本次变更的背景和目的：

1. **理解用户意图**：用户在此之前提出了什么需求、解决了什么问题、实现了什么功能
2. **提取关键信息**：从对话中提取功能名称、模块范围、技术决策、关联 Issue 等
3. **注意隐含信息**：用户可能没有在代码中直接体现的上下文（如业务背景、性能目标、问题复现步骤）

> 会话上下文是理解"为什么改"的关键，而 diff 展示的是"改了什么"。两者结合才能生成高质量的提交信息。

### Step 3: 分析变更并生成提交信息

结合会话上下文和暂存区的 diff 内容，理解变更的实质。按以下逻辑自动生成提交信息：

1. **判断 type**：根据变更内容和会话上下文自动判断最合适的类型
   - 新增功能/接口 → `feat`
   - 修复问题 → `fix`
   - 代码结构调整但不改功能 → `refactor`
   - 仅文档 → `docs`
   - 性能相关 → `perf`
   - 测试相关 → `test`
   - CI 配置 → `ci`
   - 依赖/构建 → `build`
   - 格式化 → `style`
   - 杂项 → `chore`

2. **判断 scope（可选）**：结合会话中提到的模块名和 diff 中涉及的范围，自动提取合适的 scope。优先使用会话中用户提及的模块名称（如 `(auth)`、`(api)`、`(ui)`）。

3. **生成 description**：通览 diff 后归纳总结，同时参考会话上下文中用户对此次变更的描述。如果变更涉及多个维度，以主要变动为准；如果范围刚好涵盖一个完整功能，可以用更抽象的表述。

   **语言规则**：按 Step 1 检测结果执行，中文或英文。

4. **生成 body（可选）**：当变更需要额外背景说明时补充。此时会话上下文特别有价值——用户可能在对话中解释了技术选型的原因、修复方法的思路、或者功能的约束条件。将这些"为什么"写进 body，让提交信息具备完整的可追溯性。
   - body 语言与 description 一致。

5. **生成 footer（可选）**：检测到 BREAKING CHANGE 时自动添加 `BREAKING CHANGE:` footer。如果会话中提到关联的 Issue 或任务编号，自动添加 `Closes #xxx`。

### Step 4: 自动提交并推送

生成提交信息后，直接执行 `git commit`。提交完成后展示提交摘要（commit hash、变更摘要）。

随后按顺序自动执行（确保提交历史线性美观）：

1. **`git pull --rebase`** — 将本地提交变基到远程最新代码之上，避免产生 merge 提交，保持 Git 历史线性
   - 若产生冲突，AI 应分析冲突内容并尝试自动解决；无法自动解决的，展示冲突文件并提示用户手动处理
2. **`git push`** — 自动推送到当前分支的远程仓库

## 关键提醒

- **AI 自主分析**：AI 完全自主分析 diff 内容和会话上下文，生成提交信息，不需要向用户提问"type 选什么？"、"description 怎么写？"这类问题
- **自动提交流程**：AI 分析完后直接生成提交信息并执行 `git commit`，无需用户确认
- **会话上下文是核心输入**：不要只看 diff，当前会话中用户和 AI 的对话是理解变更意图的关键来源。如果 diff 内容很少但对话中讨论了很多，提交信息应以对话中的完整背景为准
- **diff + 会话 = 完整图景**：diff 展示"改了什么"，会话展示"为什么改"和"怎么想到这样改"。body 部分是承载"为什么"的最佳位置
- **自动提交 + rebase + push**：AI 依次执行 `git commit` → `git pull --rebase` → `git push`，全程自动化。若 rebase 产生冲突，AI 尝试自动解决，无法自动解决时展示冲突文件提示用户
- **不要用 `git commit -a`**：只提交暂存区内容（或用户明确指定的文件）
- **多行提交信息**：body 有多行时使用 heredoc 方式提交
- **会话可能为空**：如果当前会话没有历史消息（例如新会话直接输入 `/git-commit`），则只依赖 diff 分析，按原有逻辑处理
- **语言可覆盖**：如果用户在当前会话中明确使用某种语言（如全程用英文交流），即使 git 历史偏好为中文，也应优先跟随用户当前使用的语言
