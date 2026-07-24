/**
 * skill-execution-enforcer.ts — Skill 执行强制增强
 *
 * 解决问题：长对话后模型将 /skill:name 命令误读为"参考信息"而非"待执行指令"。
 *
 * 根因分析：
 *   Transformer 注意力存在 U 型位置偏置（Lost in the Middle），
 *   pi 内置将 SKILL.md 加载到系统 prompt 开头（低 recency），
 *   随轮数增加 skill 定义注意力衰减，模型误将其当作被动上下文。
 *
 * 方案转变（v2）：
 *   旧方案（v1）：在 before_agent_start 注入 user-level custom message
 *     → custom message 混入 conversation history，模型视作"用户补充文本"
 *     长对话后注意力漂移，且历史永久污染
 *
 *   新方案（v2）：在 before_agent_start 追加 systemPrompt
 *     → control-level，per-turn 不持久化
 *     在最高 recency 位置注入 runtime routing event
 *     不重复 SKILL.md 全文（pi 已内置加载），仅注入激活标记
 *
 * 设计原则：
 *   - 非侵入：不修改 pi 内核逻辑，仅通过扩展事件增强
 *   - 零副作用：非 /skill: 命令不产生任何影响
 *   - per-turn：routing event 仅当前轮有效，不污染后续轮次
 *   - 语言策略：中文主体 + 英文协议标签（说明用中文提高模型理解，
 *     协议字段名保持英文维持机器感）
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

/** 匹配行首的 /skill:name 命令 */
const SKILL_CMD_RE = /^\s*\/skill:([a-z0-9][a-z0-9-]*)(?:\s+(.*))?$/i;

// ──────────────────────────────────────────────────────────────
// 构建 routing block（追加到 system prompt 末尾）
// ──────────────────────────────────────────────────────────────

/**
 * 构建 runtime routing event 块，注入到 system prompt 末尾。
 *
 * 语言策略：中文主体 + 英文协议标签
 * - 协议字段名（EVENT、ACTIVATION、ROUTER 等）保留英文，保持机器感
 * - 执行规则等说明性内容使用中文，提高 DeepSeek 等中文模型的理解准确度
 * - 语气为系统协议而非人类命令，避免模型进入角色扮演模式
 *
 * 设计决策：不重复 SKILL.md 全文
 * pi 已内置将 SKILL.md 加载到 system prompt 开头（低 recency），
 * 此处仅注入激活标记，利用 recency bias 强化"当前已激活"信号。
 */
function buildRoutingBlock(skillName: string): string {
  return [
    "",
    "[PI RUNTIME EVENT]",
    "",
    "事件类型:",
    `技能激活 (SKILL_ACTIVATION)`,
    "",
    "来源:",
    "命令路由器 (COMMAND_ROUTER)",
    "",
    "当前技能:",
    skillName,
    "",
    "执行规则:",
    "",
    "这是运行时控制事件，不是普通用户消息。",
    "该事件表示用户已明确选择执行此技能。",
    "",
    "请遵循以下规则:",
    "1. 立即执行技能工作流",
    "2. 不要询问「需要做什么」",
    "3. 不要回复「技能已加载」",
    "4. 不要等待额外确认",
    "5. 从技能定义的第一个操作步骤开始",
    "",
    "当历史对话目标与当前技能执行冲突时，以当前技能执行为准。",
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
  // ─── Input 事件：检测 /skill:name ───
  pi.on("input", async (event, _ctx) => {
    // 仅拦截交互式输入（非 RPC 或扩展注入的消息）
    if (event.source !== "interactive") {
      return { action: "continue" };
    }

    const match = event.text.match(SKILL_CMD_RE);
    if (!match) {
      return { action: "continue" };
    }

    // 记住 skill 名，交给 before_agent_start 处理
    pendingSkillName = match[1];

    // 不 transform 用户输入，保持 UI 干净；
    // pi 仍会正常展开 /skill:name 为 SKILL.md 内容。
    return { action: "continue" };
  });

  // ─── BeforeAgentStart 事件：注入 runtime routing event ───
  pi.on("before_agent_start", async (event) => {
    if (!pendingSkillName) {
      return;
    }

    // 先消费 pending 状态，避免重复注入
    const skillName = pendingSkillName;
    pendingSkillName = null;

    // 追加 routing block 到 system prompt 末尾（最高 recency 位置）
    // 该修改仅当前 turn 有效，不持久化
    return {
      systemPrompt: event.systemPrompt + "\n" + buildRoutingBlock(skillName),
      // 最小化 trigger message，标记事件来源
      message: {
        customType: "skill-activation",
        content: skillName,
        display: false,
      },
    };
  });
}
