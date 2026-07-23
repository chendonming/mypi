# my-pi-tools

个人 pi 扩展包，包含自定义扩展、技能、agents、按键配置和部署脚本。

> ⚠️ **本项目通过符号链接部署**，而非 `pi install`。详见[部署方式](#部署方式)。

---

## 扩展

整个 `extensions/` 目录通过符号链接挂载到 `~/.pi/agent/extensions/`，pi 启动时自动加载。

| 扩展 | 文件 | 作用 | 注册的工具/命令 |
|------|------|------|----------------|
| **memory-system** | `extensions/memory-system/` | 持久化记忆系统，跨会话记住项目信息 | `memory_read` / `memory_create` / `memory_update` / `memory_delete` / `memory_search` / `memory_create_from_session` + `/memory` 命令 |
| **codegraph** | `extensions/codegraph.ts` | CodeGraph CLI 工具扩展 | `codegraph` 工具 |
| **question-tool** | `extensions/question-tool.ts` | 交互式提问，支持选项列表、多选、自定义输入 | `question` 工具 |
| **task-complete-sound** | `extensions/task-complete-sound.ts` | 任务完成时自动播放提示音（macOS `Glass.aiff`） | 自动播放 |
| **turn-timer** | `extensions/turn-timer.ts` | 对话计时，实时显示耗时，颜色随时长变化 | `/timing` 命令 |
| **delegation-enforcer** | `extensions/delegation-enforcer.ts` | 运行时强制委托规则：system prompt 注入 + tool_call 拦截 | 自动生效 |
| **subagent** | `extensions/subagent/config.json` | subagent 配置 | 由 pi-subagents 管理 |

### memory-system 详情

持久化记忆系统，让 AI 能跨会话记住项目重要信息。每次对话开始时自动加载记忆索引，按需读取完整内容。

提供 6 个 LLM 工具：
- `memory_read` — 按名称读取完整记忆
- `memory_create` — 创建结构化知识条目（含 Why / How to apply）
- `memory_create_from_session` — 保存当前对话为记忆
- `memory_update` — 更新已有记忆
- `memory_delete` — 删除记忆
- `memory_search` — 全文搜索

用户命令 `/memory` 支持：`save`、`add`、`search`、`open`、`clear`。

每条记忆是一篇 Markdown 知识库文章，存储在 `~/.pi/memory/`，分 project（项目级）和 user（跨项目）两种作用域。

> 详情见 [extensions/memory-system/README.md](extensions/memory-system/README.md)

---

## 技能

整个 `skills/` 目录通过符号链接挂载到 `~/.pi/agent/skills/`，pi 自动注册其中的 `SKILL.md`。

| 技能 | 目录 | 作用 |
|------|------|------|
| **codegraph** | `skills/codegraph/` | CodeGraph 代码智能导航 — 搜索符号、追踪调用链、分析影响、探索区域 |
| **git-commit** | `skills/git-commit/` | 按 [Conventional Commits](https://www.conventionalcommits.org/) 规范自动提交 Git 代码并以 rebase 方式推送 |
| **grilling** | `skills/grilling/` | 压力测试计划/决策 — 通过并行 subagents 收集事实，逐一提问 |
| **init** | `skills/init/` | 初始化项目上下文（PROJECT.md）— 分析代码库产生简洁知识库摘要 |
| **delegation-rules** | `skills/delegation-rules/` | ⚠️ 强制委托行为规则 — on-demand 规则参考 Skill |

---

## Agents

整个 `agents/` 目录通过符号链接挂载到 `~/.pi/agent/agents/`。

| Agent | 文件 | 作用 |
|-------|------|------|
| **scout** | `agents/scout.md` | 快速代码侦察 — 只读的代码库探索，返回压缩上下文 |
| **worker** | `agents/worker.md` | 通用实现 agent — 负责执行分配的任务或已批准的方案 |

---

## 配置文件

以下独立文件通过符号链接映射到 `~/.pi/agent/` 根目录：

| 项目文件 | 全局目标 | 效果 |
|---------|---------|------|
| `config/keybindings.json` | `~/.pi/agent/keybindings.json` | Enter 换行，Alt+Enter 提交 |
| `config/subagent-tool-description.md` | `~/.pi/agent/subagent-tool-description.md` | 意图→Agent 映射表 + ⚠️ 强制委托规则 |

### keybindings.json 详情

将 Enter 改为换行、Alt+Enter 改为提交：

```json
{
  "tui.input.submit": ["alt+enter"],
  "tui.input.newLine": ["enter", "shift+enter"]
}
```

### 模板文件（手动复制）

以下文件在项目中跟踪，但因 pi 运行时行为不能符号链接，需手动复制：

| 模板路径 | 全局目标 | 说明 |
|---------|---------|------|
| `config/settings.template.json` | `~/.pi/agent/settings.json` | pi 设置（pi 运行时写入字段，符号链接触发备份逻辑） |
| `config/pi-wrapper.template.sh` | `~/.local/bin/pi` | pi wrapper 脚本（解决 nvm 多版本问题，独立于 `~/.pi/agent/`） |

---

## 部署方式

本项目**不建议通过 `pi install` 部署**。改为通过符号链接将目录/文件映射到全局 `~/.pi/agent/` 目录，在项目目录中修改即可即时生效（需 `/reload`）。

### 一键部署

运行根目录下的脚本即可建立所有符号链接：

```bash
bash scripts/link-to-global.sh
```

脚本会创建以下映射关系：

```
my-pi-tools/                    ←  ~/.pi/agent/           (符号链接)
├── extensions/              →  extensions/              ← 整目录
├── skills/                  →  skills/                  ← 整目录
├── agents/                  →  agents/                  ← 整目录
├── config/keybindings.json  →  keybindings.json         ← 独立文件
└── config/subagent-tool-description.md → subagent-tool-description.md
```

### 首次部署到新机器

```bash
# 1. 安装 pi CLI（需要先安装 Node.js ≥ 18）
npm install -g @earendil-works/pi-coding-agent

# 2. 克隆本项目
cd ~/Documents
git clone <repo-url>
cd my-pi-tools

# 3. 建立符号链接（扩展/技能/agent/配置文件映射）
bash scripts/link-to-global.sh

# 4. 复制 settings.json（pi 会写入此文件，不能符号链接）
cp config/settings.template.json ~/.pi/agent/settings.json

# 5. （可选）创建 pi wrapper 脚本，解决 nvm 多版本问题
mkdir -p ~/.local/bin
cp config/pi-wrapper.template.sh ~/.local/bin/pi
chmod +x ~/.local/bin/pi

# 6. 启动 pi，它会自动安装 settings.json 中声明的 npm 包
pi
```

### 重新加载

修改项目文件后，在 pi 内执行 `/reload` 热加载扩展和技能。符号链接会确保全局始终读取项目中的最新内容。

---

## 项目结构

```
my-pi-tools/
├── package.json                # pi 包元数据声明
├── README.md                   # 本文件
├── AGENTS.md                   # 映射关系说明 + 完整性检查清单
├── .gitignore
├── scripts/
│   └── link-to-global.sh       # 一键建立符号链接到全局
├── agents/                     # agent 定义
│   ├── scout.md                # 快速代码侦察 agent
│   └── worker.md               # 通用实现 agent
├── config/
│   ├── keybindings.json        # 按键配置（Enter 换行 / Alt+Enter 提交）
│   ├── subagent-tool-description.md  # 意图→Agent 映射表 + 强制委托规则
│   ├── settings.template.json  # pi 设置模板（需手动复制）
│   └── pi-wrapper.template.sh  # pi wrapper 脚本模板（需手动复制）
├── extensions/                 # 扩展（自动加载）
│   ├── codegraph.ts            # CodeGraph CLI 工具
│   ├── delegation-enforcer.ts  # 强制委托规则运行时拦截
│   ├── memory-system/          # 持久化记忆系统
│   │   ├── index.ts
│   │   └── README.md
│   ├── question-tool.ts        # 交互式提问工具
│   ├── subagent/
│   │   └── config.json         # subagent 配置
│   ├── task-complete-sound.ts  # 完成提示音
│   └── turn-timer.ts           # 对话计时
└── skills/                     # 技能（自动加载）
    ├── codegraph/SKILL.md      # CodeGraph 代码智能导航
    ├── delegation-rules/SKILL.md   # ⚠️ 强制委托行为规则
    ├── git-commit/SKILL.md     # 约定式提交
    ├── grilling/SKILL.md       # 压力测试
    └── init/SKILL.md           # 项目上下文初始化
```

---

## 开发流程

本项目是 pi 扩展/技能/agent 的开发调试项目。由于 `~/.pi/agent/` 下的目录和配置文件均通过符号链接指向本项目，因此：

### 编辑文件

**所有修改都在本项目目录中进行。** 不要直接修改 `~/.pi/agent/` 下的文件，那会破坏符号链接。

- 修改扩展 → 编辑 `extensions/` 下的 `.ts` 文件
- 修改技能 → 编辑 `skills/` 下的 `SKILL.md`
- 修改 agent → 编辑 `agents/` 下的 `.md` 文件
- 修改按键 → 编辑 `config/keybindings.json`
- 新增扩展 → 在 `extensions/` 下创建新的 `.ts` 文件
- 新增技能 → 在 `skills/` 下创建新的目录并放入 `SKILL.md`

### 生效

修改后，在 pi 中执行 `/reload` 即可热加载，无需手动复制或重新部署。

---

## 卸载

```bash
# 1. 删除符号链接
rm -rf ~/.pi/agent/extensions
rm -rf ~/.pi/agent/skills
rm -rf ~/.pi/agent/agents
rm -f ~/.pi/agent/keybindings.json
rm -f ~/.pi/agent/subagent-tool-description.md

# 2. 如需还原默认配置，可删除 settings.json
rm ~/.pi/agent/settings.json
```

---

## 完整性检查清单

完整检查清单见 [AGENTS.md](./AGENTS.md#完整性检查清单)，涵盖：
- 🟢 **通过符号链接管理** — extensions/、skills/、agents/、keybindings.json 等
- 🟡 **模板文件** — settings.json、pi wrapper 脚本（需手动复制）
- 🔴 **全局依赖** — pi CLI、Node.js、nvm、npm 包、API 密钥
