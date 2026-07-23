---
name: init
description: Bootstrap or refresh a project's durable context file (PROJECT.md) — the concise, high-signal knowledge base folded into every future session. Use /init or /skill:init to analyze the codebase and produce a living project summary.
---

# Init

The user invoked `/init`: bootstrap (or refresh) this project's durable context file — a concise, high-signal `PROJECT.md` at the project root that captures what an agent needs to work effectively. This file is loaded into every future session via the `inheritProjectContext` convention, so **every line costs context** — keep it terse, specific, and actionable.

Also seed pi's persistent [memory system](#memories) with durable facts that survive even if the file evolves.

## Operation

### Step 1: Discover existing context

Check for an existing durable context file. List the project root and common filenames:

```bash
ls -la                      # project root listing
```

Look for these files (in priority order):
- `PROJECT.md` — pi's preferred context file name
- `AGENTS.md` — Reasonix / Claude Code convention
- `REASONIX.md` — Reasonix convention
- `CLAUDEMD` — Claude Code convention
- `.context.md` — generic markdown context

If one exists, **read it fully**, then **improve it in place** (fix stale facts, fill gaps, tighten prose) — write back to that same filename. Do **not** create a second file.

If no project context file exists, check whether pi's `inheritProjectContext` already references something:

```bash
cat .pi/settings.json 2>/dev/null | grep -i inheritProjectContext || true
```

### Step 2: Explore the codebase

Gather enough to be accurate — not exhaustive. Explore in parallel where possible:

1. **Project shape** — directory listing, manifest (`go.mod`, `package.json`, `pyproject.toml`, `Cargo.toml`, `composer.json`, `build.gradle`, etc.), README.

2. **Build / test / run / lint commands** — derive from the manifest + scripts (e.g., `npm run` scripts, Makefile targets, `go task`, `cargo` subcommands, `just` recipes). **Verify the exact command names by reading the files** — do not guess.

3. **Architecture** — the main packages/modules and how they fit; entry point(s). Read `main.go`, `src/index.ts`, `main.py`, `lib/`, `cmd/`, etc.

4. **Conventions** — formatting (formatter config: `.prettierrc`, `rustfmt.toml`, `go fmt`, `black`), naming, error handling, testing patterns. **Infer from real code** — read 2–5 representative files.

**Efficient exploration technique:** Use `subagent` with parallel `scout` tasks to explore different areas simultaneously:

```typescript
subagent({
  tasks: [
    { agent: "scout", task: "Explore project structure: list root, read manifest and README, find entry points" },
    { agent: "scout", task: "Discover build/test commands: read package.json scripts, Makefile, taskfile, Justfile, etc." },
    { agent: "scout", task: "Read 3-5 representative source files to infer conventions (error handling, naming, testing patterns, imports)" },
  ],
  concurrency: 3,
})
```

### Step 3: Write or update PROJECT.md

Write a file named `PROJECT.md` at the project root (unless an existing context file with another name was found — then update that file in place).

Structure (each section terse):

```markdown
# ProjectName

One-line description of the project.

## Project

What it is, the tech stack, where the entry point lives.

## Commands

```bash
# Build
<exact build command>

# Test
<exact test command>

# Run
<exact run command>

# Lint / Format
<exact lint command>
```

## Architecture

3–7 load-bearing modules/directories and their roles. Include file paths.

## Conventions

Only rules an agent must follow. Concrete patterns observed in the code (style, naming, error handling, testing, imports). Be specific — "Errors use Go-style `if err != nil`" not "handle errors properly".

## Notes

<!-- Empty stub for later quick-adds during development -->
```

**Rules:**
- Prefer specifics (file paths, exact command names) over prose.
- Verify every command against actual files before writing — a wrong build command is worse than none.
- Never fabricate conventions the code doesn't demonstrate.
- Never include secrets, credentials, or personal paths.
- A `<!-- comments -->` convention keeps Notes expandable without bloating the visible file.

### Step 4: Seed pi memory entries

After writing/updating `PROJECT.md`, create or update pi memory entries for the most durable facts — things that should survive even if `PROJECT.md` is lost or regenerated:

```typescript
// For each key fact, use memory_create or memory_update:
// - The project's tech stack and entry point
// - Critical build/test commands
// - Architectural decisions with reasoning
// - Known gotchas or workarounds (as type: "feedback")
```

This makes the knowledge searchable via `memory_search` and persistent across context resets.

### Step 5: Report

After writing, report in one or two lines:
- What was captured (commands, modules, conventions)
- The filename written
- How many memory entries were created/updated
- Ask the user to review and edit both `PROJECT.md` and the memories

## Trigger

This skill runs when the user says:
- `/init`
- `/skill:init`
- "initialize this project"
- "bootstrap project context"
- "create project memory"
- "set up this project"

## Notes

- `PROJECT.md` is pi's default durable context file. If you use `inheritProjectContext` in `settings.json`, point it to your `PROJECT.md` — it will be read at session start.
- Pi's memory system (`memory_create`, `memory_search`, etc.) complements the file — use both for maximum durability.
- When improving an existing file, preserve any content that remains accurate and relevant. Only rewrite sections that are stale, wrong, or missing.
- Prefer `edit` (targeted changes) over `write` (full rewrite) when updating an existing context file — it preserves the file's history and avoids unnecessary churn.
