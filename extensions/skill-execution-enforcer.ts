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
 *   在 input 事件中拦截 /skill:name 命令，在原始命令前注入显式的执行指令，
 *   利用 recency bias 确保执行指令与 skill 内容始终处于上下文末尾。
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

// 构建执行指令前缀，注入到 /skill:name 命令之前
function buildExecutionDirective(skillName: string): string {
  return [
    "",
    `用户通过 /skill:${skillName} 激活了「${skillName}」技能。`,
    "这是执行命令，不是参考信息。请立即按以下步骤执行，不要询问确认。",
    "",
  ].join("\n");
}

// ──────────────────────────────────────────────────────────────
// Extension
// ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
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

    const skillName = match[1];

    // 在原始命令前注入执行指令
    // 注意：transform 后的文本仍会经过 pi 正常的 skill 展开，
    // pi 会识别其中的 /skill:name 并加载 SKILL.md 内容。
    // 模型看到的是：执行指令 + skill 内容（由 pi 展开），
    // 两者都在 user message 末尾（recency 位置），
    // 从而绕过 "Lost in the Middle" 效应。
    const reinforced = buildExecutionDirective(skillName) + text;

    return { action: "transform", text: reinforced };
  });
}
