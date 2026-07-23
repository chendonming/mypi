# my-pi-tools

个人 pi 扩展包，包含自定义扩展、技能、agents 和按键配置。

## 扩展

### 1. question-tool
为 pi 增加一个 `question` 工具，让 LLM 可以向用户弹出交互式选项列表，支持方向键选择、自定义输入。需要用户输入时会播放系统提示音吸引注意。

### 2. task-complete-sound
pi 完成任务后自动播放简短提示音（macOS `Glass.aiff`），让你知道任务完成了。

### 3. turn-timer
对话计时扩展，记录每轮对话时长：
- 对话中：输入框下方实时显示当前轮次耗时（每秒刷新）
- 每轮结束时：状态栏显示该轮耗时和累计时间
- 支持 `/timing` 命令查看详细统计

## 技能

### 1. git-commit
按照 [Conventional Commits](https://www.conventionalcommits.org/) 规范自动提交 Git 代码并以 rebase 方式推送。
通过分析当前仓库的 git 历史推断语言偏好（中文/英文）。

### 2. grilling
压力测试你的计划、决策或想法：通过并行 subagents 收集环境事实，然后逐一提问。

## Agents

### 1. scout
快速代码侦察 agent，压缩上下文供其他 agent 接手。

### 2. worker
通用实现 agent，负责执行分配的任务或已批准的方案。

## 按键配置

本包包含 `config/keybindings.json`，将 Enter 改为换行、Alt+Enter 改为提交：

```json
{
  "tui.input.submit": ["alt+enter"],
  "tui.input.newLine": ["enter", "shift+enter"]
}
```

## 安装

```bash
# 从 GitHub 安装（需要先推送到远程仓库）
pi install git:github.com/chendonming/mypi

# 本地路径测试
pi install E:/workplace/mypi
```

安装完成后在 pi 内执行 `/reload` 热加载扩展和技能。

### 一次性手动配置

以下部分无法通过 pi 包自动安装，需要手动执行：

```bash
# 1. 安装按键绑定（symlink 方便以后更新）
ln -sf ~/.pi/agent/npm/node_modules/my-pi-tools/config/keybindings.json ~/.pi/agent/keybindings.json

# 2. 安装 agents
mkdir -p ~/.pi/agent/agents
ln -sf ~/.pi/agent/npm/node_modules/my-pi-tools/agents/scout.md ~/.pi/agent/agents/scout.md
ln -sf ~/.pi/agent/npm/node_modules/my-pi-tools/agents/worker.md ~/.pi/agent/agents/worker.md

# 3. 重新加载生效
/reload
```

> **注意**：如果使用 `pi install` 本地路径形式安装，包的实际路径可能不同。可通过 `pi list` 查看安装位置。

## 卸载

```bash
pi remove npm:my-pi-tools
```

然后手动删除 symlink：

```bash
rm ~/.pi/agent/keybindings.json
rm ~/.pi/agent/agents/scout.md
rm ~/.pi/agent/agents/worker.md
```

## 项目结构

```
├── package.json             # pi 包清单
├── README.md
├── .gitignore
├── agents/                  # agent 定义（需手动安装）
│   ├── scout.md
│   └── worker.md
├── config/
│   └── keybindings.json     # 按键配置（需手动安装）
├── extensions/              # 扩展（自动加载）
│   ├── question-tool.ts
│   ├── task-complete-sound.ts
│   └── turn-timer.ts
└── skills/                  # 技能（自动加载）
    ├── git-commit/SKILL.md
    └── grilling/SKILL.md
```

## 推送步骤

```bash
cd E:/workplace/mypi
git add .
git commit -m "update: add skills, agents, turn-timer"
git push -u origin main
```
