# Pi Memory System

一个持久化记忆系统扩展，让 AI 能跨会话记住项目重要信息。每次对话开始时，AI 自动加载记忆索引了解上下文，需要具体内容时按需读取完整记忆文件。

## 记忆的本质

每一条记忆是一篇**知识库文章**（Markdown 文件），而不是结构化 JSON。文章应完整讲述一个知识点：

```
上下文/问题描述    → 发生了什么？背景是什么？
关键结论           → 所以应该怎么做？（加粗强调）
Why               → 为什么会有这个结论？根本原因是什么？
How to apply      → 知道了然后呢？具体该怎么做？
```

### 典型范例

```markdown
---
name: java-files-encrypted-use-bash
title: Java 文件加密 — 用 bash 读取
description: 公司加密Java文件，read_file工具无法读取，必须用bash工具
metadata:
  type: project
---

公司环境对 Java 源文件（.java）进行了加密，导致 `read_file` 工具报告 "NUL byte detected" 无法读取内容。
但 bash 工具（如 `cat`、`python` 读取）可以绕过此限制正常读取。

**因此，在此项目中读取 Java 文件内容时，必须使用 bash 工具，而不是 `read_file` 工具。**

已验证可用的方式：
- `python -c "with open(path, 'r', encoding='utf-8') as f: print(f.read())"`
- `cat -v` 可读但中文会显示为 M- 转义序列

**Why:**
公司加密机制作用于文件系统层，`read_file` 直接读文件遇到 NUL 字节会拒绝显示，而 bash 进程可以正常解密读取。

**How to apply:**
- 每当需要读取 `.java` 文件时，使用 `bash` 工具，不要使用 `read_file`。
- 非 Java 文件（如 `.xml`, `.yml`, `.vue` 等）不受影响，仍可使用 `read_file`。
```

---

## 安装

将 `memory-system/` 目录放置到 Pi 的扩展加载路径中：

```
~/.pi/agent/extensions/memory-system/
├── index.ts       ← 扩展主程序
└── README.md      ← 本文档
```

放置后重启 Pi 或运行 `/reload` 即可生效。

> 扩展自动发现路径：`~/.pi/agent/extensions/*/index.ts`

---

## 文件结构

### 记忆存储目录（`~/.pi/memory/`）

```
~/.pi/memory/
├── projects/
│   └── {project-slug}/          ← 每个项目一个目录
│       ├── MEMORY.md             ← 项目记忆索引（AI 每次对话必读）
│       ├── zentao-deployment.md  ← 具体记忆文件
│       └── ...                   ← 更多记忆文件
└── user/
    ├── MEMORY.md                 ← 用户级记忆索引（跨项目）
    └── preferred-stack.md        ← 用户偏好记忆
```

项目 slug 由工作目录路径自动生成。例如 `E:\01_Projects\08_BimWinLODChunkMerge\bimwin-ui-vue` 会生成 slug `E--01_Projects--08_BimWinLODChunkMerge--bimwin-ui-vue`。

### 索引文件（`MEMORY.md`）

索引只保存条目的名称、描述和标签，不包含完整内容。AI 每次对话开始时只加载索引。

```markdown
# Memory Index

## project
- [zentao-deployment](zentao-deployment.md) — ZenTao 22.3 Docker 部署到 115.29.193.106:8082
  tags: devops, docker, zentao

## feedback
- [java-files-encrypted](java-files-encrypted.md) — Java 文件加密，必须用 bash 读取
  tags: java, encryption, workaround
```

### 记忆文件 Frontmatter

每条记忆文件以 YAML frontmatter 开头：

```yaml
---
name: zentao-deployment          # 唯一标识（kebab-case）
description: 禅道已部署到服务器    # 一行摘要
metadata:
  type: project                  # project | feedback
  tags: [devops, docker]         # 自由标签
  status: active                 # active | superseded | archived
  created_at: 2026-07-23
  originSessionId: session-xxx   # 来源会话 ID
---
```

**type 说明：**

| type | 含义 | 适用场景 |
|------|------|---------|
| `project` | 项目自身客观事实 | 架构、部署、配置、技术选型、约束条件 |
| `feedback` | 从交互中习得的模式 | 踩坑记录、用户偏好、workaround、经验教训 |

---

## 用户使用方式

