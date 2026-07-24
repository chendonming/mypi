/**
 * CodeGraph Extension
 *
 * Registers a single `codegraph` tool that wraps the CodeGraph CLI.
 * All agents (main + subagents) can use it to explore codebase structure,
 * search symbols, trace dependencies, and analyze impact.
 *
 * CLI-based, zero MCP overhead — each invocation shells out to `codegraph`.
 *
 * Features:
 * - Auto-detects .codegraph in subdirectories for multi-project workspaces
 * - Auto-detects .codegraph in parent directory for nested project dirs
 * - Use -p <path> to explicitly target a specific project
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";

// ── Multi-project workspace detection ──────────────────────────────

/** Recursively scan directories for .codegraph, up to maxDepth levels. */
function scanForCodegraph(root: string, maxDepth = 1): string[] {
	if (maxDepth < 0) return [];
	const found: string[] = [];
	try {
		for (const entry of readdirSync(root)) {
			if (entry === ".codegraph") {
				found.push(root);
				return found;
			}
			const fullPath = join(root, entry);
			if (entry !== "node_modules" && !entry.startsWith(".") && statSync(fullPath).isDirectory()) {
				found.push(...scanForCodegraph(fullPath, maxDepth - 1));
			}
		}
	} catch {
		// permission denied or non-existent
	}
	return found;
}

/** Resolve the best project path when none was explicitly given. */
function resolveProjectPath(cwd: string, explicitPath?: string): string | null {
	if (explicitPath) {
		const resolved = join(cwd, explicitPath);
		if (existsSync(join(resolved, ".codegraph"))) return resolved;
		if (existsSync(join(explicitPath, ".codegraph"))) return explicitPath;
		return null;
	}

	// Fast path: cwd itself
	if (existsSync(join(cwd, ".codegraph"))) return cwd;

	// Parent directory (e.g. pi opened inside a project subdirectory)
	const parent = dirname(cwd);
	if (parent !== cwd && existsSync(join(parent, ".codegraph"))) return parent;

	// Subdirectories (multi-project layout: root/a, root/b)
	const subdirs = scanForCodegraph(cwd, 2).filter((p) => p !== cwd);
	if (subdirs.length === 1) return subdirs[0];

	// Ambiguous or none — let the LLM decide
	return null;
}

/** Build a discovery hint when .codegraph is not found or ambiguous. */
function buildDiscoveryHint(cwd: string): string {
	const parent = dirname(cwd);
	const parentHasIt = parent !== cwd && existsSync(join(parent, ".codegraph"));
	const subdirs = scanForCodegraph(cwd, 2).filter((p) => p !== cwd);

	const lines: string[] = [];
	if (subdirs.length > 1) {
		lines.push("在子目录中发现多个 CodeGraph 索引：");
		for (const dir of subdirs) {
			const rel = relative(cwd, dir) || ".";
			lines.push(`  ${dir}/  (使用 path:"${rel}")`);
		}
	}
	if (parentHasIt) {
		const rel = relative(cwd, parent) || "..";
		lines.push(`  ${parent}/  (父目录，使用 path:"${rel}")`);
	}

	if (lines.length === 0) {
		lines.push("附近未找到 .codegraph 目录。");
	} else if (subdirs.length > 1) {
		lines.unshift("");
		lines.unshift("使用 path 参数指定要查询的项目。");
	}

	return lines.join("\n");
}

// ── Extension entry ─────────────────────────────────────────────────

