/**
 * 对话计时扩展 —— 记录每轮对话时长，支持实时显示
 *
 * 功能：
 * - 对话进行中：在输入框下方实时显示当前轮次耗时（每秒刷新）
 * - 每轮结束时：状态栏显示该轮耗时和累计对话时间
 * - 支持 /timing 命令查看详细统计
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
  let turnCount = 0;               // 当前会话的轮次数
  let turnStartTime = 0;           // 当前轮开始的时间戳
  let totalDuration = 0;           // 累计对话耗时（ms）
  let lastTurnDuration = 0;        // 上一轮耗时（ms）

  // —— 实时刷新相关 ——
  let tickTimer: ReturnType<typeof setInterval> | null = null;  // 每秒刷新定时器
  let requestRenderFn: (() => void) | null = null;              // 存储 tui.requestRender 引用

  // —— 会话启动 ——
  pi.on("session_start", async (_event, ctx) => {
    // 重置所有计数器
    turnCount = 0;
    turnStartTime = 0;
    totalDuration = 0;
    lastTurnDuration = 0;

    // 移除实时计时 widget（如果有残留）
    ctx.ui.setWidget("turn-timer", undefined);

    const theme = ctx.ui.theme;
    ctx.ui.setStatus(
      "turn-timer",
      theme.fg("dim", "⏱ 就绪"),
    );
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
  pi.on("turn_start", async (_event, ctx) => {
    turnCount++;
    turnStartTime = Date.now();

    const theme = ctx.ui.theme;

    // 1) 在输入框下方创建实时计时 widget
    //    widget 的 render 函数在每次 TUI 重绘时被调用，
    //    配合定时器每秒主动触发重绘，实现实时跳动效果
    ctx.ui.setWidget("turn-timer", (tui, theme) => {
      // 保存 requestRender 引用，供定时器调用
      requestRenderFn = () => tui.requestRender();

      return {
        render: () => {
          if (turnStartTime === 0) return [];

          const elapsed = Date.now() - turnStartTime;

          // 耗时颜色：<30s 用 accent，<2min 用 warning，>=2min 用 error
          const color =
            elapsed < 30_000
              ? "accent"
              : elapsed < 120_000
                ? "warning"
                : "error";

          const timerText = theme.fg(color, `⏱ ${formatDuration(elapsed)}`);
          return [theme.fg("dim", `── ${timerText} ──`)];
        },
        invalidate: () => {},
      };
    });

    // 2) 启动每秒刷新定时器，驱动 widget 更新
    tickTimer = setInterval(() => {
      requestRenderFn?.();
    }, 1000);

    // 3) 更新状态栏（显示轮次信息）
    const cumText = totalDuration > 0
      ? theme.fg("dim", ` | 累计 ${formatDuration(totalDuration)}`)
      : "";

    ctx.ui.setStatus(
      "turn-timer",
      `${theme.fg("accent", "●")} ${theme.fg("dim", `第 ${turnCount} 轮`)}${cumText}`,
    );
  });

  // —— 每轮结束 ——
  pi.on("turn_end", async (_event, ctx) => {
    if (turnStartTime === 0) return; // 安全兜底

    // 停止定时器
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    requestRenderFn = null;

    // 计算耗时
    const now = Date.now();
    lastTurnDuration = now - turnStartTime;
    totalDuration += lastTurnDuration;

    // 移除实时计时 widget
    ctx.ui.setWidget("turn-timer", undefined);

    // 更新状态栏：显示最终耗时和累计时间
    const theme = ctx.ui.theme;
    const elapsed = formatDuration(lastTurnDuration);

    const color =
      lastTurnDuration < 30_000
        ? "success"
        : lastTurnDuration < 120_000
          ? "warning"
          : "error";

    const check = theme.fg("success", "✓");
    const turnLabel = theme.fg("dim", `第 ${turnCount} 轮`);
    const timeLabel = theme.fg(color, elapsed);
    const cumLabel = theme.fg("dim", ` | 累计 ${formatDuration(totalDuration)}`);

    ctx.ui.setStatus(
      "turn-timer",
      `${check} ${turnLabel} ${timeLabel}${cumLabel}`,
    );
  });

  // —— /timing 命令：查看详细统计 ——
  pi.registerCommand("timing", {
    description: "显示当前会话的对话耗时统计",
    handler: async (_args, ctx) => {
      const theme = ctx.ui.theme;

      const lines: string[] = [
        theme.bold("⏱ 对话耗时统计"),
        "",
        `  总轮次：${turnCount}`,
      ];

      if (turnCount > 0) {
        lines.push(`  累计耗时：${formatDuration(totalDuration)}`);
        const avg = Math.round(totalDuration / turnCount);
        lines.push(`  平均耗时：${formatDuration(avg)}`);
        lines.push(`  上一轮耗时：${formatDuration(lastTurnDuration)}`);
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
