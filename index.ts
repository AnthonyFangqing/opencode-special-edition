import type { Hooks } from "@opencode-ai/plugin"
import { readSlimSystemPrompt, readSlimToolDescriptions } from "./read-content"

/*
 * OpenCode plugin: replace only the default *provider* system text (from
 * prompt/default.txt) and slim built-in tool descriptions (from tool/).
 *
 * The skills block (“Skills provide specialized…”, <available_skills>, etc.)
 * is appended after the env block in the same composed string. We anchor on
 * the env line “You are powered by the model named” and assign
 * slimPrompt + "\n" + text.slice(envIdx) so everything from the env block
 * onward—including skills and AGENTS.md instructions—is kept; we do not strip
 * or rewrite the skills section.
 */

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
          /* Preserve env, skills, and instruction fragments after this marker. */
          output.system[i] = SLIM_SYSTEM_PROMPT + "\n" + text.slice(envIdx)
        } else {
          output.system[i] = SLIM_SYSTEM_PROMPT
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
