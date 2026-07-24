import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * post-task-validator.ts — 任务完成后自动校验输出质量
 *
 * 监听 agent_settled 事件，在 AI 代理完全停止后：
 * 1. 运行 git diff --name-status 检查变更
 * 2. 检测垃圾文件（nul, *.tmp, *.bak, .DS_Store 等确定性模式）
 * 3. 自动丢弃确定性垃圾文件
 * 4. 告警可疑文件（空文件等）供用户处理
 *
 * 设计原则：
 *   - 硬门禁：确定性垃圾自动清理（误报率接近零的模式匹配）
 *   - 软提醒：可疑情况仅报告，不自动操作
 *   - 静默失败：任何异常都不影响 agent 主流程
 *   - 跨平台：使用 node:fs 做文件操作，git 命令做 diff
 *
 * 与 post-task-git-diff-safeguard 记忆配合：
 *   该记忆定义了"AI 应主动 git diff 自查"的行为指南，
 *   本扩展提供了代码层面的自动执行保障。
 */

// ──────────────────────────────────────────────────────────────
// Garbage file patterns (deterministic, near-zero false positive)
// ──────────────────────────────────────────────────────────────

const GARBAGE_PATTERNS: RegExp[] = [
  /^nul$/i,            // Windows nul redirect artifact (cmd 2>nul in Git Bash)
  /\.tmp$/i,           // Temporary files (*.tmp)
  /\.bak$/i,           // Backup files (*.bak)
  /^~\$/,              // Office lock files (~$filename.docx)
  /^\.DS_Store$/,      // macOS directory metadata
  /^Thumbs\.db$/i,     // Windows thumbnail cache
  /\.orig$/i,          // Merge conflict backup (*.orig)
  /\.rej$/i,           // Patch rejection files (*.rej)
];

/**
 * Check if a filename matches known garbage patterns.
 * Only matches the base name (last path segment).
 */
function isGarbage(filename: string): boolean {
  const base = filename.replace(/^.*[/\\]/, "");
  return GARBAGE_PATTERNS.some((p) => p.test(base));
}

// ──────────────────────────────────────────────────────────────
// Extension entry point
// ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.on("agent_settled", async () => {
    const cwd = process.cwd();

    // Dynamic imports — follow the pattern established by task-complete-sound.ts
    const { execSync } = await import("node:child_process");
    const { unlinkSync, existsSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");

    // ── Guard: only run in git repos ──────────────────────────
    try {
      execSync("git rev-parse --git-dir", {
        cwd,
        encoding: "utf-8",
        stdio: "pipe",
      });
    } catch {
      return; // Not a git repo — nothing to do
    }

    try {
      // ── Phase 1: Collect changed/untracked files ────────────

      const untrackedOutput = execSync(
        "git ls-files --others --exclude-standard",
        { cwd, encoding: "utf-8", stdio: "pipe" }
      ).trim();

      const diffOutput = execSync("git diff --name-status", {
        cwd,
        encoding: "utf-8",
        stdio: "pipe",
      }).trim();

      const untrackedFiles = untrackedOutput
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const changedEntries = diffOutput
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      // ── Phase 2: Classify files ─────────────────────────────
      const garbageFiles: string[] = [];
      const emptyNewFiles: string[] = [];

      // Check untracked files
      for (const file of untrackedFiles) {
        if (isGarbage(file)) {
          garbageFiles.push(file);
          continue;
        }
        // Check if empty
        try {
          const fullPath = join(cwd, file);
          if (existsSync(fullPath) && statSync(fullPath).size === 0) {
            emptyNewFiles.push(file);
          }
        } catch {
          // File may have been deleted between listing and stat
        }
      }

      // Check changed (tracked) files
      for (const entry of changedEntries) {
        // Format: "M\tpath" or "A\tpath" or "D\tpath"
        const tabIdx = entry.indexOf("\t");
        const status = tabIdx >= 0 ? entry.slice(0, tabIdx) : entry;
        const file = tabIdx >= 0 ? entry.slice(tabIdx + 1) : "";

        if (!file) continue;

        // Garbage check on tracked files too (e.g. accidentally git-added)
        if (isGarbage(file) && !garbageFiles.includes(file)) {
          garbageFiles.push(file);
        }

        // Empty file check — only for newly Added files
        if (status === "A") {
          try {
            const fullPath = join(cwd, file);
            if (existsSync(fullPath) && statSync(fullPath).size === 0) {
              emptyNewFiles.push(file);
            }
          } catch {
            // File may have been deleted between diff and stat
          }
        }
      }

      // ── Phase 3: Auto-discard deterministic garbage ─────────
      const discarded: string[] = [];
      for (const file of garbageFiles) {
        const fullPath = join(cwd, file);
        try {
          if (existsSync(fullPath)) {
            unlinkSync(fullPath);
            discarded.push(file);
          }
        } catch {
          // Permission denied, locked by another process, etc.
        }
      }

      // ── Phase 4: Report ─────────────────────────────────────
      const lines: string[] = [];

      if (discarded.length > 0) {
        lines.push(
          `🗑️  已清理 ${discarded.length} 个垃圾文件: ${discarded.join(", ")}`
        );
      }

      if (emptyNewFiles.length > 0) {
        lines.push(
          `[警告] 发现 ${emptyNewFiles.length} 个空文件 (未自动删除): ${emptyNewFiles.join(", ")}`
        );
      }

      if (lines.length > 0) {
        const header = "═══ post-task-validator ═══";
        const footer = "═══════════════════════════";
        console.log([header, ...lines, footer].join("\n"));
      }
    } catch {
      // Silent failure — never disrupt the agent
    }
  });
}
