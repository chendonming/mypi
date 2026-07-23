/**
 * Pi Memory System — 类似 Claude Code 的持久化记忆系统
 *
 * 结构:
 *   ~/.pi/memory/
 *     INDEX.md               — 全局索引（所有项目）
 *     projects/{slug}/
 *       MEMORY.md            — 项目索引
 *       {entry-name}.md      — 具体记忆文件
 *     user/
 *       MEMORY.md            — 用户级记忆索引
 *       {entry-name}.md      — 用户级记忆文件
 *
 * 记忆类型:
 *   project  — 项目静态事实（架构、部署、约束、技术选型）
 *   feedback — 交互习得的模式（踩坑、偏好、workaround）
 *
 * LLM 工具: memory_read / memory_create / memory_update / memory_delete / memory_search
 * 用户命令: /memory
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ============================================================
// Constants & Types
// ============================================================

const MEMORY_BASE = path.join(os.homedir(), ".pi", "memory");

type MemoryType = "project" | "feedback";
type MemoryStatus = "active" | "superseded" | "archived";

interface MemoryFrontmatter {
  name: string;
  description: string;
  type: MemoryType;
  tags: string[];
  status: MemoryStatus;
  originSessionId?: string;
  created_at: string;
  updated_at?: string;
}

interface MemoryFile {
  frontmatter: MemoryFrontmatter;
  content: string;
}

interface IndexEntry {
  name: string;
  filename: string;
  description: string;
  tags: string[];
  type: MemoryType;
}

// ============================================================
// Storage Helpers
// ============================================================

function getDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getProjectSlug(cwd: string): string {
  // "E:\01_Projects\08_BimWinLODChunkMerge\bimwin-ui-vue"
  // → "E--01_Projects--08_BimWinLODChunkMerge--bimwin-ui-vue"
  const normalized = cwd.replace(/\\/g, "/").replace(/^[a-zA-Z]:\//, "");
  return normalized.split("/").join("--");
}

function projectDir(slug: string): string {
  return path.join(MEMORY_BASE, "projects", slug);
}

function projectIndexPath(slug: string): string {
  return path.join(projectDir(slug), "MEMORY.md");
}

function projectMemoryPath(slug: string, filename: string): string {
  return path.join(projectDir(slug), filename);
}

function userDir(): string {
  return path.join(MEMORY_BASE, "user");
}

function userIndexPath(): string {
  return path.join(userDir(), "MEMORY.md");
}

function userMemoryPath(filename: string): string {
  return path.join(userDir(), filename);
}

function globalIndexPath(): string {
  return path.join(MEMORY_BASE, "INDEX.md");
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ============================================================
// YAML / Frontmatter Parsing (zero deps)
// ============================================================

function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentKey: string | null = null;
  const listValues: string[] = [];
  let inList = false;

  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = line.search(/\S/);
    if (indent === 0) {
      // Flush pending list
      if (inList && currentKey) {
        result[currentKey] = [...listValues];
        listValues.length = 0;
        inList = false;
      }

      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;

      currentKey = trimmed.slice(0, colonIdx);
      const rest = trimmed.slice(colonIdx + 1).trim();

      if (rest === "") {
        inList = true;
      } else if (rest.startsWith("[") && rest.endsWith("]")) {
        result[currentKey] = rest
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
      } else {
        result[currentKey] = rest.replace(/^['"]|['"]$/g, "");
      }
    } else if (inList && trimmed.startsWith("- ")) {
      listValues.push(trimmed.slice(2));
    }
  }

  if (inList && currentKey) {
    result[currentKey] = [...listValues];
  }

  return result;
}

function parseFrontmatter(text: string): { frontmatter: Record<string, unknown>; body: string } | null {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  return { frontmatter: parseYaml(match[1]), body: match[2].trim() };
}

// ============================================================
// Memory File Read / Write
// ============================================================

function readMemoryFile(filePath: string): MemoryFile | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const text = fs.readFileSync(filePath, "utf-8");
    const parsed = parseFrontmatter(text);
    if (!parsed) return null;

    const fm = parsed.frontmatter;
    const meta = (fm.metadata as Record<string, unknown>) || {};

    return {
      frontmatter: {
        name: String(fm.name || ""),
        description: String(fm.description || ""),
        type: (meta.type as MemoryType) || "project",
        tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
        status: (meta.status as MemoryStatus) || "active",
        originSessionId: (meta.originSessionId as string) || undefined,
        created_at: String(meta.created_at || ""),
        updated_at: (meta.updated_at as string) || undefined,
      },
      content: parsed.body,
    };
  } catch {
    return null;
  }
}

function buildMemoryContent(mem: MemoryFile): string {
  const f = mem.frontmatter;
  const metaTags = f.tags.length > 0 ? `[${f.tags.join(", ")}]` : "[]";

  const lines: string[] = [
    "---",
    `name: ${f.name}`,
    `description: ${f.description}`,
    "metadata:",
    `  node_type: memory`,
    `  type: ${f.type}`,
    `  tags: ${metaTags}`,
    `  status: ${f.status}`,
    `  created_at: ${f.created_at}`,
  ];
  if (f.originSessionId) lines.push(`  originSessionId: ${f.originSessionId}`);
  if (f.updated_at) lines.push(`  updated_at: ${f.updated_at}`);
  lines.push("---", "", mem.content, "");

  return lines.join("\n");
}

function writeMemoryFile(filePath: string, mem: MemoryFile): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, buildMemoryContent(mem), "utf-8");
}

function deleteMemoryFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ============================================================
// Index Read / Write
// ============================================================

function parseIndex(content: string): IndexEntry[] {
  const entries: IndexEntry[] = [];
  let currentType: MemoryType = "project";

  for (const line of content.split("\n")) {
    const typeHeader = line.match(/^## (project|feedback)$/);
    if (typeHeader) {
      currentType = typeHeader[1] as MemoryType;
      continue;
    }

    const entryMatch = line.match(/^- \[(.+?)\]\((.+?)\) — (.+)$/);
    if (entryMatch) {
      entries.push({
        name: entryMatch[1],
        filename: entryMatch[2],
        description: entryMatch[3],
        tags: [],
        type: currentType,
      });
    }

    const tagMatch = line.match(/^\s+tags:\s*(.+)$/);
    if (tagMatch && entries.length > 0) {
      entries[entries.length - 1].tags = tagMatch[1]
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }

  return entries;
}

function buildIndex(entries: IndexEntry[]): string {
  const projectEntries = entries.filter((e) => e.type === "project");
  const feedbackEntries = entries.filter((e) => e.type === "feedback");

  const lines: string[] = ["# Memory Index", ""];

  if (projectEntries.length > 0) {
    lines.push("## project", "");
    for (const e of projectEntries) {
      lines.push(`- [${e.name}](${e.filename}) — ${e.description}`);
      if (e.tags.length > 0) lines.push(`  tags: ${e.tags.join(", ")}`);
    }
    lines.push("");
  }

  if (feedbackEntries.length > 0) {
    lines.push("## feedback", "");
    for (const e of feedbackEntries) {
      lines.push(`- [${e.name}](${e.filename}) — ${e.description}`);
      if (e.tags.length > 0) lines.push(`  tags: ${e.tags.join(", ")}`);
    }
    lines.push("");
  }

  if (projectEntries.length === 0 && feedbackEntries.length === 0) {
    lines.push("_No memories yet. Use the memory tools to add some._", "");
  }

  return lines.join("\n");
}

function readOrInitIndex(indexPath: string): IndexEntry[] {
  ensureDir(path.dirname(indexPath));
  if (fs.existsSync(indexPath)) {
    return parseIndex(fs.readFileSync(indexPath, "utf-8"));
  }
  const empty = buildIndex([]);
  fs.writeFileSync(indexPath, empty, "utf-8");
  return [];
}

function saveIndex(indexPath: string, entries: IndexEntry[]): void {
  ensureDir(path.dirname(indexPath));
  fs.writeFileSync(indexPath, buildIndex(entries), "utf-8");
}

// ============================================================
// Search
// ============================================================

interface SearchResult {
  filename: string;
  name: string;
  description: string;
  type: MemoryType;
  snippet: string;
}

function searchInDir(dir: string, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  if (!fs.existsSync(dir)) return results;

  const q = query.toLowerCase();

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "MEMORY.md") {
      const fp = path.join(dir, entry.name);
      const mem = readMemoryFile(fp);
      if (!mem) continue;

      const searchable = [mem.frontmatter.name, mem.frontmatter.description, mem.content, ...mem.frontmatter.tags]
        .join(" ")
        .toLowerCase();

      if (searchable.includes(q)) {
        const snippet = mem.content.replace(/\n/g, " ").slice(0, 200) + (mem.content.length > 200 ? "..." : "");
        results.push({
          filename: entry.name,
          name: mem.frontmatter.name,
          description: mem.frontmatter.description,
          type: mem.frontmatter.type,
          snippet,
        });
      }
    }
  }

  return results;
}

// ============================================================
// Index Text for System Prompt Injection
// ============================================================

function formatIndexForPrompt(entries: IndexEntry[], scopeLabel: string): string {
  if (entries.length === 0) return "";

  const lines: string[] = [`### ${scopeLabel}`];
  for (const e of entries) {
    lines.push(`- [${e.type}] ${e.description}`);
    if (e.tags.length > 0) lines.push(`  tags: ${e.tags.join(", ")}`);
  }
  lines.push("");
  return lines.join("\n");
}

// ============================================================
// Helpers
// ============================================================

/** Extract a short session identifier from the extension context */
function getSessionId(ctx: any): string | undefined {
  try {
    const sessionFile = ctx.sessionManager?.getSessionFile?.();
    if (sessionFile) return path.basename(sessionFile).replace(/\.jsonl$/, "");
  } catch { /* ignore */ }
  return undefined;
}

