# my-pi-tools 映射关系说明

本文档说明项目源码与 pi 全局配置之间的映射关系。

> ⚠️ **不建议通过 `pi install` 部署。** 本项目通过符号链接将文件映射到全局 `~/.pi/agent/` 目录，在项目目录中修改即可即时生效（需 `/reload`）。`package.json` 中的 `pi` 字段仅作为元数据声明，不用于实际加载。

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

通过符号链接挂载到 `~/.pi/agent/extensions/`，pi 启动时自动加载该目录下的所有 `.ts` 文件。

| 项目文件 | 全局目标 | 作用 | 注册的工具/命令 |
|---|---|---|---|
| `extensions/codegraph.ts` | `~/.pi/agent/extensions/codegraph.ts` | CodeGraph CLI 工具扩展 | `codegraph` 工具 |
| `extensions/memory-system/` | `~/.pi/agent/extensions/memory-system/` | 持久化记忆系统 | `memory_read` / `memory_create` / `memory_update` / `memory_delete` / `memory_search` / `memory_create_from_session` + `/memory` 命令 |
| `extensions/question-tool.ts` | `~/.pi/agent/extensions/question-tool.ts` | 交互式提问 | `question` 工具 |
| `extensions/task-complete-sound.ts` | `~/.pi/agent/extensions/task-complete-sound.ts` | 完成提示音 | 自动播放 |
| `extensions/turn-timer.ts` | `~/.pi/agent/extensions/turn-timer.ts` | 对话计时 | `/timing` 命令 |

## Skills

Skill 目录通过符号链接挂载到 `~/.pi/agent/skills/`，pi 自动注册其中的 `SKILL.md`。

| 项目目录 | 全局目标 | 作用 |
|---|---|---|
| `skills/codegraph/` | `~/.pi/agent/skills/codegraph/` | CodeGraph 代码智能导航 |
| `skills/git-commit/` | `~/.pi/agent/skills/git-commit/` | 约定式提交 Git 代码 |
| `skills/grilling/` | `~/.pi/agent/skills/grilling/` | 压力测试计划/决策 |
| `skills/init/` | `~/.pi/agent/skills/init/` | 初始化项目上下文（PROJECT.md） |

## Agents

Agent 定义文件通过符号链接挂载到 `~/.pi/agent/agents/`。

| 项目文件 | 全局目标 | agent 名称 |
|---|---|---|
| `agents/scout.md` | `~/.pi/agent/agents/scout.md` | `scout` — 快速代码侦察 |
| `agents/worker.md` | `~/.pi/agent/agents/worker.md` | `worker` — 通用实现 agent |

## 按键配置

| 项目文件 | 全局目标 | 效果 |
|---|---|---|
| `config/keybindings.json` | `~/.pi/agent/keybindings.json` | Enter 换行，Alt+Enter 提交 |
| `config/subagent-tool-description.md` | `~/.pi/agent/subagent-tool-description.md` | Subagent 工具描述映射 |

## 同步状态（符号链接）

当前所有组件均通过符号链接指向项目文件，修改项目文件后 `/reload` 即可生效：

| 类别 | 全局路径 | 来源 |
|---|---|---|
| `extensions/codegraph.ts` | `~/.pi/agent/extensions/codegraph.ts` | `extensions/codegraph.ts` |
| `extensions/memory-system/` | `~/.pi/agent/extensions/memory-system/` | `extensions/memory-system/` |
| `extensions/question-tool.ts` | `~/.pi/agent/extensions/question-tool.ts` | `extensions/question-tool.ts` |
| `extensions/task-complete-sound.ts` | `~/.pi/agent/extensions/task-complete-sound.ts` | `extensions/task-complete-sound.ts` |
| `extensions/turn-timer.ts` | `~/.pi/agent/extensions/turn-timer.ts` | `extensions/turn-timer.ts` |
| `skills/codegraph/` | `~/.pi/agent/skills/codegraph/` | `skills/codegraph/` |
| `skills/git-commit/` | `~/.pi/agent/skills/git-commit/` | `skills/git-commit/` |
| `skills/grilling/` | `~/.pi/agent/skills/grilling/` | `skills/grilling/` |
| `skills/init/` | `~/.pi/agent/skills/init/` | `skills/init/` |
| `agents/scout.md` | `~/.pi/agent/agents/scout.md` | `agents/scout.md` |
| `agents/worker.md` | `~/.pi/agent/agents/worker.md` | `agents/worker.md` |
| `keybindings.json` | `~/.pi/agent/keybindings.json` | `config/keybindings.json` |
| `subagent-tool-description.md` | `~/.pi/agent/subagent-tool-description.md` | `config/subagent-tool-description.md` |

## 重新加载

修改项目文件后，在 pi 内执行 `/reload` 热加载扩展和技能。符号链接会确保全局始终读取项目中的最新内容。
