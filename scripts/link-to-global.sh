#!/usr/bin/env bash
#
# link-to-global.sh
#
# 将 my-pi-tools 项目中的目录/文件通过符号链接映射到全局 ~/.pi/agent/，
# 实现"在项目目录开发，全局即时生效"。
#
# 目录级别映射：
#   project/extensions/  →  ~/.pi/agent/extensions/
#   project/skills/      →  ~/.pi/agent/skills/
#   project/agents/      →  ~/.pi/agent/agents/
#   config/keybindings.json          →  ~/.pi/agent/keybindings.json
#   config/subagent-tool-description.md →  ~/.pi/agent/subagent-tool-description.md
#
# 用法: bash scripts/link-to-global.sh
#
# 首次运行会自动备份全局原有实体文件到 ~/.pi/agent/.backup/ 目录。
#

set -euo pipefail

# ── 路径 ──────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PI_AGENT_DIR="$HOME/.pi/agent"
BACKUP_DIR="$PI_AGENT_DIR/.backup/$(date '+%Y%m%d-%H%M%S')"

# 颜色
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}→${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }

# ── 备份（仅非符号链接的实体文件/目录） ───────────────────────────
backup() {
  local target="$1"
  if [ -e "$target" ] && [ ! -L "$target" ]; then
    mkdir -p "$BACKUP_DIR"
    cp -R "$target" "$BACKUP_DIR/"
    warn "已备份 $target → $BACKUP_DIR/"
  fi
}

# ── 创建目录级别符号链接 ──────────────────────────────────────────
link_dir() {
  local source="$1"   # 项目中的源目录
  local target="$2"   # 全局目标路径

  if [ ! -d "$source" ]; then
    warn "跳过：源目录不存在 $source"
    return
  fi

  # 检查现有链接
  if [ -L "$target" ]; then
    local current
    current="$(readlink "$target")"
    if [ "$current" = "$source" ]; then
      ok "已存在（正确）：${target#${PI_AGENT_DIR}/} ← ${source#${PROJECT_DIR}/}"
      return
    fi
    warn "链接指向别处：${target} → ${current}"
  fi

  backup "$target"
  rm -rf "$target"
  ln -sf "$source" "$target"
  ok "链接：${target#${PI_AGENT_DIR}/} ← ${source#${PROJECT_DIR}/}"
}

# ── 创建文件级别符号链接 ──────────────────────────────────────────
link_file() {
  local source="$1"
  local target="$2"

  if [ ! -f "$source" ]; then
    warn "跳过：源文件不存在 $source"
    return
  fi

  if [ -L "$target" ]; then
    local current
    current="$(readlink "$target")"
    if [ "$current" = "$source" ]; then
      ok "已存在（正确）：${target#${PI_AGENT_DIR}/} ← ${source#${PROJECT_DIR}/}"
      return
    fi
    warn "链接指向别处：${target} → ${current}"
  fi

  backup "$target"
  rm -rf "$target"
  mkdir -p "$(dirname "$target")"
  ln -sf "$source" "$target"
  ok "链接：${target#${PI_AGENT_DIR}/} ← ${source#${PROJECT_DIR}/}"
}

# ══════════════════════════════════════════════════════════════════
#  主流程
# ══════════════════════════════════════════════════════════════════
echo ""
info "my-pi-tools → ~/.pi/agent 目录级别符号链接映射"
echo ""

# 1. extensions/
info "extensions/ …"
link_dir "$PROJECT_DIR/extensions" "$PI_AGENT_DIR/extensions"

# 2. skills/
info "skills/ …"
link_dir "$PROJECT_DIR/skills" "$PI_AGENT_DIR/skills"

# 3. agents/
info "agents/ …"
link_dir "$PROJECT_DIR/agents" "$PI_AGENT_DIR/agents"

# 4. config 中的独立文件
info "keybindings.json …"
link_file "$PROJECT_DIR/config/keybindings.json" "$PI_AGENT_DIR/keybindings.json"

info "subagent-tool-description.md …"
link_file "$PROJECT_DIR/config/subagent-tool-description.md" "$PI_AGENT_DIR/subagent-tool-description.md"

# ── 完成 ─────────────────────────────────────────────────────────
echo ""
ok "全部完成！"
info "执行 /reload 热加载扩展和技能"
echo ""

if [ -d "$BACKUP_DIR" ]; then
  warn "备份文件位于：$BACKUP_DIR"
  warn "确认一切正常后可以删除：rm -rf '$BACKUP_DIR'"
fi