### 方式一：直接对 AI 说（推荐）

在对话中说出需要记住的信息，AI 会自动判断并调用 `memory_create`：

```
记住我叫小民
记一下服务器地址是 115.29.193.106:8082
别忘了 Java 文件要用 bash 读
这个项目用 Vue 2.6 + Vue CLI 4
```

AI 会**总结提炼你的话**，按知识库文章格式创建记忆。

### 方式二：手动命令

```
/memory                            → 查看记忆摘要
/memory save                       → 保存当前对话为记忆
/memory add 我叫小民                → 快速记一条
/memory add --user 我习惯用 yarn    → 记为用户级（跨项目）
/memory search 部署                 → 搜索关键词
/memory open zentao-deployment     → 查看完整内容
/memory clear                      → 清除项目所有记忆
```

---

## AI 工具

扩展向 AI 注册了 6 个工具：

| 工具 | 用途 | AI 触发时机 |
|------|------|-------------|
| `memory_read` | 读取完整的记忆内容 | 索引中看到相关条目，需要详细了解时 |
| `memory_create` | 创建新记忆 | 用户说了值得记住的信息时 |
| `memory_create_from_session` | **保存当前对话为记忆** | 用户说"把刚才的讨论记下来"时 |
| `memory_update` | 更新已有记忆 | 信息过时、需要补充或修正时 |
| `memory_delete` | 删除记忆 | 信息不再需要时 |
| `memory_search` | 全文搜索 | 不确定条目名，需要模糊查找时 |

---

## 扩展实现原理

扩展代码结构（`index.ts`）：

```
index.ts
├── 存储层 (Storage Helpers)
│   ├── 路径解析 — 工作目录 → 项目 slug
│   ├── Frontmatter 解析 — YAML 解析（零依赖）
│   ├── 记忆文件读写 — readMemoryFile / writeMemoryFile / deleteMemoryFile
│   ├── 索引文件读写 — readOrInitIndex / saveIndex / parseIndex / buildIndex
│   └── 全文搜索 — searchInDir
├── 事件钩子
│   ├── session_start       → 确保存储目录就绪
│   └── before_agent_start  → 注入记忆指南 + 索引到 system prompt
├── LLM 工具 (6 个)
│   ├── memory_read                  → 按名称读取记忆文件
│   ├── memory_create                → 创建 + 更新索引
│   ├── memory_create_from_session   → 保存当前对话为记忆
│   ├── memory_update                → 更新内容 + 索引
│   ├── memory_delete                → 删除文件 + 索引
│   └── memory_search                → 全文搜索返回摘要
└── 用户命令
    └── /memory              → 摘要 / add / search / open / clear
```

### 扩展如何影响 AI 行为

`before_agent_start` 事件在每次 AI 开始处理前触发，扩展在此事件中向 system prompt 追加两段内容：

1. **记忆创建指南** — 告诉 AI 什么是好的记忆、如何结构化内容、何时创建/更新/搜索
2. **当前记忆索引** — 列出所有已存在的记忆条目（仅名称+描述+标签），AI 据此决定是否需要 `memory_read`

### 关于 type 的自动判断

AI 调用 `memory_create` 时自行决定 type（project 或 feedback），不在代码层硬编码规则。`/memory add` 命令默认保存为 `project`，AI 之后可通过 `memory_update` 调整。

---

## 生命周期管理

| 操作 | 触发方式 |
|------|---------|
| 创建 | AI 调用 `memory_create` 或用户 `/memory add` |
| 更新 | AI 调用 `memory_update` |
| 标记废弃 | AI 将 status 改为 `superseded` 或 `archived` |
| 删除 | AI 调用 `memory_delete` 或用户 `/memory clear` |

---

## 与其他系统的关系

本扩展受 Claude Code 的 memory.json 启发，但设计上做了几项关键取舍：

| 方面 | 本系统 | Claude Code 方式 |
|------|--------|-----------------|
| 存储格式 | Markdown 文件（人类可读可编辑） | JSON 文件 |
| 加载策略 | 索引入 context，具体文件按需读 | 全部加载 |
| 知识结构 | 知识库文章格式（自然叙事） | 结构化字段 |
| 类型系统 | 仅 project / feedback | 无明确分类 |
| 编辑器友好 | 可用任何编辑器直接修改 .md | 需通过工具修改 |
