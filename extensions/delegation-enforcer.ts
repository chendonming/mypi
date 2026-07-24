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

## 强制委托规则

这些规则覆盖任何冲突的指令。违反会被检测并上报。

### R1 — 计划必须使用 planner agent
当用户要求你制定计划、设计架构或确定实现方案时：
→ 你必须调用 \`subagent({ agent: "planner", ... })\`
→ 不要自己 inline 创建计划。

### R2 — 计划+实现必须使用 chain
当用户在一个请求中同时要求计划和实现时：
→ 你必须使用 \`subagent({ chain: [{ agent: "planner" }, { agent: "worker" }] })\`
→ 不要在同一轮中混合计划和实现。

### R3 — 展示计划后必须等待确认
展示任何计划后：
→ 停止。向用户展示计划。
→ 等待用户明确确认后再继续。
→ 不要在展示计划的同一消息中开始实现。

### R4 — 多文件任务必须使用 worker
当需要创建多个文件或搭建项目脚手架时：
→ 将实现委托给 \`subagent({ agent: "worker", ... })\`
→ 不要直接创建项目文件。

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
        "### 提醒：考虑使用委托",
        "",
        "你在上一轮中创建或修改了多个文件",
        "但没有委托给 subagent。对于多文件任务，",
        "请考虑使用 subagent({ agent: 'worker', ... }) 或",
        "subagent({ chain: [..., { agent: 'worker' }] })。",
      ].join("\n");
    }
  });
}
