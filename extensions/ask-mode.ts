/**
 * ask-mode.ts — /ask 只读讨论模式
 *
 * 功能：
 * - /ask <消息> — 一次性 Ask 模式：AI 只读不写，仅讨论想法
 * - /ask (无参数) — 切换持久 Ask 模式
 * - /build — 退出 Ask 模式
 * - 在 Ask 模式下，AI 的 system prompt 被追加只读指令
 * - 写/执行类工具（bash、write、edit、subagent 等）被拦截
 * - 只读类工具（read、memory_*、web_search、question、codegraph）正常可用
 * - TUI 底部状态栏显示当前模式状态
 *
 * 安装：放入 ~/.pi/agent/extensions/，然后 /reload 即可
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

// ── 常量 ──────────────────────────────────────────────────────────

/** Ask 模式下注入到 system prompt 末尾的指令 */
const ASK_MODE_SYSTEM_INSTRUCTION = `
## 🔵 Ask 模式（只读讨论）

您当前处于 **Ask 模式**。请严格遵守以下规则：

1. **只读讨论** — 您只能阅读和讨论，不能执行任何写操作
2. **禁止的工具**：bash、write、edit、subagent（及其链式/并行执行）
3. **允许的工具**：read（阅读文件）、memory_read/memory_search（查阅记忆）、web_search/fetch_content（网络搜索）、question（提问）、codegraph（代码导航）等只读工具
4. **行为准测**：
   - 专注于与用户讨论想法、分析问题、提供建议
   - 可以读文件来理解上下文
   - 可以搜索记忆和网络来获取信息
   - 如果您认为用户需要执行实际操作，请提示用户使用 /build 命令退出 Ask 模式
5. **勿自行操作** — 即使您觉得某个操作很安全，也不要在 Ask 模式下执行
`;

/** 允许在 Ask 模式下使用的工具（白名单） */
const ALLOWED_TOOLS = new Set([
  // 只读文件操作
  "read",
  // 记忆系统（读操作）
  "memory_read",
  "memory_search",
  // 记忆写操作（讨论中可能需保存见解，开放以增强讨论质量）
  "memory_create",
  "memory_update",
  "memory_delete",
  "memory_create_from_session",
  // 网络搜索与研究
  "web_search",
  "fetch_content",
  "get_search_content",
  // 交互提问
  "question",
  // 代码导航（只读）
  "codegraph",
  // supervisor/intercom 用于子 agent 通信（仅允许只读子任务）
  "subagent_supervisor",
  "intercom",
]);

// ── 状态 ──────────────────────────────────────────────────────────

type AskState = "inactive" | "active" | "one-shot";
let askState: AskState = "inactive";

// ── Extension 入口 ───────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // =================================================================
  //  命令：/ask
  // =================================================================
  pi.registerCommand("ask", {
    description:
      "进入只读讨论模式，AI 仅阅读和讨论，不执行任何操作。用法：/ask <你的想法> 或 /ask 切换模式。退出用 /build。",
    handler: async (args, ctx) => {
      if (!args?.trim()) {
        // 无参数 → 切换持久模式
        const next = askState === "inactive" ? "active" : "inactive";
        askState = next;
        notifyMode(ctx, next);
        return;
      }

      // 有参数 → 一次性 Ask 模式
      askState = "one-shot";
      notifyMode(ctx, "one-shot");
      await ctx.sendUserMessage(args.trim());
    },
  });

  // =================================================================
  //  命令：/build（退出 Ask 模式）
  // =================================================================
  pi.registerCommand("build", {
    description: "退出 Ask 模式，恢复正常可执行交互",
    handler: async (_args, ctx) => {
      if (askState !== "inactive") {
        const prev = askState;
        askState = "inactive";
        ctx.ui.notify(
          "Ask 模式已关闭，恢复可执行模式",
          prev === "one-shot" ? "info" : "info",
        );
      } else {
        ctx.ui.notify("当前不在 Ask 模式下", "info");
      }
    },
  });

  // =================================================================
  //  System prompt 注入
  // =================================================================
  pi.on("before_agent_start", async (event) => {
    if (askState === "inactive") return;

    return {
      systemPrompt: event.systemPrompt + ASK_MODE_SYSTEM_INSTRUCTION,
    };
  });

  // =================================================================
  //  工具调用拦截
  // =================================================================
  pi.on("tool_call", async (event) => {
    if (askState === "inactive") return;
    if (ALLOWED_TOOLS.has(event.toolName)) return;

    return {
      block: true,
      reason: `🔵 Ask 模式下不允许执行 ${event.toolName} 操作。Ask 模式仅允许阅读和讨论。如需执行实际操作，请先使用 /build 命令退出 Ask 模式。`,
    };
  });

  // =================================================================
  //  自动清理一次性模式
  // =================================================================
  pi.on("agent_end", async () => {
    if (askState === "one-shot") {
      askState = "inactive";
    }
  });

  // =================================================================
  //  TUI widget：状态指示器
  // =================================================================
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.setWidget("ask-mode-indicator", (tui, theme) => ({
      render: () => {
        if (askState === "inactive") return [];
        const label =
          askState === "active"
            ? "🔵 Ask 模式（持久）"
            : "🔵 Ask 模式";
        return [theme.fg("accent", `── ${label} ──`)];
      },
      invalidate: () => {},
    }));
  });
}

// ── 辅助函数 ─────────────────────────────────────────────────────

function notifyMode(ctx: ExtensionCommandContext, state: AskState) {
  switch (state) {
    case "active":
      ctx.ui.notify(
        "🔵 Ask 模式已开启 — 仅讨论，不执行。使用 /build 退出。",
        "info",
      );
      break;
    case "one-shot":
      ctx.ui.notify(
        "🔵 本次 Ask 模式 — 仅讨论，不执行。",
        "info",
      );
      break;
    case "inactive":
      ctx.ui.notify("Ask 模式已关闭，恢复可执行模式", "info");
      break;
  }
}
