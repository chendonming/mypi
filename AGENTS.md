# my-pi-tools 映射关系

本项目通过符号链接映射到 `~/.pi/agent/`，修改项目文件后 `/reload` 生效。`package.json` 中的 `pi` 字段仅为元数据声明。

## 部署

```bash
bash scripts/link-to-global.sh                           # Linux / macOS
scripts\link-to-global.bat                               # Windows（双击，自动提权）
.\scripts\link-to-global.ps1 -Force                      # Windows PowerShell
```

> Windows 需管理员权限或开发者模式。

## 组件清单

| 项目路径 | 全局目标 | 类型 |
|---------|---------|------|
| `extensions/` | `~/.pi/agent/extensions/` | 📁 符号链接 |
| `skills/` | `~/.pi/agent/skills/` | 📁 符号链接 |
| `agents/` | `~/.pi/agent/agents/` | 📁 符号链接 |
| `config/keybindings.json` | `~/.pi/agent/keybindings.json` | 📄 符号链接 |
| `config/subagent-tool-description.md` | `~/.pi/agent/subagent-tool-description.md` | 📄 符号链接 |
| `config/settings.template.json` | `~/.pi/agent/settings.json` | 🟡 手动复制 |
| `config/pi-wrapper.template.sh` | `~/.local/bin/pi` | 🟡 手动复制 |

## Extensions

| 文件 | 注册 |
|------|------|
| `extensions/codegraph.ts` | `codegraph` 工具 |
| `extensions/memory-system/` | `memory_*` 工具 + `/memory` |
| `extensions/question-tool.ts` | `question` 工具 |
| `extensions/delegation-enforcer.ts` | 强制委托：prompt 注入 + tool_call 拦截 |
| `extensions/post-task-validator.ts` | git diff 校验 + 垃圾清理（agent_settled） |
| `extensions/task-complete-sound.ts` | 完成提示音 |
| `extensions/turn-timer.ts` | `/timing` 命令 |

## Skills

| 目录 | 作用 |
|------|------|
| `skills/codegraph/` | 代码智能导航 |
| `skills/git-commit/` | 约定式提交 |
| `skills/grilling/` | 压力测试 |
| `skills/init/` | 初始化项目上下文 |
| `skills/delegation-rules/` | 强制委托规则 |

## Agents

| 文件 | 名称 |
|------|------|
| `agents/scout.md` | `scout` — 快速代码侦察 |
| `agents/worker.md` | `worker` — 通用实现 |

## Tools

| 命令 | 作用 |
|------|------|
| `python3 tools/session-view` | 浏览器查看最新会话 |
| `python3 tools/session-view --ai` | AI 压缩版 Markdown 输出 |
| `python3 tools/session-view --list` | 列出最近会话 |

## 开发

- **所有修改在项目目录中进行**，不要直接改 `~/.pi/agent/`
- 修改后在 pi 内 `/reload` 生效
- 会话文件：`~/.pi/agent/sessions/{path}`（`/` → `--`），最新 `.jsonl` 即为最新会话

### 新机器部署

```bash
npm install -g @earendil-works/pi-coding-agent
git clone <repo-url> && cd my-pi-tools
bash scripts/link-to-global.sh                           # Linux / macOS
# scripts\link-to-global.bat                             # Windows
cp config/settings.template.json ~/.pi/agent/settings.json
pi
```

| 全局依赖 | 安装方式 |
|---------|---------|
| Node.js ≥ 18 | nvm |
| pi-subagents / pi-web-access | pi 启动时自动安装 |
| API 密钥 | 各 provider 官网配置 |
