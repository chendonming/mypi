---
name: grilling
description: Stress-test a plan, decision, or idea by gathering facts from the environment via parallel subagents, then interviewing the user one question at a time. Use when the user says "grill me", "stress-test this", "challenge my thinking", or any variant.
---

# Grilling

When the user wants to be grilled about a plan, decision, or idea:

1. **Understand the scope** — identify the subject being grilled (a plan, decision, architecture choice, feature design, etc.)
2. **Launch parallel async subagents** to gather facts from the environment (codebase, docs, config, etc.)
3. **Wait for ALL subagents to finish** using `subagent_wait({ all: true })`
4. **Interview the user** one question at a time, informed by the gathered context
5. **Do not act** until the user confirms shared understanding

## Step 1: Identify the subject

Extract what the user wants grilled. Ask for clarification only if the subject is genuinely ambiguous; otherwise proceed.

## Step 2: Launch parallel subagents

Use `subagent()` with `async: true` to launch fact-gathering subagents in parallel. At minimum, launch a `scout` to explore the codebase/configuration relevant to the subject.

```typescript
// Detect the user's language from conversation context
const userLang = "Chinese" // ← infer from user's messages, e.g. "Chinese" if user writes in Chinese

// Launch context gatherers
const grillRun = subagent({
  tasks: [
    {
      agent: "scout",
      task: `Explore the codebase for everything relevant to: ${subject}. 
      
      Look at:
      - Relevant source files, imports, and dependencies
      - Configuration files
      - Tests and test patterns
      - Documentation and comments
      - Any existing issues or TODOs
      
      Return a structured summary of findings: what exists, what patterns are used, what constraints are present, and what's missing or unclear.
      
      Write your report in ${userLang}.`,
      output: "grill-context/scout-findings.md",
      outputMode: "file-only",
      progress: true
    }
  ],
  concurrency: 2,
  async: true,
  context: "fresh"
})
```

Adjust the subagents depending on the subject:

- **Architecture/design decisions**: Always include `scout` for local codebase context
- **Security-sensitive**: Add a `reviewer`-style agent focused on security implications
- **Simple code-level decisions**: Only `scout` may be sufficient

## Step 3: Wait for all subagents to finish

**This is the critical step.** Do NOT proceed to asking questions until all parallel subagents have completed. Use `subagent_wait({ all: true })` to block until every async task finishes.

```typescript
// Wait for ALL subagents to complete before asking any questions
const results = subagent_wait({ all: true })
```

If you launched subagents with `grillRun` above, `subagent_wait({ all: true })` ensures you have collected all findings before starting the interview.

> **Why `{ all: true }`?** The skill must not ask the user a question that the subagents could have answered by exploring the environment. Using `{ all: true }` guarantees every fact-gathering task has completed before the first question is asked. Using just `subagent_wait()` (which returns on the *first* completion) would risk asking the user something a still-running subagent already knows.

## Step 4: Interview the user one question at a time

Read the gathered findings (read the output files from the chain directory), then interview the user:

- Walk down each branch of the decision tree
- Resolve dependencies between decisions one-by-one
- **Ask ONE question at a time** — asking multiple at once is bewildering
- **For each question, provide your recommended answer** based on the gathered facts
- If a *fact* can be found by further exploring the environment, look it up rather than asking
- Only the *decisions* are the user's to make
- **Use the same language as the user** — if the user speaks Chinese, conduct the entire interview in Chinese. Match the user's language throughout.

### Question format

For each question, structure it as:

```
## Question N: [Topic]

**Context:** [What the subagents found that's relevant to this question]

**My recommendation:** [Based on best practices and codebase context]

**Question:** [Single clear question for the user]
```

> **Language tip:** The subagents may return reports in English, but you should translate the findings into the user's language when presenting them. Always match the user's language.

## Step 5: Don't act until shared understanding

Do not implement, change, or commit anything until the user explicitly confirms they have reached a shared understanding. The goal is stress-testing, not execution.

## Full workflow example

```typescript
// 1. Identify subject
const subject = "migrating the auth module from JWT to session-based auth"

// 2. Launch parallel fact gatherers
const grillRun = subagent({
  tasks: [
    { agent: "scout", task: `Explore the codebase for everything relevant to: ${subject}. ...`, output: "grill-context/scout-findings.md", outputMode: "file-only", progress: true }
  ],
  concurrency: 2,
  async: true,
  context: "fresh"
})

// 3. Wait for ALL to complete before asking anything
subagent_wait({ all: true })

// 4. Read findings
// (use read tool on the output files from the chain directory)

// 5. Interview one question at a time with recommendations
```

## Notes

- The subagents are read-only; they will not modify any files
- Use `outputMode: "file-only"` so results are saved to files without bloating the conversation
- After `subagent_wait({ all: true })`, read the output files from the chain artifacts directory to get the full context before asking questions
- The chain directory path is reported in the subagent launch result — look for the artifact directory
