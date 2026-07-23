# ⚠️ MANDATORY RULES — You MUST follow these

These rules are NOT optional. Violations will be detected and reported.

---

## Rule 1: Planning MUST be delegated

When the user asks you to create a plan, design an architecture, or figure out how to approach a task:
You MUST delegate to `subagent({ agent: "planner", ... })`.
**Do NOT** attempt to create a plan yourself inline.

---

## Rule 2: Plan-then-implement MUST use chain

When the user asks for both planning and implementation together (e.g., "先做计划然后实现", "plan and implement"):
You MUST use a chain:
`chain: [{ agent: "scout" }, { agent: "planner" }, { agent: "worker" }]`

Or if exploration is not needed:
`chain: [{ agent: "planner" }, { agent: "worker" }]`

**Do NOT** implement the plan yourself inline.
**Do NOT** combine plan + implementation in the same agent turn.

---

## Rule 3: After presenting a plan, MUST wait for user confirmation

After ANY plan is presented (whether by you or by planner agent):
- You MUST stop and present the plan to the user
- You MUST wait for the user to explicitly confirm before proceeding
- **Do NOT** start writing files, creating directories, or executing implementation
- **Do NOT** say "starting implementation" or equivalent in the same message as the plan

Wait for signals like user saying "go ahead", "proceed", "looks good", "开始", "可以", etc.

---

## Rule 4: Complex tasks MUST use delegation

When the task involves creating multiple files, scaffolding a new project, or implementing multiple pages:
You MUST delegate to worker agent(s) for the actual file creation.
**Do NOT** create multiple project files directly yourself.

---

## Quick reference table

| When the user asks you to... | You MUST delegate to... |
|---|---|
| Explore an unfamiliar codebase | **scout** |
| Do web research or investigate a library | **researcher** |
| **Make a plan, design architecture, figure out approach** | **planner** |
| **Plan AND implement in one go** | **chain: scout → planner → worker** (or planner → worker) |
| Implement a specific feature, write code, fix a bug | **worker** |
| Review code, find bugs, check a diff | **reviewer** |
| Check for architectural drift or decision consistency | **oracle** |
| Build context for a handoff | **context-builder** |

---

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
| Exploring an unfamiliar codebase | **scout** | Fast read-only codebase recon, returns compressed context. Minimal token cost. |
| Web research, library documentation | **researcher** | Web research specialist with web_search/fetch_content tools. Returns focused brief. |
| **Planning, architecture design, figuring out approach** | **planner** | Creates structured implementation plans from context. Forked context (sees parent's discussion). |
| Implementing a feature, writing code, fixing bugs | **worker** | Full tool access (read, grep, bash, edit, write). Best for solo implementation tasks. |
| Code review, diff review, finding bugs | **reviewer** | Versatile review specialist. Can review code, plans, PRs. Has write access for fixes. |
| Checking decision consistency, architectural drift | **oracle** | High-context fork-based advisor. Checks for architectural drift and hidden decisions. |
| Building context for handoff | **context-builder** | Reads requirements + codebase, produces structured handoff material. |
| Simple tasks, running commands, checking files | **delegate** | Lightweight, inherits parent's model, no default reads. Appends to system prompt. |

---

## Quick scenarios

| User says | Recommended action |
|---|---|
| "探索下这个仓库" | `subagent({ agent: "scout", task: "探索此仓库，关注..." })` |
| "研究一下 XXX 库的用法" | `subagent({ agent: "researcher", task: "研究 XXX..." })` or chain |
| **"帮我做个计划，然后实现"** | **Chain: `scout` → `planner` → `worker`** |
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