export default function codegraphExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "codegraph",
		label: "CodeGraph",
		description:
			"使用 CodeGraph 预构建的代码智能索引探索代码库。" +
			"支持状态检查、区域探索、符号搜索、调用者/被调用者追踪、影响分析、文件列表。" +
			"自动检测子目录中的 .codegraph 以支持多项目工作空间。",
		promptSnippet:
			"通过 CodeGraph CLI 探索代码结构、搜索符号、追踪依赖、分析影响",
		promptGuidelines: [
			"使用 codegraph 的 command:status 验证 .codegraph 索引存在后再执行其他命令",
			"当 cwd 下没有 .codegraph 时，codegraph 自动扫描子目录以支持多项目工作空间 — 使用 path 参数指定目标项目",
			"使用 codegraph explore 一次性了解某个区域 — 返回相关符号及调用路径",
			"使用 codegraph query 按名称或模式搜索特定符号（可通过 -k kind 按类型过滤）",
			"使用 codegraph node 获取单个符号的完整源码及 caller/callee 追踪",
			"使用 codegraph callers/callees 追踪特定函数或方法的数据流和调用关系",
			"修改代码前使用 codegraph impact 分析某个符号的依赖影响范围",
			"使用 codegraph files 查看项目文件结构",
		],
		parameters: Type.Object({
			command: StringEnum(
				["status", "explore", "query", "node", "callers", "callees", "impact", "affected", "files"],
				{ description: "要运行的 CodeGraph CLI 命令" },
			),
			query: Type.Optional(
				Type.String({
					description:
						"主参数：explore|query|node|callers|callees|impact 为符号/主题名，" +
						"affected 为空格分隔的文件路径。status|files 无需此参数。",
				}),
			),
				path: Type.Optional(
				Type.String({
					description:
						"项目路径（默认自动检测）。当 cwd 为父目录且多个子项目有 .codegraph 时必填" +
						" — 例如 packages/frontend 或 ../other-project。" +
						"explore|query|node|callers|callees|impact|affected|files 使用 -p 参数传入；" +
						"status 等命令自动转为位置参数。",
				}),
			),
			kind: Type.Optional(
				Type.String({
					description:
						"query 命令的符号类型过滤，如 function、class、interface、method、variable",
				}),
			),
			limit: Type.Optional(
				Type.Number({
					description: "最大结果数（query|callers|callees）。默认：query 10 条，callers/callees 20 条。",
				}),
			),
			depth: Type.Optional(
				Type.Number({
					description: "遍历深度（impact|affected）。默认：impact 2 层，affected 5 层。",
				}),
			),
			extraArgs: Type.Optional(
				Type.String({
					description:
						"额外 CLI 参数，原样追加。" +
						"如 '--format flat --filter src/'（files 命令）、" +
						"'--json'（query|callers|callees|impact|status|files）、'--pattern *.ts'（files 命令）。",
				}),
			),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const { command, query, path: explicitPath, kind, limit, depth, extraArgs } = params;
			const cwd = ctx.cwd;

			// Resolve project path with auto-detection
			const resolvedPath = resolveProjectPath(cwd, explicitPath);

			if (!resolvedPath) {
				const hint = buildDiscoveryHint(cwd);
				return {
					content: [
						{
							type: "text",
							text: `未找到 .codegraph。${hint}`,
						},
					],
					details: {},
				};
			}

			// Build CLI arguments
			const cmdArgs: string[] = [command];

			if (query) {
				if (command === "affected") {
					cmdArgs.push(query);
				} else if (["explore", "query", "node", "callers", "callees", "impact"].includes(command)) {
					cmdArgs.push(query);
				}
			}

			// 有些命令用 -p/--path 标志，有些用位置参数 [path]
			const pathFlagCommands = ["explore", "query", "node", "callers", "callees", "impact", "affected", "files"];
			if (pathFlagCommands.includes(command)) {
				cmdArgs.push("-p", resolvedPath);
			} else {
				// status、init、uninit、index、sync、unlock 等使用位置参数 [path]
				cmdArgs.push(resolvedPath);
			}

			if (kind) cmdArgs.push("-k", kind);
			if (limit != null && Number.isFinite(limit)) cmdArgs.push("-l", String(Math.floor(limit)));
			if (depth != null && Number.isFinite(depth)) cmdArgs.push("-d", String(Math.floor(depth)));

			if (extraArgs) {
				for (const arg of extraArgs.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [extraArgs]) {
					cmdArgs.push(arg.replace(/^"|"$/g, ""));
				}
			}

			const fullCmd = `codegraph ${cmdArgs.join(" ")}`;

			try {
				const stdout = execSync(fullCmd, {
					cwd,
					encoding: "utf-8",
					maxBuffer: 10 * 1024 * 1024,
					timeout: 60_000,
				});
				const output = stdout.trim();
				return {
					content: [
						{
							type: "text",
							text: output || "CodeGraph 命令运行成功（无输出）。",
						},
					],
					details: {},
				};
			} catch (err: any) {
				const detail = err.stderr?.trim() || err.message?.trim() || String(err);
				return {
					content: [
						{
							type: "text",
							text: `CodeGraph 命令失败：\n$ ${fullCmd}\n${detail}`,
						},
					],
					details: {},
				};
			}
		},
	});
}
