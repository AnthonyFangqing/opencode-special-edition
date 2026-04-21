import type { Hooks } from "@opencode-ai/plugin"

// ────────────────────────────────────────────────────────────────────────────
// opencode-slim — minimal prompt plugin for opencode
//
// Philosophy (modeled after pi): modern coding LLMs are heavily fine-tuned on
// tool-use and coding-agent patterns. They don't need verbose examples,
// repeated instructions, or long workflows spelled out. They need:
//   1. Identity + role
//   2. Critical behavioral constraints (safety, permissions)
//   3. Tool names + one-line descriptions (the JSON schema already defines params)
//   4. Project context (AGENTS.md etc — handled outside this plugin)
//
// Everything else is removed or dramatically shortened.
// ────────────────────────────────────────────────────────────────────────────

// ── Slim system prompt ──────────────────────────────────────────────────────

const SLIM_SYSTEM_PROMPT = `You are a coding agent. Help the user with software engineering tasks using the tools available.

Rules:
- Be concise. No preamble, no postamble, no explanations unless asked.
- Follow existing code conventions. Check before assuming a library is available.
- Only commit when explicitly asked. Never force-push or amend unless asked.
- Use tools in parallel when calls are independent.
- Don't add comments unless asked.
- When referencing code, use file:line format.`

// ── Slim tool descriptions ─────────────────────────────────────────────────
//
// These replace the verbose multi-paragraph descriptions opencode ships by
// default. The JSON schema for each tool's parameters is still sent in full —
// the LLM doesn't need prose that restates what the schema already says.

const SLIM_TOOLS: Record<string, string> = {
  bash: `Execute a bash command. Output truncates after 2000 lines/50KB; full output saved to a temp file. Use workdir param instead of cd chains. Avoid for file ops — use Read/Write/Edit/Glob/Grep instead. Only commit when the user asks.`,

  read: `Read a file or directory. Supports text (with offset/limit), images, and PDFs. Use glob/grep to find files first if you don't know the exact path.`,

  edit: `Replace exact strings in a file. oldString must be unique in the file. For multiple edits to the same file, use multiedit. You must have read the file first.`,

  write: `Create or overwrite a file. You must have read the file first if it exists. Prefer edit over write for existing files.`,

  glob: `Find files by glob pattern (e.g. "**/*.ts"). Returns paths sorted by mtime. Respects .gitignore.`,

  grep: `Search file contents with regex. Returns matching file paths and line numbers. Respects .gitignore. Prefer over bash grep.`,

  multiedit: `Multiple edits to one file in a single call. Edits apply sequentially — later edits see the result of earlier ones. All must succeed or none apply.`,

  "apply_patch": `Apply a patch using a stripped-down diff format. Preferred for GPT models. Use the *** Add/Delete/Update File headers.`,

  task: `Launch a sub-agent. Provide a detailed prompt with all context. Use for complex multi-step work or codebase exploration. Launch multiple in parallel when independent.`,

  todowrite: `Create and manage a task list. Use for 3+ step tasks. States: pending, in_progress, completed. Mark completed immediately. Only one in_progress at a time.`,

  webfetch: `Fetch content from a URL. Returns markdown by default. If redirected to a different host, re-fetch the redirect URL.`,

  websearch: `Web search. Returns relevant results with content. Use for current information beyond training data.`,

  codesearch: `Code search via Exa API. Returns documentation and code examples for libraries, SDKs, and APIs.`,

  skill: `Load a skill when the task matches its description. Injects the skill's instructions into the conversation.`,

  question: `Ask the user a clarifying question. Use when truly blocked — not for "should I proceed?" questions.`,

  lsp: `LSP operations: goToDefinition, findReferences, hover, documentSymbol, workspaceSymbol, goToImplementation, call hierarchy. Requires an LSP server for the file type.`,

  plan: `Switch to plan mode. Use for complex tasks that benefit from planning before implementation.`,
}

// ── Plugin ──────────────────────────────────────────────────────────────────

export default async function plugin(): Promise<Hooks> {
  return {
    // ── System prompt ──────────────────────────────────────────────────────
    //
    // Replace the entire base prompt (anthropic.txt / gpt.txt / etc.) with
    // our minimal one. The system array at this point contains:
    //   [0] = base prompt (from provider-specific .txt file)
    //   [1] = environment info (model name, cwd, date, etc.)
    //   [2+] = skills, instructions from AGENTS.md, etc.
    //
    // We only replace [0] — the environment info and project instructions
    // are dynamic and valuable, so we keep them.

    "experimental.chat.system.transform": async (_input, output) => {
      // opencode joins all system parts into one string before this hook fires:
      //   system[0] = base_prompt + "\n" + env_info + "\n" + skills + "\n" + instructions
      //
      // We need to surgically replace the base prompt portion while keeping
      // the environment info and AGENTS.md instructions (which are dynamic
      // and valuable). The skills section is removed since the skill tool
      // already provides that info.

      for (let i = 0; i < output.system.length; i++) {
        const text = output.system[i]

        // The joined system string looks like:
        //   [base prompt]\n[env info]\n[skills]\n[instructions]
        //
        // The env block starts with "You are powered by the model named".
        // Everything before that is the base prompt we want to replace.
        //
        // We only replace if the base prompt is one of opencode's default
        // prompts (identified by known signatures). If the user has set
        // agent.build.prompt to their own custom prompt, we leave it alone.

        const envMarker = "You are powered by the model named"
        const envIdx = text.indexOf(envMarker)

        // Heuristics for detecting default opencode prompts
        // (matches first-line or near-first-line text from each .txt file)
        const isDefaultPrompt =
          text.includes("best coding agent on the planet") ||   // anthropic.txt, codex.txt
          text.includes("opencode, an interactive CLI tool") ||  // default.txt, trinity.txt
          text.includes("opencode, an agent") ||                // beast.txt
          text.includes("expert AI programming assistant") ||   // copilot-gpt-5.txt
          text.includes("interactive general AI agent") ||       // kimi.txt
          text.includes("deeply pragmatic") ||                  // gemini.txt
          text.includes("share the same workspace")            // gpt.txt

        if (!isDefaultPrompt) continue

        if (envIdx !== -1) {
          // Replace everything from the start up to the env block
          output.system[i] = SLIM_SYSTEM_PROMPT + "\n" + text.slice(envIdx)
        } else {
          // No env block found — shouldn't normally happen but handle it
          output.system[i] = SLIM_SYSTEM_PROMPT
        }

        // Strip the skills section — it's redundant with the skill tool
        const skillsIdx = output.system[i].indexOf("Skills provide specialized instructions")
        if (skillsIdx !== -1) {
          // The skills section runs from this marker to either the next
          // "Instructions from:" line or end of string.
          const instructionsIdx = output.system[i].indexOf("Instructions from:", skillsIdx)
          if (instructionsIdx !== -1) {
            output.system[i] =
              output.system[i].slice(0, skillsIdx) + output.system[i].slice(instructionsIdx)
          } else {
            output.system[i] = output.system[i].slice(0, skillsIdx)
          }
        }
      }
    },

    // ── Tool descriptions ──────────────────────────────────────────────────
    //
    // Replace verbose multi-paragraph tool descriptions with one-liners.
    // The JSON schema for parameters is still sent in full, so the LLM
    // already knows what params each tool accepts.

    "tool.definition": async (input, output) => {
      const slim = SLIM_TOOLS[input.toolID]
      if (slim) {
        output.description = slim
      }
    },
  }
}
