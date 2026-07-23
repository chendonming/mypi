/**
 * 逐轮计时扩展 —— 每次用户输入后重新计时
 *
 * 功能：
 * - widget 始终显示当前轮的对话耗时（每次用户输入后归零重新计时）
 * - 对话进行中每秒刷新
 * - 支持 /timing 命令查看当前轮详细统计
 *
 * 安装：放入 ~/.pi/agent/extensions/ 或 .pi/extensions/ 即可，无需额外配置。
 * 重载：/reload 即可热加载。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** 格式化毫秒为可读字符串 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

export default function (pi: ExtensionAPI) {
  // —— 会话级状态 ——
  let turnCount = 0;        // 总轮次数（仅用于 /timing 统计）
  let turnStartTime = 0;    // 当前轮开始时间戳
  let totalDuration = 0;    // 累计对话总耗时（ms）
  let lastTurnDuration = 0; // 上一轮耗时（ms）
  let inTurn = false;       // 是否正在对话轮次中

  // —— 实时刷新相关 ——
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let requestRenderFn: (() => void) | null = null;

  // —— 会话启动 ——
  pi.on("session_start", async (_event, ctx) => {
    // 重置所有计数器
    turnCount = 0;
    turnStartTime = 0;
    totalDuration = 0;
    lastTurnDuration = 0;
    inTurn = false;

    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    requestRenderFn = null;

    // 创建持久化 widget（仅在会话启动时创建一次，生命周期跟随会话）
    ctx.ui.setWidget("turn-timer", (tui, theme) => {
      requestRenderFn = () => tui.requestRender();

      return {
        render: () => {
          // 累计时间 = 已完成轮次总耗时 + 当前进行中的耗时（如果有）
          const elapsedThisTurn = inTurn ? (Date.now() - turnStartTime) : 0;
          const cumulative = totalDuration + elapsedThisTurn;

          // 耗时颜色：<30s 用 accent，<2min 用 warning，>=2min 用 error
          const color =
            cumulative < 30_000
              ? "accent"
              : cumulative < 120_000
                ? "warning"
                : "error";

          const timerText = theme.fg(color, `⏱ ${formatDuration(cumulative)}`);
          return [theme.fg("dim", `── ${timerText} ──`)];
        },
        invalidate: () => {},
      };
    });

    // 不需要状态栏
    ctx.ui.setStatus("turn-timer", undefined);
  });

  // —— 会话关闭 ——
  pi.on("session_shutdown", () => {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    requestRenderFn = null;
  });

  // —— 每轮开始 ——
  pi.on("turn_start", async () => {
    turnCount++;

    // 仅在真正的新轮次（非内部循环）时重置计时
    if (!inTurn) {
      turnStartTime = Date.now();
      totalDuration = 0;
      lastTurnDuration = 0;
    }

    inTurn = true;

    // 启动每秒刷新定时器，驱动 widget 更新
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      requestRenderFn?.();
    }, 1000);
  });

  // —— 每轮结束 ——
  pi.on("turn_end", async () => {
    if (!inTurn) return;

    const now = Date.now();
    lastTurnDuration = now - turnStartTime;
    totalDuration += lastTurnDuration;
    inTurn = false;
    turnStartTime = 0;

    // 停止定时器（轮次结束后无需每秒刷新）
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    // requestRenderFn 保留引用，但 widget 本身持久存在，
    // 下次 turn_start 时会重新设置定时器和 requestRenderFn
  });

  // —— /timing 命令：查看详细统计 ——
  pi.registerCommand("timing", {
    description: "显示当前会话的对话耗时统计",
    handler: async (_args, ctx) => {
      const theme = ctx.ui.theme;

      const lines: string[] = [
        theme.bold("⏱ 当前轮对话耗时"),
        "",
        `  当前轮耗时：${formatDuration(totalDuration)}`,
      ];

      if (turnCount > 0) {
        const avg = Math.round(totalDuration / turnCount);
        lines.push(`  平均耗时：${formatDuration(avg)}`);
        lines.push(`  轮次序号：#${turnCount}`);
      } else {
        lines.push(theme.fg("dim", "  （暂无对话记录）"));
      }

      if (ctx.hasUI) {
        ctx.ui.notify(lines.join("\n"), "info");
      } else {
        console.log(lines.join("\n"));
      }
    },
  });
}
