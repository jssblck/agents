---
name: computer-and-browser
description: >
  Route desktop and browser work across an isolated browser, the harness's own
  Chrome extension (Claude in Chrome, the Codex Chrome plugin, or the bundled
  Agent Browser MCP) on the signed-in Chrome profile, and Peekaboo computer
  use. Use when the user asks for computer use, desktop control, existing
  Chrome, signed-in browser, SSO, live tab takeover, screenshot-and-click, or
  /computer-and-browser.
---

# Computer and browser

Three surfaces. Pick one. Do not stack them on the same target.

## Choose

| Task | Surface |
| --- | --- |
| Isolated or sandboxed browser, localhost, device width, recording | That harness's built-in browser tools, if present |
| Signed-in site, existing tab, SSO, 2FA, live Chrome bug | That harness's own Chrome extension; `agent-browser` from a harness without one |
| Native app, OS dialog, menu bar, canvas, or no DOM | `peekaboo` |

When the work needs the user's real Chrome, use the extension that belongs to the harness you are running in:

- Claude Code: `claude-in-chrome` (`mcp__claude-in-chrome__*`). Load the tools with one `ToolSearch` select call, then `tabs_context_mcp` before anything else.
- Codex: the Codex Chrome plugin, driven through `mcp__node_repl__js` (no `browser_*` tools). Import `setupBrowserRuntime` from the plugin's `scripts/browser-client.mjs`, `agent.browsers.get("chrome")`, read `chrome.documentation()`, then `chrome.user.openTabs()` before touching tabs.
- Any harness without its own extension: `agent-browser`, the MCP server that ships in this skill.

Do not reach for `agent-browser` from Claude Code or Codex when their own extension is available. Only one extension should drive a tab at a time.

For `agent-browser`, discover tools with `search_tool` (`agent-browser`, `status`, `tabs`, `open`). This is the Agent Browser extension in Chrome: same profile, cookies, and logins, no Chrome Allow dialog. Call `status` first. If nothing is connected, tell the user to reload the unpacked Agent Browser extension (`chrome://extensions`). Then `open` a URL or `attach` an existing tab. Later commands act on that session's tab.

Use `peekaboo` for desktop UI. Call `see` first. Act on element IDs from that snapshot. Do not screenshot-click a webpage that still has a DOM snapshot.

Do not use `chrome-devtools` `--autoConnect`. Do not use hangwin `chrome-mcp-server`. Both are the wrong stack on this machine.

## Setup that blocks the tools

`agent-browser` lives in this skill directory: `extension/` (unpacked MV3 extension), `native-host/bridge.mjs`, and `mcp/agent-browser.mjs` (a single-file MCP server, no install step). Runtime state is under `~/.agents/browser/`.

Register the MCP server once per harness. From a global install the path is `~/.agents/skills/computer-and-browser/mcp/agent-browser.mjs`:

```json
{ "mcpServers": { "agent-browser": { "command": "node", "args": ["/Users/<you>/.agents/skills/computer-and-browser/mcp/agent-browser.mjs"] } } }
```

The server refreshes the native messaging manifests on every start. To do only that, run `node .../mcp/agent-browser.mjs install`. Load the extension once by hand: open `chrome://extensions`, turn on Developer mode, choose Load unpacked, and pick this skill's `extension/`. The key in the manifest pins its id, so the folder can move. If `status` stays disconnected, reload the extension. If two `agent-browser` processes run, whichever started last owns the socket.

Peekaboo needs Screen Recording, Accessibility, and (for some clicks) Event Synthesizing granted to Peekaboo (`boo.peekaboo.peekaboo`), not Terminal. Check with `peekaboo permissions status --no-remote`.

If `agent-browser` or `peekaboo` tools are missing, this session started before the user MCP config loaded. Start a new session in the same harness.

## Safety

Every Chrome extension here acts in the user's signed-in Chrome. A wrong click is a real action. Ask before sending mail, submitting a form, buying something, or entering credentials. Leave the user's own tabs alone unless you attach to one on purpose.

Do not grant Peekaboo foreground cursor control (`move`, `drag`, or untargeted `scroll`) unless the user asked for it.
