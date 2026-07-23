/**
 * delegation-enforcer.ts — Mandatory delegation rules enforcement
 *
 * Implements two harness engineering primitives:
 *
 * 1. Feedforward (before_agent_start)
 *    Injects the delegation rules into the system prompt every turn,
 *    ensuring the LLM always has them in context regardless of which
 *    tools it considers using.
 *
 * 2. Feedback (message_end)
 *    After each assistant turn, checks whether the LLM created or
 *    modified multiple files without having delegated to a subagent.
 *    If so, it injects a reminder into the next system prompt to
 *    reinforce the rule.
 *
 * Design principles:
 *   - No hardcoded keyword matching. The LLM understands natural
 *     language — we just ensure the rules are visible and enforced.
 *   - Behavioral detection is minimal and conservative: only flag
 *     high-confidence patterns (3+ file writes in one turn with no
 *     subagent use at all).
 *   - The primary mechanism is feedforward (rules in context).
 *     Feedback is secondary and informational.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ──────────────────────────────────────────────────────────────
// State
// ──────────────────────────────────────────────────────────────

interface TurnState {
  /** Number of subagent tools called this turn */
  subagentCalls: number;
  /** Number of write/edit calls this turn */
  fileWriteCalls: number;
}

function newTurnState(): TurnState {
  return { subagentCalls: 0, fileWriteCalls: 0 };
}

// ──────────────────────────────────────────────────────────────
// System prompt rules (injected every turn)
// ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT_RULES = `

## ⚠️ MANDATORY DELEGATION RULES

These rules override any conflicting instructions.

### R1 — Planning MUST use planner agent
When the user asks you to make a plan, design architecture, or figure out an approach:
→ You MUST call \`subagent({ agent: "planner", ... })\`
→ Do NOT create a plan yourself inline.

### R2 — Plan-then-implement MUST use chain
When the user asks for both planning and implementation in one request:
→ You MUST use \`subagent({ chain: [{ agent: "planner" }, { agent: "worker" }] })\`
→ Do NOT combine plan + implementation in the same turn.

### R3 — After presenting a plan, MUST wait for confirmation
After presenting ANY plan:
→ STOP. Present it to the user.
→ Wait for explicit confirmation before proceeding.
→ Do NOT start implementation in the same message as the plan.

### R4 — Multi-file tasks MUST use worker
When creating multiple files or scaffolding a project:
→ Delegate implementation to \`subagent({ agent: "worker", ... })\`
→ Do NOT create project files directly.

`;

// ──────────────────────────────────────────────────────────────
// Extension entry point
// ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  let turn = newTurnState();
  let feedbackNote = "";

  // ── before_agent_start ─────────────────────────────────────
  // 1. Reset per-turn state.
  // 2. Inject mandatory rules into the system prompt.
  pi.on("before_agent_start", (event, _ctx) => {
    turn = newTurnState();

    // eslint-disable-next-line no-param-reassign
    event.systemPrompt += SYSTEM_PROMPT_RULES;

    // If a feedback note was queued from a previous turn, append it
    if (feedbackNote) {
      // eslint-disable-next-line no-param-reassign
      event.systemPrompt += `\n\n${feedbackNote}`;
      feedbackNote = "";
    }
  });

  // ── tool_call ──────────────────────────────────────────────
  // Track calls for behavioral analysis.
  pi.on("tool_call", (event, _ctx) => {
    // Track subagent delegation calls
    if (event.toolName === "subagent") {
      turn.subagentCalls++;
      return;
    }

    // Track file writes/edits — threshold-based detection
    if (event.toolName === "write" || event.toolName === "edit") {
      turn.fileWriteCalls++;
    }
  });

  // ── message_end ────────────────────────────────────────────
  // After each assistant message, check if the LLM created many
  // files without delegating. Queue a reminder if so.
  pi.on("message_end", (event, _ctx) => {
    if (event.message.role !== "assistant") return;

    // High-confidence heuristic: 3+ file writes without a single
    // subagent call suggests the LLM is doing project work that
    // should have been delegated.
    if (turn.fileWriteCalls >= 3 && turn.subagentCalls === 0) {
      feedbackNote = [
        "### ℹ️ Reminder: Consider delegation",
        "",
        "You created or modified several files in the previous turn",
        "without delegating to a subagent. For multi-file tasks,",
        "consider using subagent({ agent: 'worker', ... }) or",
        "subagent({ chain: [..., { agent: 'worker' }] }).",
      ].join("\n");
    }
  });
}
