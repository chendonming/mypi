---
name: skill-router
description: "强制 skill 路由规则。当你要将审查任务委托给 reviewer subagent 时，必须根据涉及的文件类型或技术栈，传递对应的语言/框架专项 review skill。"
---

# Skill 路由规则

> 这些规则在 `delegation-rules` 决定"必须使用 reviewer"之后生效。
> 它们负责决定"传递给 reviewer 的 language skill 是什么"。

## 规则：审查委托必须附带语言 skill

当用户要求审查代码、检查 diff、review PR 时：

**你必须：**
1. 识别涉及的文件类型（`.vue`、`.py`、`.go`、`.tsx`/`.jsx` 等）
2. 查阅下方的路由表，确定要传递的 skill
3. 调用 `subagent({ agent: "reviewer", skill: "<language-skill>" })`
4. 当混合文件类型时，优先使用 **匹配文件数量最多** 的那个 skill
5. 当单个文件包含框架代码时（如 `.vue` 含 TS），使用对应框架 skill（框架 skill 内部会覆盖语言专项）

**你不得：**
- 对 `.vue` 文件调用 reviewer 时不传 `vue-review`
- 对 `.py` 文件调用 reviewer 时不传 `python-review`
- 对 `.go` 文件调用 reviewer 时不传 `go-review`
- 对 `.tsx`/`.jsx` 文件调用 reviewer 时不传 `react-review`
- 尝试自己 inline 执行审查清单而不委托给 reviewer

## 路由表

| 文件类型 | 必须传递的 skill | 说明 |
|---------|-----------------|------|
| `.vue` | `vue-review` | 覆盖 Composition API、响应式、模板安全、SSR、Pinia/Router |
| `.py` | `python-review` | 覆盖 PEP 8、Pythonic 惯用法、类型安全、安全、并发 |
| `.go` | `go-review` | 覆盖 Go 惯用法、并发安全、错误处理、接口设计 |
| `.tsx` / `.jsx` (React) | `react-review` | 覆盖 hooks 规则、RSC 边界、状态管理、a11y、性能 |
| 纯 `.ts` / `.js`（无框架） | — | 不传递额外 skill，reviewer 自身足够 |

## 混合文件类型处理

当 diff 同时包含多种文件类型时：

| diff 内容 | 推荐做法 |
|-----------|---------|
| `.vue` + `.ts` | 使用 `vue-review`（它覆盖了 Vue + TS 场景） |
| `.tsx` + `.ts` | 使用 `react-review`（它覆盖了 React + TS 场景） |
| `.py` + `.json`/`.yaml` | 使用 `python-review`（配置文件的审查在 reviewer 职责内） |
| `.vue` + `.py` | **Parallel 模式**：两个 reviewer 并行运行 |
| 多种类型且分散 | 以核心业务代码（改动量最大的类型）为准 |

## Parallel 模式

当 diff 同时涉及多种框架/语言（如 Vue 前端 + Python 后端），且改动量都较大时：

```javascript
subagent({
  tasks: [
    { agent: "reviewer", task: "审查 Vue 前端改动", skill: "vue-review" },
    { agent: "reviewer", task: "审查 Python 后端改动", skill: "python-review" }
  ]
})
```

Parallel 模式下，每个 reviewer 独立汇报结果，父代理汇总最终报告。

## Fallback

未知技术栈或无法判断文件类型时：
- 仅使用 `reviewer` 自身
- **不要**猜测并传一个不相关的 skill
- 如果用户明确指定了语言，优先使用用户的指定

## 快速决策表

| 如果用户要求... | 你必须... |
|---|---|
| 审查 Vue 组件（.vue） | 调用 reviewer + skill: `"vue-review"` |
| 审查 Python 代码（.py） | 调用 reviewer + skill: `"python-review"` |
| 审查 Go 代码（.go） | 调用 reviewer + skill: `"go-review"` |
| 审查 React 组件（.tsx/.jsx） | 调用 reviewer + skill: `"react-review"` |
| 审查纯 TypeScript 代码 | 调用 reviewer（不传额外 skill） |
| 审查混合 Vue + Python 代码 | 调用 parallel reviewer + 各自 skill |
| 审查未知类型的代码 | 调用 reviewer（不传额外 skill） |

## 不做什么

- ❌ 不要为每个 skill 创建单独的 subagent（reviewer 统一代理所有语言，skill 只是注入审查清单）
- ❌ 不要尝试在父代理中自行运行审查清单
- ❌ 不要修改 reviewer agent 配置来硬编码 skill 注入
