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

| 类别 | 全局路径 | 来源 | 管理方式 |
|---|---|---|---|
| **extensions/** | `~/.pi/agent/extensions/` | `extensions/` | 📁 符号链接 |
| **skills/** | `~/.pi/agent/skills/` | `skills/` | 📁 符号链接 |
| **agents/** | `~/.pi/agent/agents/` | `agents/` | 📁 符号链接 |
| **keybindings.json** | `~/.pi/agent/keybindings.json` | `config/keybindings.json` | 📄 符号链接 |
| **subagent-tool-description.md** | `~/.pi/agent/subagent-tool-description.md` | `config/subagent-tool-description.md` | 📄 符号链接 |
| **subagent config.json** | `~/.pi/agent/extensions/subagent/config.json` | `extensions/subagent/config.json` | 📄 符号链接（通过 extensions/） |
| **pi settings** | `~/.pi/agent/settings.json` | `config/settings.template.json` | 🟡 模板，手动复制 |
| **pi wrapper** | `~/.local/bin/pi` | `config/pi-wrapper.template.sh` | 🟡 模板，手动复制 |

## Tools（独立脚本）

项目 `tools/` 目录下的脚本可以通过 `python3 tools/<script>` 调用，或直接运行（需可执行权限）。
这些脚本不通过 pi 加载，是独立的命令行工具。

| 脚本 | 作用 | 跨平台 |
|------|------|--------|
| `tools/session-view` | Pi 会话查看器：Web UI 浏览 + AI 压缩分析 | ✅ Python 3，macOS/Linux/Windows |

### session-view

用于分析 pi 代理会话（`.jsonl` 文件）的执行过程。两个核心场景：

**场景一：人类查看 — 浏览器 Web UI**
```bash
# 打开当前项目的最新会话
python3 tools/session-view

# 打开指定文件
python3 tools/session-view --web -f <路径/xxx.jsonl>

# 打开其他项目的最新会话
python3 tools/session-view --web -p other-project
```

Web UI 支持：拖拽加载、折叠/展开、全文搜索、按类型过滤（thinking/tool calls/results）、
展开全部/折叠全部、**一键复制 AI 摘要**。

**场景二：AI 分析 — 压缩版 Markdown 输出**
```bash
# 输出当前项目最新会话的 AI 压缩版
python3 tools/session-view --ai

# 输出到文件，然后读取分析
python3 tools/session-view --ai -f <路径/xxx.jsonl> > session-summary.md
```

AI 压缩策略：
- Thinking 块：保留头尾，省略中间（可节省 60-80% token）
- Tool result：每个最多保留 800 字符
- 超长文本：截断至 2000 字符
- Token 成本：仅保留总览，不在每条消息重复

**其他命令：**
```bash
# 列出最近会话
python3 tools/session-view --list

# 指定项目筛选
python3 tools/session-view --ai -p my-pi-tools
```

**AI 如何建议用户使用：**
当用户需要调试 pi 代理的会话行为，或分析大模型执行情况时，AI 应：
1. 建议用户运行 `python3 tools/session-view` 以浏览器打开 Web UI（人类友好）
2. 或运行 `python3 tools/session-view --ai > summary.md` 生成压缩摘要，然后 AI 直接读取 summary.md 进行分析

---

## 重新加载

修改项目文件后，在 pi 内执行 `/reload` 热加载扩展和技能。符号链接会确保全局始终读取项目中的最新内容。

---

## 完整性检查清单

新机器恢复后，或每次修改 pi 相关配置后，用此清单核对是否完整。

### 🟢 通过符号链接管理（`link-to-global.sh` → git 跟踪）

| # | 组件 | 项目路径 | 全局目标 | 说明 |
|---|------|---------|---------|------|
| 1 | **extensions/** | `extensions/` | `~/.pi/agent/extensions/` | 📁 整目录符号链接，扩展 `.ts` 文件 |
| 2 | **skills/** | `skills/` | `~/.pi/agent/skills/` | 📁 整目录符号链接，SKILL.md |
| 3 | **agents/** | `agents/` | `~/.pi/agent/agents/` | 📁 整目录符号链接，agent 定义 `.md` |
| 4 | **keybindings.json** | `config/keybindings.json` | `~/.pi/agent/keybindings.json` | 📄 Enter 换行 / Alt+Enter 提交 |
| 5 | **subagent-tool-description.md** | `config/subagent-tool-description.md` | `~/.pi/agent/subagent-tool-description.md` | 📄 意图→agent 映射表 + ⚠️ 强制委托规则 |
| 6 | **delegation-enforcer.ts** | `extensions/delegation-enforcer.ts` | `~/.pi/agent/extensions/delegation-enforcer.ts` | ⚙️ 运行时强制：system prompt 注入 + tool_call 拦截 |
| 7 | **delegation-rules skill** | `skills/delegation-rules/SKILL.md` | `~/.pi/agent/skills/delegation-rules/SKILL.md` | 📖 on-demand 规则参考 Skill |

### 🟡 模板文件（项目 git 跟踪，手动复制到全局）

| # | 组件 | 模板路径 | 全局目标 | 为何不能符号链接 |
|---|------|---------|---------|----------------|
| 8 | **pi settings.json** | `config/settings.template.json` | `~/.pi/agent/settings.json` | ⚠️ pi 运行时写入字段，符号链接触发备份逻辑 |
| 9 | **pi wrapper 脚本** | `config/pi-wrapper.template.sh` | `~/.local/bin/pi` | 独立于 `~/.pi/agent/`，无法符号链接 |

### 🔴 全局依赖（无法通过 git 恢复，需手动安装）

| # | 组件 | 安装方式 | 版本要求 |
|---|------|---------|---------|
| 10 | **pi CLI** | `npm install -g @earendil-works/pi-coding-agent` | 与 `~/.pi/agent/settings.json` 中的 changelog 版本一致 |
| 11 | **Node.js** | 通过 nvm 安装（当前：v22.9.0） | ≥ 18 |
| 12 | **nvm** | 官网安装 | ≥ 0.40 |
| 13 | **npm 包：pi-subagents** | pi 启动时自动按 settings.json packages 安装 | 由 pi 管理 |
| 14 | **npm 包：pi-web-access | pi 启动时自动按 settings.json packages 安装 | 由 pi 管理 |
| 15 | **API 密钥 / 认证** | 各 provider 官网配置 | 按需 |

修改 pi 配置后应执行：
1. 核实是否有新增全局文件 → 添加到模板或符号链接
2. 更新 `AGENTS.md` 的检查清单（仅在管理关系发生变化时）
3. 更新 `link-to-global.sh`（如果新增了符号链接）

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
# 1. 安装 pi CLI（需要先安装 Node.js ≥ 18）
npm install -g @earendil-works/pi-coding-agent

# 2. 克隆本项目
cd ~/Documents
git clone <repo-url>
cd my-pi-tools

# 3. 建立符号链接（扩展/技能/agent/按键映射）
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
