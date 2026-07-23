/**
 * Question Tool - Single or multi-select question with options
 * Full custom UI: options list + inline editor for "Type something..."
 * Escape in editor returns to options, Escape in options cancels
 *
 * Multi-select mode (multiple: true):
 *   Space toggles checkbox, Enter confirms all selected options
 *
 * 问题弹出时播放系统提示音，吸引用户注意。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  Editor,
  type EditorTheme,
  Key,
  matchesKey,
  Text,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { execSync } from "node:child_process";

interface OptionWithDesc {
  label: string;
  description?: string;
}

type DisplayOption = OptionWithDesc & { isOther?: boolean };

interface QuestionDetails {
  question: string;
  options: string[];
  answer: string | null;
  wasCustom?: boolean;
  multiple?: boolean;           // true if multi-select
  selectedIndices?: number[];   // 1-based selected indices
}

// Options with labels and optional descriptions
const OptionSchema = Type.Object({
  label: Type.String({ description: "Display label for the option" }),
  description: Type.Optional(
    Type.String({ description: "Optional description shown below label" }),
  ),
});

const QuestionParams = Type.Object({
  question: Type.String({ description: "The question to ask the user" }),
  options: Type.Array(OptionSchema, {
    description: "Options for the user to choose from",
  }),
  multiple: Type.Optional(
    Type.Boolean({ description: "Allow multiple selections (Space to toggle, Enter to confirm)" }),
  ),
});

function playSound() {
  try {
    execSync("afplay /System/Library/Sounds/Frog.aiff", { timeout: 2000 });
  } catch {
    // 静默失败
  }
}

export default function question(pi: ExtensionAPI) {
  pi.registerTool({
    name: "question",
    label: "Question",
    description:
      "Ask the user a question and let them pick from options. Use when you need user input to proceed.",
    promptSnippet:
      "Ask the user a question with options when you need clarification, confirmation, or a decision",
    promptGuidelines: [
      "Use question tool when you need user input, clarification, confirmation, or a decision to proceed",
      "Do NOT guess or make assumptions when you could ask the user via question tool",
      "Provide clear, specific options for the user to choose from",
      "Set multiple: true when the user can pick more than one option",
    ],
    parameters: QuestionParams,
    executionMode: "sequential",

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      // 问题弹出时播放提示音，吸引用户注意
      playSound();

      if (ctx.mode !== "tui") {
        return {
          content: [
            {
              type: "text",
              text: "Error: UI not available (running in non-interactive mode)",
            },
          ],
          details: {
            question: params.question,
            options: params.options.map((o) => o.label),
            answer: null,
          } as QuestionDetails,
        };
      }

      if (params.options.length === 0) {
        return {
          content: [{ type: "text", text: "Error: No options provided" }],
          details: {
            question: params.question,
            options: [],
            answer: null,
          } as QuestionDetails,
        };
      }

      const isMultiple = params.multiple === true;

      const allOptions: DisplayOption[] = [
        ...params.options,
        { label: "Type something.", isOther: true },
      ];

      const result = await ctx.ui.custom<{
        answer: string;
        wasCustom: boolean;
        index?: number;
        multiple?: boolean;
        selectedIndices?: number[];
      } | null>((tui, theme, _kb, done) => {
        let optionIndex = 0;
        let editMode = false;
        let cachedLines: string[] | undefined;

        // Multi-select state
        const selected = new Set<number>();
        let customText = "";

        const editorTheme: EditorTheme = {
          borderColor: (s) => theme.fg("accent", s),
          selectList: {
            selectedPrefix: (t) => theme.fg("accent", t),
            selectedText: (t) => theme.fg("accent", t),
            description: (t) => theme.fg("muted", t),
            scrollInfo: (t) => theme.fg("dim", t),
            noMatch: (t) => theme.fg("warning", t),
          },
        };
        const editor = new Editor(tui, editorTheme);

        editor.onSubmit = (value) => {
          const trimmed = value.trim();
          if (trimmed) {
            if (isMultiple) {
              // In multi-select mode, store the custom text and return to options
              customText = trimmed;
              selected.add(allOptions.length - 1); // mark "Type something." as checked
              editMode = false;
              editor.setText("");
              refresh();
            } else {
              done({ answer: trimmed, wasCustom: true });
            }
          } else {
            editMode = false;
            editor.setText("");
            refresh();
          }
        };

        function refresh() {
          cachedLines = undefined;
          tui.requestRender();
        }

        function handleInput(data: string) {
          if (editMode) {
            if (matchesKey(data, Key.escape)) {
              editMode = false;
              if (isMultiple) {
                // Un-check "Type something." when cancelling custom input
                selected.delete(allOptions.length - 1);
                customText = "";
              }
              editor.setText("");
              refresh();
              return;
            }
            // Alt+Enter to submit (handles custom keybinding where enter=newLine, alt+enter=submit)
            if (matchesKey(data, Key.alt("enter"))) {
              const value = editor.getText().trim();
              if (value) {
                if (isMultiple) {
                  customText = value;
                  selected.add(allOptions.length - 1);
                  editMode = false;
                  editor.setText("");
                  refresh();
                } else {
                  done({ answer: value, wasCustom: true });
                }
              } else {
                editMode = false;
                if (isMultiple) {
                  selected.delete(allOptions.length - 1);
                  customText = "";
                }
                editor.setText("");
                refresh();
              }
              return;
            }
            editor.handleInput(data);
            refresh();
            return;
          }

          if (matchesKey(data, Key.up)) {
            optionIndex = Math.max(0, optionIndex - 1);
            refresh();
            return;
          }
          if (matchesKey(data, Key.down)) {
            optionIndex = Math.min(allOptions.length - 1, optionIndex + 1);
            refresh();
            return;
          }

          if (isMultiple) {
            // --- Multi-select mode ---
            if (matchesKey(data, Key.space)) {
              const opt = allOptions[optionIndex];
              if (opt.isOther) {
                if (selected.has(optionIndex)) {
                  // Uncheck: clear custom text
                  selected.delete(optionIndex);
                  customText = "";
                } else {
                  // Check and open editor
                  selected.add(optionIndex);
                  editMode = true;
                  if (customText) {
                    editor.setText(customText);
                  }
                }
              } else {
                if (selected.has(optionIndex)) {
                  selected.delete(optionIndex);
                } else {
                  selected.add(optionIndex);
                }
              }
              refresh();
              return;
            }

            if (matchesKey(data, Key.enter)) {
              if (selected.size === 0) {
                done(null);
                return;
              }
              // Build sorted selection result
              const selectedLabels: string[] = [];
              const selectedIndices: number[] = [];
              const sorted = [...selected].sort((a, b) => a - b);
              for (const idx of sorted) {
                const opt = allOptions[idx];
                if (opt.isOther && customText) {
                  selectedLabels.push(customText);
                } else {
                  selectedLabels.push(opt.label);
                }
                selectedIndices.push(idx + 1); // 1-based
              }
              const answer = selectedLabels.join(", ");
              done({
                answer,
                wasCustom: false,
                index: selectedIndices[0] || 0,
                multiple: true,
                selectedIndices,
              });
              return;
            }
          } else {
            // --- Single-select mode ---
            if (matchesKey(data, Key.enter)) {
              const selected = allOptions[optionIndex];
              if (selected.isOther) {
                editMode = true;
                refresh();
              } else {
                done({
                  answer: selected.label,
                  wasCustom: false,
                  index: optionIndex + 1,
                });
              }
              return;
            }
          }

          if (matchesKey(data, Key.escape)) {
            done(null);
          }
        }

        function render(width: number): string[] {
          if (cachedLines) return cachedLines;

          const lines: string[] = [];
          const renderWidth = Math.max(1, width);

          function addWrapped(text: string) {
            lines.push(...wrapTextWithAnsi(text, renderWidth));
          }

          function addWrappedWithPrefix(prefix: string, text: string) {
            const prefixWidth = visibleWidth(prefix);
            if (prefixWidth >= renderWidth) {
              addWrapped(prefix + text);
              return;
            }
            const wrapped = wrapTextWithAnsi(text, renderWidth - prefixWidth);
            const continuationPrefix = " ".repeat(prefixWidth);
            for (let i = 0; i < wrapped.length; i++) {
              lines.push(
                `${i === 0 ? prefix : continuationPrefix}${wrapped[i]}`,
              );
            }
          }

          lines.push(theme.fg("accent", "─".repeat(renderWidth)));
          addWrappedWithPrefix(" ", theme.fg("text", params.question));
          lines.push("");

          for (let i = 0; i < allOptions.length; i++) {
            const opt = allOptions[i];
            const isCurrent = i === optionIndex;
            const isOther = opt.isOther === true;

            if (isMultiple) {
              // Multi-select: checkbox style
              const checked = selected.has(i);
              const checkbox = checked
                ? theme.fg("accent", "[✓]")
                : theme.fg("dim", "[ ]");
              const pointer = isCurrent ? theme.fg("accent", "›") : " ";
              const labelBase = `${i + 1}. ${opt.label}`;
              // For "Type something." that has been filled, show ✎ with custom text
              let label = labelBase;
              if (isOther && checked && customText) {
                label += theme.fg("accent", " ✎") + theme.fg("muted", ` ${customText}`);
              } else if (isOther && checked && editMode) {
                label += theme.fg("accent", " ✎");
              }
              const color = isCurrent || (isOther && checked) ? "accent" : "text";
              const prefix = `${pointer} ${checkbox} `;
              addWrappedWithPrefix(prefix, theme.fg(color, label));

              if (opt.description) {
                addWrappedWithPrefix("    ", theme.fg("muted", opt.description));
              }
            } else {
              // Single-select: pointer style
              const pointer = isCurrent ? theme.fg("accent", "> ") : "  ";
              const label = `${i + 1}. ${opt.label}${isOther && editMode ? " ✎" : ""}`;
              const color = isCurrent || (isOther && editMode) ? "accent" : "text";

              addWrappedWithPrefix(pointer, theme.fg(color, label));

              if (opt.description) {
                addWrappedWithPrefix("     ", theme.fg("muted", opt.description));
              }
            }
          }

          if (editMode) {
            lines.push("");
            addWrappedWithPrefix(" ", theme.fg("muted", "Your answer:"));
            for (const line of editor.render(Math.max(1, renderWidth - 2))) {
              lines.push(` ${line}`);
            }
          }

          lines.push("");
          if (editMode) {
            addWrappedWithPrefix(
              " ",
              theme.fg("dim", "Enter to submit • Esc to go back"),
            );
          } else if (isMultiple) {
            addWrappedWithPrefix(
              " ",
              theme.fg("dim", "↑↓ navigate • Space to toggle • Enter to confirm • Esc to cancel"),
            );
          } else {
            addWrappedWithPrefix(
              " ",
              theme.fg("dim", "↑↓ navigate • Enter to select • Esc to cancel"),
            );
          }
          lines.push(theme.fg("accent", "─".repeat(renderWidth)));

          cachedLines = lines;
          return lines;
        }

        return {
          render,
          invalidate: () => {
            cachedLines = undefined;
          },
          handleInput,
        };
      });

      // Build simple options list for details
      const simpleOptions = params.options.map((o) => o.label);

      if (!result) {
        return {
          content: [{ type: "text", text: "User cancelled the selection" }],
          details: {
            question: params.question,
            options: simpleOptions,
            answer: null,
          } as QuestionDetails,
        };
      }

      if (result.wasCustom) {
        return {
          content: [{ type: "text", text: `User wrote: ${result.answer}` }],
          details: {
            question: params.question,
            options: simpleOptions,
            answer: result.answer,
            wasCustom: true,
          } as QuestionDetails,
        };
      }

      if (result.multiple) {
        const indices = result.selectedIndices || [];
        const labels = result.answer ? result.answer.split(", ") : [];
        const summary = indices.map((idx, i) => `${idx}. ${labels[i] || ""}`).join(", ");
        return {
          content: [
            { type: "text", text: `User selected: ${summary}` },
          ],
          details: {
            question: params.question,
            options: simpleOptions,
            answer: result.answer,
            wasCustom: false,
            multiple: true,
            selectedIndices: result.selectedIndices,
          } as QuestionDetails,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `User selected: ${result.index}. ${result.answer}`,
          },
        ],
        details: {
          question: params.question,
          options: simpleOptions,
          answer: result.answer,
          wasCustom: false,
        } as QuestionDetails,
      };
    },

    renderCall(args, theme, _context) {
      let text =
        theme.fg("toolTitle", theme.bold("question ")) +
        theme.fg("muted", args.question);
      const opts = Array.isArray(args.options) ? args.options : [];
      if (opts.length) {
        const labels = opts.map((o: OptionWithDesc) => o.label);
        const numbered = [...labels, "Type something."].map(
          (o, i) => `${i + 1}. ${o}`,
        );
        text += `\n${theme.fg("dim", `  Options: ${numbered.join(", ")}`)}`;
      }
      if (args.multiple) {
        text += `\n${theme.fg("dim", "  [multi-select]")}`;
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as QuestionDetails | undefined;
      if (!details) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }

      if (details.answer === null) {
        return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      }

      if (details.wasCustom) {
        return new Text(
          theme.fg("success", "✓ ") +
            theme.fg("muted", "(wrote) ") +
            theme.fg("accent", details.answer),
          0,
          0,
        );
      }

      if (details.multiple) {
        const indices = details.selectedIndices || [];
        const parts = details.answer ? details.answer.split(", ") : [];
        const items = indices.map((idx, i) =>
          theme.fg("accent", `${idx}`) + theme.fg("dim", ".") + theme.fg("text", parts[i] || "")
        );
        const display = items.join(theme.fg("dim", ", "));
        return new Text(
          theme.fg("success", "✓ ") + display,
          0,
          0,
        );
      }

      const idx = details.options.indexOf(details.answer) + 1;
      const display = idx > 0 ? `${idx}. ${details.answer}` : details.answer;
      return new Text(
        theme.fg("success", "✓ ") + theme.fg("accent", display),
        0,
        0,
      );
    },
  });
}
