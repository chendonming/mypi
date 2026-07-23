---
name: codegraph
description: Pre-built code intelligence for any codebase — search symbols, trace callers/callees, explore areas, analyze impact, list file structure. Use for codebase navigation and dependency analysis.
---

# CodeGraph

[CodeGraph](https://codegraph.sh) builds a searchable index of your codebase and provides a CLI for fast, targeted exploration. Works with any language.

## Prerequisites

- `codegraph` CLI installed (`which codegraph`)
- Project has a `.codegraph` directory (run `codegraph init` if missing)
- The extension's `codegraph` tool auto-detects `.codegraph` in:
  - Current working directory
  - Parent directory (pi opened inside a project subfolder)
  - Immediate subdirectories (multi-project workspace)
- When multiple .codegraph indexes exist, use `-p <subdir>` to target one

## Quick Start

```bash
# Check if index is ready
codegraph status

# Explore an area (one shot — symbols + source + call paths)
codegraph explore "user authentication flow"

# Search for a symbol
codegraph query sendEmail -k function

# See a symbol's full source + caller/callee trail
codegraph node SessionManager

# Trace dependencies
codegraph callers authenticateUser
codegraph callees authenticateUser

# Analyze change impact before refactoring
codegraph impact validateToken

# List project structure
codegraph files --format tree --max-depth 3
```

## Command Reference

### `codegraph status [path]`

Check index status and statistics.

| Option | Description |
|--------|-------------|
| `-j` | JSON output |

### `codegraph explore <query...>`

One-shot exploration: relevant symbols' source + call paths.

| Option | Description |
|--------|-------------|
| `-p <path>` | Project path |
| `--max-files <n>` | Max files to include source from |

Use this as your **default first command** when investigating an unfamiliar area.

### `codegraph query <search>`

Search for symbols in the codebase.

| Option | Description |
|--------|-------------|
| `-k <kind>` | Filter by kind: `function`, `class`, `interface`, `method`, `variable`, `type`, `enum` |
| `-l <n>` | Max results (default: 10) |
| `-p <path>` | Project path |
| `-j` | JSON output |

### `codegraph node [name]`

One symbol's source + caller/callee trail. Also reads a file with line numbers and dependent info.

| Option | Description |
|--------|-------------|
| `-f <file>` | Treat as file mode (or disambiguate a symbol to this file) |
| `--offset <n>` | File mode: 1-based start line |
| `--limit <n>` | File mode: max lines |
| `--symbols-only` | File mode: just symbol map + dependents |
| `-p <path>` | Project path |

### `codegraph callers <symbol>`

Find all functions/methods that call a specific symbol.

| Option | Description |
|--------|-------------|
| `-l <n>` | Max results (default: 20) |
| `-p <path>` | Project path |
| `-j` | JSON output |

### `codegraph callees <symbol>`

Find all functions/methods that a specific symbol calls.

| Option | Description |
|--------|-------------|
| `-l <n>` | Max results (default: 20) |
| `-p <path>` | Project path |
| `-j` | JSON output |

### `codegraph impact <symbol>`

Analyze what code is affected by changing a symbol.

| Option | Description |
|--------|-------------|
| `-d <n>` | Traversal depth (default: 2) |
| `-p <path>` | Project path |
| `-j` | JSON output |

Run this **before refactoring** to understand blast radius.

### `codegraph affected [files...]`

Find test files affected by changed source files.

| Option | Description |
|--------|-------------|
| `--stdin` | Read file list from stdin (one per line) |
| `-d <n>` | Max dependency traversal depth (default: 5) |
| `-f <glob>` | Custom glob filter for test files (e.g. `"e2e/*.spec.ts"`) |
| `-p <path>` | Project path |
| `-j` | JSON output |
| `-q` | Only output file paths, no decoration |

### `codegraph files`

Show project file structure from the index.

| Option | Description |
|--------|-------------|
| `--format <fmt>` | Output format: `tree`, `flat`, `grouped` (default: tree) |
| `--max-depth <n>` | Max directory depth for tree format |
| `--filter <dir>` | Filter to files under this directory |
| `--pattern <glob>` | Filter files by glob pattern |
| `--no-metadata` | Hide file metadata (language, symbol count) |
| `-p <path>` | Project path |
| `-j` | JSON output |

## Multi-Project Workspaces

When pi is opened at a parent directory containing multiple sub-projects, each
with their own `.codegraph`:

```
root/                      ← pi opened here
├── frontend/
│   └── .codegraph         ← codegraph init'd
└── backend/
    └── .codegraph         ← codegraph init'd
```

The `codegraph` tool auto-scans for `.codegraph` in subdirectories.
If exactly one is found, it is used automatically.
If multiple are found, the tool returns a hint listing all available indexes
and the LLM should retry with the `-p` parameter:

```
# Target frontend project
codegraph  command:status  path:"frontend"

# Target backend project
codegraph  command:query  query:"AuthService"  path:"backend"
```

### How auto-detection works

1. Check the current working directory first
2. If not found, check the parent directory
3. If still not found, scan immediate subdirectories (depth 2)
4. If exactly one candidate is found, use it automatically
5. If multiple are found, report them and let the LLM pick via `-p`

## Workflow Patterns

### Investigating a new area

```bash
codegraph status
codegraph explore "payment processing"
codegraph node PaymentService
codegraph callers PaymentService.process
```

### Before refactoring a function

```bash
codegraph impact validateInput
codegraph callers validateInput
codegraph callees validateInput
```

### Finding related test files

```bash
codegraph affected src/services/auth.ts
```

### Browsing project structure

```bash
codegraph files --format tree --max-depth 4 --filter src/
codegraph query --kind class -l 20
```

## Fallback

If the project does not have a `.codegraph` directory, use `grep`, `find`, `ls`, and `read` instead.
