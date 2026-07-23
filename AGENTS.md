# my-pi-tools 映射关系说明

本文档说明项目源码与 pi 全局配置之间的映射关系。

> ⚠️ **不建议通过 `pi install` 部署。** 本项目通过符号链接将目录/文件映射到全局 `~/.pi/agent/` 目录，在项目目录中修改即可即时生效（需 `/reload`）。`package.json` 中的 `pi` 字段仅作为元数据声明，不用于实际加载。

---

## 部署方式

运行项目根目录下的脚本即可一键建立所有符号链接：

```bash
bash scripts/link-to-global.sh
```

脚本会为每个目录/文件创建从全局指向项目的符号链接。

```
my-pi-tools/                    ←  ~/.pi/agent/           (符号链接)
├── extensions/              →  extensions/              ← 整目录
├── skills/                  →  skills/                  ← 整目录
├── agents/                  →  agents/                  ← 整目录
├── config/keybindings.json  →  keybindings.json         ← 独立文件
└── config/subagent-tool-description.md → subagent-tool-description.md
```

修改项目中的文件后，在 pi 内执行 `/reload` 热加载即可生效。

---

## Extensions

整个 `extensions/` 目录通过符号链接挂载到 `~/.pi/agent/extensions/`，pi 启动时自动加载该目录下的所有 `.ts` 文件。

| 项目文件 | 作用 | 注册的工具/命令 |
|---|---|---|
| `extensions/codegraph.ts` | CodeGraph CLI 工具扩展 | `codegraph` 工具 |
| `extensions/memory-system/` | 持久化记忆系统 | `memory_read` / `memory_create` / `memory_update` / `memory_delete` / `memory_search` / `memory_create_from_session` + `/memory` 命令 |
| `extensions/question-tool.ts` | 交互式提问 | `question` 工具 |
| `extensions/task-complete-sound.ts` | 完成提示音 | 自动播放 |
| `extensions/turn-timer.ts` | 对话计时 | `/timing` 命令 |

## Skills

整个 `skills/` 目录通过符号链接挂载到 `~/.pi/agent/skills/`，pi 自动注册其中的 `SKILL.md`。

| 项目目录 | 作用 |
|---|---|
| `skills/codegraph/` | CodeGraph 代码智能导航 |
| `skills/git-commit/` | 约定式提交 Git 代码 |
| `skills/grilling/` | 压力测试计划/决策 |
| `skills/init/` | 初始化项目上下文（PROJECT.md） |

## Agents

整个 `agents/` 目录通过符号链接挂载到 `~/.pi/agent/agents/`。

| 项目文件 | agent 名称 |
|---|---|
| `agents/scout.md` | `scout` — 快速代码侦察 |
| `agents/worker.md` | `worker` — 通用实现 agent |

## 独立文件映射

以下文件独立于目录级符号链接之外，单独映射到 `~/.pi/agent/` 根目录：

| 项目文件 | 全局目标 | 效果 |
|---|---|---|
| `config/keybindings.json` | `~/.pi/agent/keybindings.json` | Enter 换行，Alt+Enter 提交 |
| `config/subagent-tool-description.md` | `~/.pi/agent/subagent-tool-description.md` | Subagent 工具描述映射 |

## 同步状态（符号链接）

当前所有组件均通过符号链接指向项目文件，修改项目文件后 `/reload` 即可生效：

| 类别 | 全局路径 | 来源 | 链接方式 |
|---|---|---|---|
| **extensions/** | `~/.pi/agent/extensions/` | `extensions/` | 📁 目录级符号链接 |
| **skills/** | `~/.pi/agent/skills/` | `skills/` | 📁 目录级符号链接 |
| **agents/** | `~/.pi/agent/agents/` | `agents/` | 📁 目录级符号链接 |
| **keybindings.json** | `~/.pi/agent/keybindings.json` | `config/keybindings.json` | 📄 文件符号链接 |
| **subagent-tool-description.md** | `~/.pi/agent/subagent-tool-description.md` | `config/subagent-tool-description.md` | 📄 文件符号链接 |

## 重新加载

修改项目文件后，在 pi 内执行 `/reload` 热加载扩展和技能。符号链接会确保全局始终读取项目中的最新内容。

---

## 开发流程

本项目是 pi 扩展/技能/agent 的开发调试项目。由于 `~/.pi/agent/` 下的 `extensions/`、`skills/`、`agents/` 三个目录和 `keybindings.json`、`subagent-tool-description.md` 两个配置文件均通过符号链接指向本项目，因此开发流程如下：

### 编辑文件

**所有修改都在本项目目录中进行。** 不要直接修改 `~/.pi/agent/` 下的文件，因为那会破坏符号链接。

例如：
- 修改扩展 → 编辑 `extensions/` 下的 `.ts` 文件
- 修改技能 → 编辑 `skills/` 下的 `SKILL.md`
- 修改 agent → 编辑 `agents/` 下的 `.md` 文件
- 修改按键 → 编辑 `config/keybindings.json`
- 新增扩展 → 在 `extensions/` 下创建新的 `.ts` 文件
- 新增技能 → 在 `skills/` 下创建新的目录并放入 `SKILL.md`

### 生效

修改后，在 pi 中执行 `/reload` 即可热加载，无需手动复制或重新部署。

### 首次部署到新机器

```bash
git clone <repo-url>
cd my-pi-tools
bash scripts/link-to-global.sh
```

### 调试指南

调试扩展/技能/agent 时，有时需要观察 pi 在新会话中的行为。此时按以下流程操作：

1. 告知 AI 正在调试的项目名称或路径（或从对话上下文推断）
2. AI 自行前往 `~/.pi/agent/sessions/{project-path}/` 目录查找最新会话文件
   - 目录名规则：将项目绝对路径中的 `/` 替换为 `--`，首尾加 `--`
   - 例如 `/Users/chendongmin/Documents/my-pi-tools` → `--Users-chendongmin-Documents-my-pi-tools--`
3. 会话文件为 `.jsonl` 格式，文件名带 ISO 时间戳，按字母序排序取最后一个即为最新
4. AI 读取该会话文件分析新会话中的行为表现

```bash
# 示例：获取 my-pi-tools 项目的最新会话文件
ls -t ~/.pi/agent/sessions/--Users-chendongmin-Documents-my-pi-tools--/*.jsonl | head -1
```
