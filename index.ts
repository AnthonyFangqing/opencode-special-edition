import type { Hooks } from "@opencode-ai/plugin"
import { readSlimSystemPrompt, readSlimToolDescriptions } from "./read-content"

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
// Prompt text lives under prompt/; tool blurbs under tool/ — same idea as
// opencode's session/prompt/*.txt and src/tool/*.txt.
// ────────────────────────────────────────────────────────────────────────────

const SLIM_SYSTEM_PROMPT = readSlimSystemPrompt()
const SLIM_TOOLS = readSlimToolDescriptions()

export default async function plugin(): Promise<Hooks> {
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      for (let i = 0; i < output.system.length; i++) {
        const text = output.system[i]

        const envMarker = "You are powered by the model named"
        const envIdx = text.indexOf(envMarker)

        const isDefaultPrompt =
          text.includes("best coding agent on the planet") ||
          text.includes("opencode, an interactive CLI tool") ||
          text.includes("opencode, an agent") ||
          text.includes("expert AI programming assistant") ||
          text.includes("interactive general AI agent") ||
          text.includes("deeply pragmatic") ||
          text.includes("share the same workspace")

        if (!isDefaultPrompt) continue

        if (envIdx !== -1) {
          output.system[i] = SLIM_SYSTEM_PROMPT + "\n" + text.slice(envIdx)
        } else {
          output.system[i] = SLIM_SYSTEM_PROMPT
        }

        const skillsIdx = output.system[i].indexOf("Skills provide specialized instructions")
        if (skillsIdx !== -1) {
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

    "tool.definition": async (input, output) => {
      const slim = SLIM_TOOLS[input.toolID]
      if (slim) {
        output.description = slim
      }
    },
  }
}
