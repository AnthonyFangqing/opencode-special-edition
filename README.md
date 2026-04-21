# opencode-slim

A plugin for [opencode](https://opencode.ai) that dramatically reduces the token count of prompts sent to LLMs, modeled after [pi](https://github.com/mariozechner/pi)'s minimal philosophy.

Modern coding LLMs are heavily fine-tuned on tool-use and coding-agent patterns. They don't need verbose examples, repeated instructions, or long workflows. They need identity, constraints, and tool names — the JSON schema handles the rest.

## What it does

### System prompt

Replaces opencode's ~1300-word default system prompt with a ~75-word version. Preserves the environment info block (model name, cwd, date) and AGENTS.md instructions. Removes the redundant skills section.

### Tool descriptions

Replaces opencode's ~5500-word tool descriptions with ~250-word equivalents. The JSON parameter schemas are still sent in full — the LLM doesn't need prose that restates what the schema already says.

### Savings

| Component | Before | After | Saved |
|---|---|---|---|
| System prompt | ~1800 tokens | ~100 tokens | **~1700** |
| Tool descriptions | ~5500 tokens | ~350 tokens | **~5150** |
| Skills section | ~200 tokens | 0 | **~200** |
| **Total per request** | | | **~7050** |

## Install

Add to your `opencode.jsonc`:

```jsonc
{
  "plugin": ["./path/to/opencode-slim/index.ts"]
}
```

Or install as a local plugin in `.opencode/plugin/`:

```bash
mkdir -p .opencode/plugin
cp -r opencode-slim/ .opencode/plugin/opencode-slim/
```

Then in `opencode.jsonc`:

```jsonc
{
  "plugin": ["./.opencode/plugin/opencode-slim/index.ts"]
}
```

## Customization

If you want to add project-specific rules on top of the slim prompt, use `AGENTS.md` — that's what it's for. The plugin preserves AGENTS.md instructions.

If you want to override the slim prompt entirely with your own, set `agent.build.prompt` in `opencode.jsonc`. The plugin detects custom prompts and leaves them alone.

## What it doesn't touch

- **JSON parameter schemas** — still sent in full for each tool
- **Environment info** — model name, working directory, date are preserved
- **AGENTS.md instructions** — preserved as-is
- **Plan mode reminders** — injected into user messages, not accessible via plugin hooks
- **Compaction/summary/title prompts** — internal prompts for hidden agents
- **MCP tool descriptions** — only opencode's built-in tools are trimmed
