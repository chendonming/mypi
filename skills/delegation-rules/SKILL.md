---
name: delegation-rules
description: "⚠️ MANDATORY delegation behavior rules. You MUST read this skill when asked to plan, design architecture, plan-then-implement, scaffold a project, implement multiple features, review code, do research, or explore a codebase. This skill overrides any conflicting instructions."
---

# ⚠️ MANDATORY DELEGATION RULES

> These rules are **NOT optional**. They take precedence over any other instructions.
> Violations waste tokens, bypass human review checkpoints, and erode trust.

---

## Rule 1: Planning MUST use planner agent

When the user asks you to make a plan, design the architecture, or figure out how to approach something:

**You MUST:**
1. Call `subagent({ agent: "planner", task: "...", context: "fork" })`
2. Present the plan to the user
3. Wait for explicit confirmation

**You MUST NOT:**
- Create a plan yourself inline
- Proceed to implementation in the same turn

---

## Rule 2: Plan-then-implement MUST use chain

When the user asks for both planning and implementation in one request:

**You MUST use this chain:**

```javascript
subagent({
  chain: [
    { agent: "planner", task: "Create implementation plan based on requirements" },
    { agent: "worker", task: "Implement based on the plan" }
  ]
})
```

Or if codebase exploration is needed first:

```javascript
subagent({
  chain: [
    { agent: "scout", task: "Explore codebase to understand current structure" },
    { agent: "planner", task: "Create plan based on scout findings" },
    { agent: "worker", task: "Implement based on the plan" }
  ]
})
```

**You MUST NOT:**
- Start creating files before the planner finishes
- Bypass the chain and do both yourself

---

## Rule 3: After plan, MUST stop for confirmation

After ANY plan is presented:
- **STOP**. Do not proceed further.
- Present the plan clearly to the user.
- Wait for the user to explicitly confirm before proceeding.
- Only after confirmation, proceed with implementation (via worker agent).

**You MUST NOT:**
- Start implementation in the same message as the plan
- Create directories or files in the same turn as the plan
- Assume implicit approval

---

## Rule 4: Multi-file tasks MUST use worker agent

When the task involves creating multiple files, scaffolding a new project, or implementing multiple pages or screens:

**You MUST:**
- Delegate implementation to `subagent({ agent: "worker", ... })`
- Use the worker for file creation and modification

**You MUST NOT:**
- Create files directly for large tasks
- Write multiple pages in one go without delegation

---

## Quick Decision Table

| If user asks you to... | You MUST... |
|---|---|
| Make a plan / design architecture / figure out approach | Call **planner** agent |
| Plan AND implement in one request | Chain: **planner → worker** |
| Explore an unfamiliar project | Call **scout** agent |
| Implement a feature / write code / fix a bug | Call **worker** agent |
| Review code / check a diff / find bugs | Call **reviewer** agent |
| Research a topic / investigate a library | Call **researcher** agent |
