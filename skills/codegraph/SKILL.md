---
name: codegraph
description: 预构建的代码智能工具，适用于任何代码库 — 搜索符号、追踪 caller/callee、探索区域、分析影响、列出文件结构。用于代码库导航和依赖分析。
---

# CodeGraph

[CodeGraph](https://codegraph.sh) 为你的代码库构建可搜索的索引，并提供 CLI 用于快速、有针对性的探索。适用于任何语言。

## 前提条件

- 已安装 `codegraph` CLI（`which codegraph`）
- 项目拥有 `.codegraph` 目录（如果缺失，运行 `codegraph init`）
- 扩展的 `codegraph` 工具会自动检测 `.codegraph` 位于：
  - 当前工作目录
  - 父目录（pi 在项目子文件夹中打开）
  - 直接子目录（多项目工作空间）
- 当存在多个 .codegraph 索引时，通过 `path` 参数指定目标项目

## 快速开始

```bash
# 检查索引是否就绪
codegraph status

# 探索某个区域（一键获取：符号 + 源码 + 调用路径）
codegraph explore "用户认证流程"

# 搜索符号
codegraph query sendEmail -k function

# 查看单个符号的完整源码 + caller/callee 追踪
codegraph node SessionManager

# 追踪依赖关系
codegraph callers authenticateUser
codegraph callees authenticateUser

# 重构前分析变更影响
codegraph impact validateToken

# 列出项目结构
codegraph files --format tree --max-depth 3
```

## 命令参考

### `codegraph status [path]`

检查索引状态和统计信息。

| 选项 | 说明 |
|--------|-------------|
| `-j` | JSON 输出 |

### `codegraph explore <query...>`

一键探索：相关符号的源码 + 调用路径。

| 选项 | 说明 |
|--------|-------------|
| `-p <path>` | 项目路径 |
| `--max-files <n>` | 包含源码的最大文件数 |

在调查陌生区域时，将其作为**默认首选命令**。

### `codegraph query <search>`

在代码库中搜索符号。

| 选项 | 说明 |
|--------|-------------|
| `-k <kind>` | 按类型过滤：`function`、`class`、`interface`、`method`、`variable`、`type`、`enum` |
| `-l <n>` | 最大结果数（默认：10） |
| `-p <path>` | 项目路径 |
| `-j` | JSON 输出 |

### `codegraph node [name]`

单个符号的源码 + caller/callee 追踪。也可以按文件模式读取（带行号及相关信息）。

| 选项 | 说明 |
|--------|-------------|
| `-f <file>` | 按文件模式处理（或将符号限定到该文件） |
| `--offset <n>` | 文件模式：从第几行开始（1-based） |
| `--limit <n>` | 文件模式：最大行数 |
| `--symbols-only` | 文件模式：仅输出符号映射 + 依赖信息 |
| `-p <path>` | 项目路径 |

### `codegraph callers <symbol>`

查找调用特定符号的所有函数/方法。

| 选项 | 说明 |
|--------|-------------|
| `-l <n>` | 最大结果数（默认：20） |
| `-p <path>` | 项目路径 |
| `-j` | JSON 输出 |

### `codegraph callees <symbol>`

查找特定符号调用的所有函数/方法。

| 选项 | 说明 |
|--------|-------------|
| `-l <n>` | 最大结果数（默认：20） |
| `-p <path>` | 项目路径 |
| `-j` | JSON 输出 |

### `codegraph impact <symbol>`

分析修改某个符号会影响哪些代码。

| 选项 | 说明 |
|--------|-------------|
| `-d <n>` | 遍历深度（默认：2） |
| `-p <path>` | 项目路径 |
| `-j` | JSON 输出 |

在进行**重构之前**运行此命令以了解影响范围。

### `codegraph affected [files...]`

查找受变更源文件影响的测试文件。

| 选项 | 说明 |
|--------|-------------|
| `--stdin` | 从 stdin 读取文件列表（每行一个） |
| `-d <n>` | 最大依赖遍历深度（默认：5） |
| `-f <glob>` | 自定义测试文件 glob 过滤器（如 `"e2e/*.spec.ts"`） |
| `-p <path>` | 项目路径 |
| `-j` | JSON 输出 |
| `-q` | 仅输出文件路径，无装饰 |

### `codegraph files`

显示索引中的项目文件结构。

| 选项 | 说明 |
|--------|-------------|
| `--format <fmt>` | 输出格式：`tree`、`flat`、`grouped`（默认：tree） |
| `--max-depth <n>` | tree 格式的最大目录深度 |
| `--filter <dir>` | 过滤到此目录下的文件 |
| `--pattern <glob>` | 按 glob 模式过滤文件 |
| `--no-metadata` | 隐藏文件元数据（语言、符号数） |
| `-p <path>` | 项目路径 |
| `-j` | JSON 输出 |

## 多项目工作空间

当 pi 在包含多个子项目（各自拥有 `.codegraph`）的父目录中打开时：

```
root/                      ← pi 在此打开
├── frontend/
│   └── .codegraph         ← 已 codegraph init
└── backend/
    └── .codegraph         ← 已 codegraph init
```

`codegraph` 工具自动扫描子目录中的 `.codegraph`。
如果恰好找到一个，自动使用。
如果找到多个，工具返回提示列出所有可用索引，
LLM 应使用 `path` 参数重试（工具会自动选择合适的 CLI 参数形式）：

```
# 指定 frontend 项目
codegraph  command:status  path:"frontend"

# 指定 backend 项目
codegraph  command:query  query:"AuthService"  path:"backend"
```

### 参数差异说明

不同命令对项目路径的接受方式不同，扩展工具会自动处理：

| 命令 | 路径传入方式 |
|------|-------------|
| `explore` `query` `node` `callers` `callees` `impact` `affected` `files` | `-p <path>` 标志 |
| `status` `init` `uninit` `index` `sync` `unlock` | 位置参数 `[path]`（无 `-p`） |

无论哪种情况，你只需传入 `path` 参数，工具内部会自动选择正确的 CLI 形式。

### 自动检测的工作原理

1. 首先检查当前工作目录
2. 如果未找到，检查父目录
3. 如果仍未找到，扫描直接子目录（深度 2）
4. 如果恰好找到一个候选，自动使用
5. 如果找到多个，报告它们并让 LLM 通过 `path` 参数选择

## 工作流模式

### 调查新区域

```bash
codegraph status
codegraph explore "支付处理"
codegraph node PaymentService
codegraph callers PaymentService.process
```

### 重构函数之前

```bash
codegraph impact validateInput
codegraph callers validateInput
codegraph callees validateInput
```

### 查找相关测试文件

```bash
codegraph affected src/services/auth.ts
```

### 浏览项目结构

```bash
codegraph files --format tree --max-depth 4 --filter src/
codegraph query --kind class -l 20
```

## 后备方案

如果项目没有 `.codegraph` 目录，改为使用 `grep`、`find`、`ls` 和 `read`。