function listMemoriesAsText(entries: IndexEntry[]): string {
  if (entries.length === 0) return "No memories yet.";
  return entries
    .map(
      (e) =>
        `[${e.type}] **${e.name}** — ${e.description}` +
        (e.tags.length > 0 ? `\n  tags: ${e.tags.join(", ")}` : ""),
    )
    .join("\n\n");
}

// ============================================================
// Extension Entry Point
// ============================================================

export default function (pi: ExtensionAPI) {
  // ──────────────────────────────────────────────
  // Event: session_start — validate storage is ready
  // ──────────────────────────────────────────────
  pi.on("session_start", async (_event, ctx) => {
    ensureDir(MEMORY_BASE);
    ensureDir(projectDir(getProjectSlug(ctx.cwd)));
    ensureDir(userDir());

    // Read project index to see if any memories exist
    const projectSlug = getProjectSlug(ctx.cwd);
    const idxPath = projectIndexPath(projectSlug);
    const entries = readOrInitIndex(idxPath);
    const userEntries = readOrInitIndex(userIndexPath());

    if (entries.length > 0 || userEntries.length > 0) {
      ctx.ui.notify(`Memory: ${entries.length} project + ${userEntries.length} user entries`, "info");
    }
  });

  // ──────────────────────────────────────────────
  // Event: before_agent_start — inject memory index + creation guidelines
  // ──────────────────────────────────────────────
  pi.on("before_agent_start", async (event, ctx) => {
    const projectSlug = getProjectSlug(ctx.cwd);
    const projectEntries = readOrInitIndex(projectIndexPath(projectSlug));
    const userEntries = readOrInitIndex(userIndexPath());

    const guidelines = `
## Memory System

I maintain a persistent memory system (\`~/.pi/memory/\`) to store important project information across sessions. Each memory is a Markdown file — like a knowledge base article.

### How to create memories

When the user shares something worth remembering — a constraint, a workaround, a decision, deployment details, a recurring issue — synthesize it into a well-structured article using \`memory_create\`.

**Don't just repeat the user's words verbatim.** Extract what matters, add context, and write a self-contained note that:
- Explains the **context / problem** upfront
- States the **key finding or conclusion** clearly
- Includes **Why** — the reasoning or root cause
- Includes **How to apply** — concrete actions, commands, or implications

A good example:
\`\`\`markdown
公司环境对 Java 源文件（.java）进行了加密，导致 read_file 工具报告 "NUL byte detected" 无法读取。
但 bash 工具（如 cat、python 读取）可以绕过此限制正常读取。

因此，在此项目中读取 Java 文件内容时，必须使用 bash 工具，而不是 read_file 工具。
已验证 python -c 和 cat -v 两种方式。

Why:
公司加密机制作用于文件系统层，read_file 直接读遇到 NUL 字节会拒绝显示。

How to apply:
- 读取 .java 文件时使用 bash 工具
- .xml/.yml/.properties/.vue/.ts 等不受影响，仍可用 read_file
\`\`\`

Also use \`memory_update\` to keep existing memories up-to-date, and \`memory_search\` to find relevant information before creating duplicates.
`;

    if (projectEntries.length === 0 && userEntries.length === 0) {
      return { systemPrompt: event.systemPrompt + guidelines };
    }

    const parts: string[] = ["\n\n### Current memory index\n\nThe following memories exist: use `memory_read` to load full content, or `memory_search` to find specific info.\n"];

    if (projectEntries.length > 0) {
      parts.push(formatIndexForPrompt(projectEntries, "Project"));
    }
    if (userEntries.length > 0) {
      parts.push(formatIndexForPrompt(userEntries, "User"));
    }

    parts.push("");

    return {
      systemPrompt: event.systemPrompt + guidelines + parts.join("\n"),
    };
  });

  // ──────────────────────────────────────────────
  // TOOL: memory_read — read a specific memory file
  // ──────────────────────────────────────────────
  pi.registerTool({
    name: "memory_read",
    label: "Memory Read",
    description: "Read the full content of a specific memory entry by its name",
    promptSnippet: "Read a memory entry by name to get its full content",
    parameters: Type.Object({
      name: Type.String({ description: "Name of the memory entry to read" }),
      scope: Type.Optional(
        StringEnum(["project", "user"] as const, { description: "Scope: project (default) or user" }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const scope = params.scope || "project";
      const slug = getProjectSlug(ctx.cwd);

      const baseDir = scope === "user" ? userDir() : projectDir(slug);
      const indexPath = scope === "user" ? userIndexPath() : projectIndexPath(slug);
      const entries = readOrInitIndex(indexPath);

      // Find matching entry by name (fuzzy: try exact first, then case-insensitive)
      const match =
        entries.find((e) => e.name === params.name) ||
        entries.find((e) => e.name.toLowerCase() === params.name.toLowerCase()) ||
        entries.find((e) => e.name.toLowerCase().includes(params.name.toLowerCase()));

      if (!match) {
        return {
          content: [
            {
              type: "text",
              text: `Memory "${params.name}" not found in ${scope} scope. Available entries:\n${listMemoriesAsText(entries)}`,
            },
          ],
        };
      }

      const filePath = path.join(baseDir, match.filename);
      const mem = readMemoryFile(filePath);
      if (!mem) {
        return {
          content: [{ type: "text", text: `Memory file "${match.filename}" exists in index but cannot be read.` }],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `# ${mem.frontmatter.name}\n\n**${mem.frontmatter.description}**\n\nType: ${mem.frontmatter.type} | Status: ${mem.frontmatter.status} | Created: ${mem.frontmatter.created_at}${
              mem.frontmatter.updated_at ? ` | Updated: ${mem.frontmatter.updated_at}` : ""
            }\n\n${mem.content}`,
          },
        ],
      };
    },
  });

  // ──────────────────────────────────────────────
  // TOOL: memory_create — create a new memory entry
  // ──────────────────────────────────────────────
  pi.registerTool({
    name: "memory_create",
    label: "Memory Create",
    description: "Create a new memory entry. Write it as a knowledge-base article: context, key finding, Why (reasoning), How to apply (actions).",
    promptSnippet: "Synthesize user input into a structured knowledge note with context, Why, and How to apply",
    promptGuidelines: [
      "When the user shares something worth remembering, use memory_create to write a well-structured article.",
      "Don't copy their words verbatim — extract key facts, add context from your project knowledge.",
      "A good memory covers: context/problem → key finding → Why (reasoning/root cause) → How to apply (actions/implications).",
      "Use memory_read to check existing memories before creating duplicates, and memory_update to refine existing ones.",
    ],
    parameters: Type.Object({
      name: Type.String({ description: "Unique name/identifier for this memory (lowercase-kebab-case)" }),
      description: Type.String({ description: "One-line summary of what this memory contains" }),
      type: StringEnum(["project", "feedback"] as const, {
        description: "project = static facts (architecture, deployment, constraints); feedback = learned patterns (preferences, repeated issues, workarounds)",
      }),
      content: Type.String({ description: "Memory body. Write it as a knowledge article: describe the context/problem, state the key finding, include Why (reasoning/root cause) and How to apply (actions/implications). Synthesize, don't just copy the user's words." }),
      tags: Type.Optional(
        Type.Array(Type.String(), { description: "Optional tags for categorization (e.g. ['docker', 'devops'])" }),
      ),
      scope: Type.Optional(
        StringEnum(["project", "user"] as const, { description: "Scope: project (default) or user (cross-project)" }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const scope = params.scope || "project";
      const slug = getProjectSlug(ctx.cwd);
      const baseDir = scope === "user" ? userDir() : projectDir(slug);
      const indexPath = scope === "user" ? userIndexPath() : projectIndexPath(slug);

      // Validate name format
      const name = params.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      if (!name) {
        return { content: [{ type: "text", text: "Invalid name. Use lowercase kebab-case (e.g. 'zentao-deployment')." }] };
      }

      const filename = `${name}.md`;
      const filePath = path.join(baseDir, filename);

      // Check for name collision
      if (fs.existsSync(filePath)) {
        return {
          content: [
            {
              type: "text",
              text: `Memory "${name}" already exists. Use memory_update to modify it, or choose a different name.`,
            },
          ],
        };
      }

      const now = getDateStr();
      const mem: MemoryFile = {
        frontmatter: {
          name,
          description: params.description,
          type: params.type,
          tags: params.tags || [],
          status: "active",
          originSessionId: getSessionId(ctx),
          created_at: now,
        },
        content: params.content,
      };

      writeMemoryFile(filePath, mem);

      // Update index
      const entries = readOrInitIndex(indexPath);
      entries.push({
        name,
        filename,
        description: params.description,
        tags: params.tags || [],
        type: params.type,
      });
      saveIndex(indexPath, entries);

      return {
        content: [{ type: "text", text: `✅ Memory "${name}" created (${scope}, ${params.type}).` }],
      };
    },
  });

  // ──────────────────────────────────────────────
  // TOOL: memory_update — update an existing memory
  // ──────────────────────────────────────────────
  pi.registerTool({
    name: "memory_update",
    label: "Memory Update",
    description: "Update an existing memory entry's content, description, tags, or status",
    promptSnippet: "Update an existing memory entry",
    parameters: Type.Object({
      name: Type.String({ description: "Name of the memory entry to update" }),
      description: Type.Optional(Type.String({ description: "New one-line summary" })),
      content: Type.Optional(Type.String({ description: "New detailed content (replaces existing)" })),
      tags: Type.Optional(
        Type.Array(Type.String(), { description: "New tags" }),
      ),
      status: Type.Optional(
        StringEnum(["active", "superseded", "archived"] as const, {
          description: "Mark as superseded (replaced by newer info) or archived (no longer relevant)",
        }),
      ),
      scope: Type.Optional(
        StringEnum(["project", "user"] as const, { description: "Scope: project (default) or user" }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const scope = params.scope || "project";
      const slug = getProjectSlug(ctx.cwd);
      const baseDir = scope === "user" ? userDir() : projectDir(slug);
      const indexPath = scope === "user" ? userIndexPath() : projectIndexPath(slug);

      const entries = readOrInitIndex(indexPath);
      const match =
        entries.find((e) => e.name === params.name) ||
        entries.find((e) => e.name.toLowerCase() === params.name.toLowerCase());

      if (!match) {
        return {
          content: [{ type: "text", text: `Memory "${params.name}" not found in ${scope} scope.` }],
        };
      }

      const filePath = path.join(baseDir, match.filename);
      const mem = readMemoryFile(filePath);
      if (!mem) {
        return { content: [{ type: "text", text: `Cannot read memory file "${match.filename}".` }] };
      }

      // Apply updates
      if (params.description !== undefined) mem.frontmatter.description = params.description;
      if (params.content !== undefined) mem.content = params.content;
      if (params.tags !== undefined) mem.frontmatter.tags = params.tags;
      if (params.status !== undefined) mem.frontmatter.status = params.status;
      mem.frontmatter.updated_at = getDateStr();

      writeMemoryFile(filePath, mem);

      // Update index entry
      if (params.description !== undefined) match.description = params.description;
      if (params.tags !== undefined) match.tags = params.tags;
      saveIndex(indexPath, entries);

      const changes: string[] = [];
      if (params.description !== undefined) changes.push("description");
      if (params.content !== undefined) changes.push("content");
      if (params.tags !== undefined) changes.push("tags");
      if (params.status !== undefined) changes.push(`status → ${params.status}`);

      return {
        content: [{ type: "text", text: `✅ Memory "${params.name}" updated: ${changes.join(", ")}.` }],
      };
    },
  });

  // ──────────────────────────────────────────────
  // TOOL: memory_delete — delete a memory entry
  // ──────────────────────────────────────────────
  pi.registerTool({
    name: "memory_delete",
    label: "Memory Delete",
    description: "Delete a memory entry permanently",
    promptSnippet: "Delete a memory entry",
    parameters: Type.Object({
      name: Type.String({ description: "Name of the memory entry to delete" }),
      scope: Type.Optional(
        StringEnum(["project", "user"] as const, { description: "Scope: project (default) or user" }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const scope = params.scope || "project";
      const slug = getProjectSlug(ctx.cwd);
      const baseDir = scope === "user" ? userDir() : projectDir(slug);
      const indexPath = scope === "user" ? userIndexPath() : projectIndexPath(slug);

      const entries = readOrInitIndex(indexPath);
      const idx = entries.findIndex(
        (e) => e.name === params.name || e.name.toLowerCase() === params.name.toLowerCase(),
      );

      if (idx === -1) {
        return { content: [{ type: "text", text: `Memory "${params.name}" not found.` }] };
      }

      const match = entries[idx];
      const filePath = path.join(baseDir, match.filename);

      deleteMemoryFile(filePath);
      entries.splice(idx, 1);
      saveIndex(indexPath, entries);

      return {
        content: [{ type: "text", text: `🗑️ Memory "${params.name}" deleted.` }],
      };
    },
  });

  // ──────────────────────────────────────────────
  // TOOL: memory_search — search across all memories
  // ──────────────────────────────────────────────
  pi.registerTool({
    name: "memory_search",
    label: "Memory Search",
    description: "Search across all memory entries by keyword. Searches names, descriptions, tags, and full content.",
    promptSnippet: "Search memories by keyword",
    parameters: Type.Object({
      query: Type.String({ description: "Search keyword or phrase" }),
      type: Type.Optional(
        StringEnum(["project", "feedback"] as const, { description: "Optional: filter by memory type" }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const slug = getProjectSlug(ctx.cwd);

      const projectResults = searchInDir(projectDir(slug), params.query);
      const userResults = searchInDir(userDir(), params.query);

      // Filter by type if specified
      const filteredProject = params.type ? projectResults.filter((r) => r.type === params.type) : projectResults;
      const filteredUser = params.type ? userResults.filter((r) => r.type === params.type) : userResults;

      if (filteredProject.length === 0 && filteredUser.length === 0) {
        return { content: [{ type: "text", text: `No memories found matching "${params.query}".` }] };
      }

      const parts: string[] = [`Search results for "${params.query}":`, ""];

      if (filteredProject.length > 0) {
        parts.push(`**Project (${filteredProject.length}):**`);
        for (const r of filteredProject) {
          parts.push(`- **${r.name}** [${r.type}] — ${r.description}`);
          parts.push(`  \`memory_read name="${r.name}"\``);
          parts.push(`  > ${r.snippet}`);
        }
        parts.push("");
      }

      if (filteredUser.length > 0) {
        parts.push(`**User (${filteredUser.length}):**`);
        for (const r of filteredUser) {
          parts.push(`- **${r.name}** [${r.type}] — ${r.description}`);
          parts.push(`  \`memory_read name="${r.name}" scope=user\``);
          parts.push(`  > ${r.snippet}`);
        }
      }

      return { content: [{ type: "text", text: parts.join("\n") }] };
    },
  });

  // ──────────────────────────────────────────────
  // COMMAND: /memory — user-facing memory management
  // ──────────────────────────────────────────────
  pi.registerCommand("memory", {
    description: "View and manage memories. Usage: /memory | /memory add <desc> | /memory search <q> | /memory clear | /memory open <name>",
    handler: async (args, ctx) => {
      const projectSlug = getProjectSlug(ctx.cwd);
      const projectEntries = readOrInitIndex(projectIndexPath(projectSlug));
      const userEntries = readOrInitIndex(userIndexPath());

      const trimmed = args.trim();

      // /memory search <query>
      if (trimmed.startsWith("search ")) {
        const query = trimmed.slice(7).trim();
        if (!query) {
          ctx.ui.notify("Usage: /memory search <query>", "warning");
          return;
        }
        const projectResults = searchInDir(projectDir(projectSlug), query);
        const userResults = searchInDir(userDir(), query);

        let msg = `Search "${query}":\n`;
        if (projectResults.length === 0 && userResults.length === 0) {
          msg += "No results found.";
        } else {
          for (const r of projectResults) msg += `\n📄 ${r.name} [project] — ${r.snippet}`;
          for (const r of userResults) msg += `\n📄 ${r.name} [user] — ${r.snippet}`;
        }
        ctx.ui.notify(msg, "info");
        return;
      }

      // /memory add <description> — 快速添加一条记忆（feedback 类型）
      if (trimmed.startsWith("add ")) {
        const text = trimmed.slice(4).trim();
        if (!text) {
          ctx.ui.notify("Usage: /memory add <description>", "warning");
          return;
        }

        // 检测是否指定了作用域和类型
        let targetScope: "project" | "user" = "project";
        let explicitType: string | null = null;
        let content = text;

        const flagMatch = content.match(/^--(\S+)\s+(.*)$/);
        if (flagMatch) {
          const flag = flagMatch[1];
          const rest = flagMatch[2].trim();
          if (flag === "user") {
            targetScope = "user";
            content = rest;
          } else if (flag === "project") {
            content = rest;
          } else if (flag === "type" || flag === "t") {
            // --type project <text> or --type feedback <text>
            const typeMatch = rest.match(/^(project|feedback)\s+(.*)$/);
            if (typeMatch) {
              explicitType = typeMatch[1];
              content = typeMatch[2].trim();
            }
          }
        }

        // 再次检查是否有 --type 出现在中间位置
        if (!explicitType) {
          const inlineType = content.match(/^--(?:type|t)\s+(project|feedback)\s+(.*)$/);
          if (inlineType) {
            explicitType = inlineType[1];
            content = inlineType[2].trim();
          }
        }

        if (!content) {
          ctx.ui.notify("Usage: /memory add <text>\n  /memory add --user <text>\n  /memory add --type project <text>", "warning");
          return;
        }

        // 类型统一默认 project（交由 AI 调 memory_create 时自行判断，或之后 memory_update 修正）
        const detectedType: "project" | "feedback" = explicitType
          ? (explicitType as "project" | "feedback")
          : "project";

        // 从文本生成条目名
        const nameRaw = content.replace(/[^a-zA-Z0-9\u4e00-\u9fff\u3040-\u30ff]/g, "-").toLowerCase();
        const name = nameRaw.slice(0, 40).replace(/^-+|-+$/g, "") || `note-${Date.now()}`;

        const now = getDateStr();
        const slug = targetScope === "user" ? "" : projectSlug;
        const baseDir = targetScope === "user" ? userDir() : projectDir(slug);
        const indexPath = targetScope === "user" ? userIndexPath() : projectIndexPath(slug);
        const filename = `${name}.md`;
        const filePath = path.join(baseDir, filename);

        // 检查重名
        if (fs.existsSync(filePath)) {
          ctx.ui.notify(`Memory "${name}" already exists. Try: /memory open ${name}`, "warning");
          return;
        }

        // 快速笔记内容，后续 AI 会自动丰富成完整知识条目
        const structuredContent = `${content}

---
*快速笔记，待 AI 后续整理为完整知识条目（补充 Why、How to apply 等上下文）*`;

        const mem: MemoryFile = {
          frontmatter: {
            name,
            description: content,
            type: detectedType,
            tags: [],
            status: "active",
            originSessionId: getSessionId(ctx),
            created_at: now,
          },
          content: structuredContent,
        };
        writeMemoryFile(filePath, mem);

        // 更新索引
        const entries = readOrInitIndex(indexPath);
        entries.push({ name, filename, description: content, tags: [], type: detectedType });
        saveIndex(indexPath, entries);

        ctx.ui.notify(`✅ 已创建记忆：${name} — ${content} (${targetScope}/${detectedType})` +
          `\n💡 AI 后续会自动完善上下文和操作指引`, "info");
        return;
      }

      // /memory clear
      if (trimmed === "clear") {
        const confirm = await ctx.ui.confirm("Clear all memories?", "This permanently deletes all project memory files and index.");
        if (!confirm) {
          ctx.ui.notify("Cancelled.", "info");
          return;
        }

        const pDir = projectDir(projectSlug);
        if (fs.existsSync(pDir)) {
          for (const entry of fs.readdirSync(pDir)) {
            const fp = path.join(pDir, entry);
            if (entry.endsWith(".md") && entry !== "MEMORY.md") fs.unlinkSync(fp);
          }
        }
        saveIndex(projectIndexPath(projectSlug), []);
        ctx.ui.notify("All project memories cleared.", "info");
        return;
      }

      // /memory open <name> — 打开查看（先搜 project，再搜 user）
      if (trimmed.startsWith("open ")) {
        const name = trimmed.slice(5).trim();
        let match = projectEntries.find((e) => e.name === name || e.filename === `${name}.md`);
        let isUser = false;
        if (!match) {
          match = userEntries.find((e) => e.name === name || e.filename === `${name}.md`);
          isUser = true;
        }
        if (!match) {
          ctx.ui.notify(`Memory "${name}" not found. Try /memory search ${name}`, "warning");
          return;
        }
        const baseDir = isUser ? userDir() : projectDir(projectSlug);
        const fp = path.join(baseDir, match.filename);
        const mem = readMemoryFile(fp);
        if (mem) {
          ctx.ui.notify(`📄 ${mem.frontmatter.name} (${mem.frontmatter.type}, ${isUser ? "user" : "project"})\n\n${mem.content.slice(0, 500)}${mem.content.length > 500 ? "..." : ""}`, "info");
        }
        return;
      }

      // Default: /memory — show summary with usage guide
      let summary = "📚 Memory Summary\n";

      if (projectEntries.length > 0) {
        summary += `\nProject (${projectEntries.length}):\n`;
        for (const e of projectEntries) {
          summary += `  [${e.type}] ${e.name} — ${e.description}\n`;
        }
      }
      if (userEntries.length > 0) {
        summary += `\nUser (${userEntries.length}):\n`;
        for (const e of userEntries) {
          summary += `  [${e.type}] ${e.name} — ${e.description}\n`;
        }
      }
      if (projectEntries.length === 0 && userEntries.length === 0) {
        summary += "\n还没有任何记忆。\n";
      }

      summary += "\n━━ 使用方法 ━━\n" +
        "  /memory add <内容>        → 快速记住一条信息\n" +
        "  /memory add --user <内容> → 记为用户级（跨项目）\n" +
        "  /memory search <关键词>   → 搜索记忆\n" +
        "  /memory open <名称>       → 查看完整内容\n" +
        "  /memory clear             → 清除项目记忆\n" +
        "\n💡 也可以直接对 AI 说:\n" +
        "  \"记住我叫小民\"  \"记一下服务器地址是 xxx\"\n" +
        "  AI 会自动调用 memory_create 来保存";

      ctx.ui.notify(summary, "info");
    },
  });
}
