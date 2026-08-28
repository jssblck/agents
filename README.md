# agents

Jess's agent skills, one directory per skill, in the
[Agent Skills](https://agentskills.io/specification) format.

Project skills live under `skills/`. Machine skills live under `machine/`.

```sh
./install -g   # replace ~/.agents/skills and ~/.claude/skills with this repo
./install      # sync project skills into the current repo; keep the project's own
```

`-g` deletes the user-level skill directories, then installs both packs globally.

Without `-g`, installs the project pack into the current directory (`.agents/skills/`, linked from `.claude/skills/`, recorded in `skills-lock.json`). Copies of skills this repo has deleted are removed when git does not track them. Project-owned skills and installs from other sources stay.

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
