import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * 在任务完成后播放系统提示音。
 *
 * 使用 agent_settled 事件，它在 agent 完全停止
 * （无重试、无压缩、无后续消息）后触发。
 */
export default function (pi: ExtensionAPI) {
  pi.on("agent_settled", async () => {
    // macOS 内置提示音，简短柔和不刺耳
    const { execSync } = await import("node:child_process");
    try {
      execSync("afplay /System/Library/Sounds/Glass.aiff", {
        timeout: 3000,
      });
    } catch {
      // 静默失败，不干扰用户
    }
  });
}
