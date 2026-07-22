# my-pi-tools

个人 pi 扩展包，包含：

## 扩展

### 1. question-tool
为 pi 增加一个 `question` 工具，让 LLM 可以向用户弹出交互式选项列表，支持方向键选择、自定义输入。需要用户输入时会播放系统提示音吸引注意。

### 2. task-complete-sound
pi 完成任务后自动播放简短提示音（macOS `Glass.aiff`），让你知道任务完成了。

## 按键配置

本包包含 `config/keybindings.json`，将 Enter 改为换行、Alt+Enter 改为提交：

```json
{
  "tui.input.submit": ["alt+enter"],
  "tui.input.newLine": ["enter", "shift+enter"]
}
```

安装后执行以下命令启用：

```bash
# npm 安装的路径
cp ~/.pi/agent/npm/node_modules/my-pi-tools/config/keybindings.json ~/.pi/agent/keybindings.json

# 或者用 symlink 方便以后更新
ln -sf ~/.pi/agent/npm/node_modules/my-pi-tools/config/keybindings.json ~/.pi/agent/keybindings.json
```

然后在 pi 内执行 `/reload` 生效。

## 安装

```bash
# 从 GitHub 安装（推送后）
pi install git:github.com/chendonming/mypi

# 本地安装测试
pi install ~/Desktop/my-pi-tools
```

## 推送步骤

```bash
cd ~/Desktop/my-pi-tools
git init
git add .
git commit -m "init: question-tool + complete-sound + keybindings"
git remote add origin git@github.com:chendonming/mypi.git
git push -u origin main
```
