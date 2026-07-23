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
		lines.push("Found multiple CodeGraph indexes in subdirectories:");
		for (const dir of subdirs) {
			const rel = relative(cwd, dir) || ".";
			lines.push(`  ${dir}/  (use -p "${rel}")`);
		}
	}
	if (parentHasIt) {
		const rel = relative(cwd, parent) || "..";
		lines.push(`  ${parent}/  (parent directory, use -p "${rel}")`);
	}

	if (lines.length === 0) {
		lines.push("No .codegraph directory found anywhere nearby.");
	} else if (subdirs.length > 1) {
		lines.unshift("");
		lines.unshift("Specify which project to query using the -p parameter.");
	}

	return lines.join("\n");
}

// ── Extension entry ─────────────────────────────────────────────────

export default function codegraphExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "codegraph",
		label: "CodeGraph",
		description:
			"Explore codebase using CodeGraph's pre-built code intelligence index. " +
			"Run status, explore topics, search symbols, trace callers/callees, analyze impact, list files. " +
			"Auto-detects .codegraph in subdirectories for multi-project workspaces.",
		promptSnippet:
			"Explore codebase structure, search symbols, trace dependencies, and analyze impact via the CodeGraph CLI",
		promptGuidelines: [
			"Use codegraph with command:status to verify a .codegraph index exists before other commands",
			"When cwd has no .codegraph, codegraph auto-scans subdirectories for multi-project workspaces — use -p <subdir> to target a specific project",
			"Use codegraph explore for one-shot understanding of an area — returns relevant symbols plus call paths",
			"Use codegraph query to search for specific symbols by name or pattern (optionally filtered by -k kind)",
			"Use codegraph node to get a single symbol's full source with caller/callee trail",
			"Use codegraph callers/callees to trace data and flow for a specific function or method",
			"Use codegraph impact before making changes to understand what depends on a symbol",
			"Use codegraph files to see the project file structure from the index",
		],
		parameters: Type.Object({
			command: StringEnum(
				["status", "explore", "query", "node", "callers", "callees", "impact", "affected", "files"],
				{ description: "CodeGraph CLI command to run" },
			),
			query: Type.Optional(
				Type.String({
					description:
						"Primary argument: symbol/topic for explore|query|node|callers|callees|impact, " +
						"space-separated file paths for affected. Omitted for status|files.",
				}),
			),
			path: Type.Optional(
				Type.String({
					description:
						"Project path (defaults to auto-detect). Required when cwd is a parent directory and " +
						"multiple subprojects have .codegraph — e.g. -p packages/frontend or -p ../other-project.",
				}),
			),
			kind: Type.Optional(
				Type.String({
					description:
						"Symbol kind filter for query command, e.g. function, class, interface, method, variable",
				}),
			),
			limit: Type.Optional(
				Type.Number({
					description: "Max results (query|callers|callees). Default varies: 10 query, 20 callers/callees.",
				}),
			),
			depth: Type.Optional(
				Type.Number({
					description: "Traversal depth (impact|affected). Default: 2 impact, 5 affected.",
				}),
			),
			extraArgs: Type.Optional(
				Type.String({
					description:
						"Extra CLI flags appended as-is, e.g. '--format flat --filter src/' (files), " +
						"'--json' (query|callers|callees|impact|status|files), '--pattern *.ts' (files).",
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
							text: `.codegraph not found.${hint}`,
						},
					],
					isError: false,
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

			cmdArgs.push("-p", resolvedPath);

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
							text: output || "CodeGraph command ran successfully (no output).",
						},
					],
				};
			} catch (err: any) {
				const detail = err.stderr?.trim() || err.message?.trim() || String(err);
				return {
					content: [
						{
							type: "text",
							text: `CodeGraph command failed:\n$ ${fullCmd}\n${detail}`,
						},
					],
					isError: true,
				};
			}
		},
	});
}
