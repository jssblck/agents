# agents

Jess's agent skills, one directory per skill, in the
[Agent Skills](https://agentskills.io/specification) format.

Project skills live under `skills/`. Install into a project (writes
`.agents/skills/`, links `.claude/skills/`, records `skills-lock.json`):

```sh
npx skills add jssblck/agents -a claude-code -a codex -y
```

Machine skills live under `machine/`. Install them once per machine:

```sh
npx skills add jssblck/agents/machine -a claude-code -a codex -g -y
```

## Agent Browser

`machine/computer-and-browser/` ships an MCP server and Chrome extension that
let any harness drive the user's signed-in Chrome, many agents at once. Chrome
starts the native host, which is the hub; each agent's MCP process dials it
over `~/.agents/browser/hosts/host-<pid>.sock` and owns one tab in its own
tab group. The extension and native host are plain JS in the skill directory;
`mcp/agent-browser.mjs` is a bundle built from `browser/`:

```sh
cd browser && bun install && bun run build   # rewrites machine/computer-and-browser/mcp/agent-browser.mjs
bun run check                                # fails if the committed bundle is stale
```

Commit the bundle with the source change. See the skill's SKILL.md for setup.
