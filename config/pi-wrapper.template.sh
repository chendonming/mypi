#!/bin/bash
# pi wrapper 脚本
# 解决 nvm 切换 Node 版本后 pi 命令丢失的问题。
# 
# 原理：pi 安装在某一个特定 Node 版本的 bin 下，
# 切换版本后 PATH 中不再包含该路径，此 wrapper 硬编码指向原始 pi 二进制。
#
# 新机器上调整下方的具体路径后使用：
#   chmod +x ~/.local/bin/pi
#   # 确保 ~/.local/bin 在 PATH 中

# TODO: 替换为当前机器安装 pi 的 Node 版本的 bin 路径
exec ~/.nvm/versions/node/v22.9.0/bin/pi "$@"
