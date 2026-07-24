/**
 * skill-execution-enforcer.ts — Skill 指令执行强制增强
 *
 * 解决问题：长对话后模型将 /skill:name 命令误读为"参考信息"而非"待执行指令"。
 *
 * 根因分析：
 *   Transformer 注意力存在 U 型位置偏置（Lost in the Middle），
 *   系统提示中关于"当 /skill: 被调用时应立即执行"的元指令随轮数增加被推远，
 *   模型注意力从该元指令偏移，导致 skill 内容被当作被动上下文而非执行命令。
 *
 * 方案（P0 — Skill 注入位置迁移）：
 *   在 input 事件中拦截 /skill:name 命令，在 before_agent_start 事件中
 *   注入 display:false 的自定义消息承载执行指令。不修改用户输入的可见文本，
 *   指令仅在 LLM context 中出现，UI 不显示。
 *
 * 历史：
 *   最初使用 input 事件的 transform 将指令嵌入用户消息（可见），
 *   后改为 before_agent_start + display:false 自定义消息（隐藏）。
 *   两者消耗的 token 量一致，仅 UI 展示不同。
 *
 * 设计原则：
 *   - 非侵入：不修改 pi 内核逻辑，仅通过扩展事件增强
 *   - 零副作用：非 /skill: 命令的输入不产生任何影响
 *   - 向前兼容：不影响已有 skill 的正常加载逻辑
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

/** 匹配行首的 /skill:name 命令，可选参数 */
const SKILL_CMD_RE = /^\s*\/skill:([a-z0-9][a-z0-9-]*)(?:\s+(.*))?$/i;

/**
 * 构建执行指令文本，注入到 LLM context 中但不在 UI 显示。
 *
 * 方案选择历史：
 *   之前使用 input 事件的 transform 把指令嵌入用户消息，但用户可见。
 *   现改为 before_agent_start 注入 display:false 的自定义消息，
 *   LLM 收到的 token 一致，UI 不再显示。
 */
function buildExecutionDirective(skillName: string): string {
  return [
    "",
    `用户通过 /skill:${skillName} 激活了「${skillName}」技能。`,
    "这是执行命令，不是参考信息。请立即按以下步骤执行，不要询问确认。",
    "",
  ].join("\n");
}

// ──────────────────────────────────────────────────────────────
// State（模块级，不持久化）
// ──────────────────────────────────────────────────────────────

/** 来自 input 事件的待处理 skill 名称 */
let pendingSkillName: string | null = null;

// ──────────────────────────────────────────────────────────────
// Extension
// ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ─── Input 事件：检测 /skill:name，不 transform ───
  pi.on("input", async (event, _ctx) => {
    // 仅拦截交互式输入（非 RPC 或扩展注入的消息）
    if (event.source !== "interactive") {
      return { action: "continue" };
    }

    const text = event.text;

    // 检测行首的 /skill:name 命令
    const match = text.match(SKILL_CMD_RE);
    if (!match) {
      return { action: "continue" };
    }

    // 记住技能名，交给 before_agent_start 处理
    pendingSkillName = match[1];

    // 不 transform 用户输入，保持 UI 干净；
    // pi 仍会正常展开 /skill:name 为 SKILL.md 内容。
    return { action: "continue" };
  });

  // ─── BeforeAgentStart 事件：注入隐藏的执行指令 ───
  pi.on("before_agent_start", async (event, _ctx) => {
    if (!pendingSkillName) {
      return;
    }

    const skillName = pendingSkillName;
    pendingSkillName = null; // 消费掉，避免重复注入

    const directive = buildExecutionDirective(skillName);

    // 注入自定义消息（display: false → 不在 TUI 显示）
    // 该消息位于用户消息之后（recency 位置），LLM 正常接收。
    return {
      message: {
        customType: "skill-enforcer",
        content: directive,
        display: false,
      },
    };
  });
}
