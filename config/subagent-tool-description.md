# Subagent Tool — Intent-to-Agent Mapping

Delegate work to specialized subagents. **The key question is: which agent fits the user's intent?**

## When to delegate — quick guide

Delegate to a subagent when the user's request:
- Involves exploring an unfamiliar codebase → **scout**
- Requires web research or external evidence → **researcher**
- Asks for a plan before implementing → **planner**
- Is a well-defined implementation task → **worker** or **delegate**
- Needs code review, diff review, or validation → **reviewer**
- Is about checking for design drift or architectural consistency → **oracle**
- Requires building structured context for handoff → **context-builder**

When the task is large, consider chaining: scout → planner → worker, or researcher → planner → worker.

---

## Agent reference

| Intent pattern | Agent | Why |
|---|---|---|
| "探索此仓库", "explore this repo", "了解项目结构", "帮我看看这个项目", "find the entry points", "map out the codebase" | **scout** | Fast read-only codebase recon, returns compressed context. Minimal token cost. |
| "搜索网络", "research X", "查一下这个库的文档", "what does the docs say", "find best practices for" | **researcher** | Web research specialist with web_search/fetch_content tools. Returns focused brief. |
| "做个计划", "plan the implementation", "设计方案", "how should I approach", "what's the architecture" | **planner** | Creates structured implementation plans from context. Forked context (sees parent's discussion). |
| "实现这个功能", "implement X", "写代码", "添加测试", "fix this bug", "refactor" | **worker** | Full tool access (read, grep, bash, edit, write). Best for solo implementation tasks. |
| "review 这段代码", "code review", "帮我审查", "检查这个 diff", "validate this", "找 bug" | **reviewer** | Versatile review specialist. Can review code, plans, PRs. Has write access for fixes. |
| "检查决策一致性", "有没有 drift", "oracle review", "validate my direction" | **oracle** | High-context fork-based advisor. Checks for architectural drift and hidden decisions. |
| "构建上下文", "分析需求和代码", "build handoff context" | **context-builder** | Reads requirements + codebase, produces structured handoff material. |
| "做个简单任务", "帮我跑个命令", "查个文件", light generic work | **delegate** | Lightweight, inherits parent's model, no default reads. Appends to system prompt. |

---

## Quick scenarios

| User says | Recommended action |
|---|---|
| "探索下这个仓库" | `subagent({ agent: "scout", task: "探索此仓库，关注..." })` |
| "研究一下 XXX 库的用法" | `subagent({ agent: "researcher", task: "研究 XXX..." })` or chain |
| "帮我做个计划，然后实现" | Chain: `scout` → `planner` → `worker` |
| "review 我当前的改动" | `subagent({ agent: "reviewer", task: "Review current diff..." })` |
| "这个方案有没有问题" | `subagent({ agent: "oracle", task: "Review this direction..." })` |
| 复杂功能开发 | Chain: `scout` → `planner` → `worker`, then `reviewer` |
| "帮我把这个功能实现了" | `subagent({ agent: "worker", task: "Implement..." })` |

---

## Execution modes

- **Single agent**: one agent, one task. Best for focused work.
- **Chain**: sequential pipeline where each step feeds the next. Best for multi-phase work.
- **Parallel**: concurrent non-conflicting tasks. Best for broad exploration or review fanout.
- **Async** (`async: true`): run in background. Return control to user; Pi will notify on completion.

---

## Builtin chains (pre-defined workflows)

These chains encode common multi-step patterns. Use them when the task fits:

| Chain | Pattern | Use when |
|---|---|---|
| `/parallel-review` | 2-3 fresh reviewers, then synthesis | Need adversarial review of a diff/plan |
| `/review-loop` | worker → reviewer → fix → reviewer → ... | Implementation needs review rounds until clean |
| `/parallel-research` | researcher + scout | Need both external evidence + local code context |
| `/gather-context-and-clarify` | scout/research first, then interview user | Task is vague; need to ask clarifying questions |
| `/parallel-context-build` | 2-3 context-builder agents | Need strong handoff material before planning |
| `/parallel-handoff-plan` | research + context-builder → synthesis plan | Study external library + local code, then produce worker prompt |

---

{{fullDescription}}
