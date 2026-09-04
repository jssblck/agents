---
name: computer-and-browser
description: Choose supported tools for browser or desktop work, including signed-in sites, existing tabs, SSO, native apps, and visual interaction. Preserve the user's chosen browser, profile, and target.
---

# Computer and browser

Choose the surface the task needs, then use the supported interface available
in this session. Follow current tool documentation rather than assuming an API
from the harness name. Do not run competing controllers on the same target.

## Choose the surface

- Use an isolated browser for localhost, disposable testing, or a fresh session
  when the task does not need the user's existing login.
- Use the user's signed-in browser for existing tabs, SSO, or state that must be
  reproduced in that profile. Honor browser and tab mentions.
- Use native-app control for OS dialogs, menu bars, or desktop applications.
- Prefer supported DOM or accessibility controls when useful. Use visual
  interaction for canvas content or interfaces those controls cannot expose.

Prefer a purpose-built connector or API when it fulfills the request without
losing the state or UI behavior the user wants to inspect.

## Choose the available interface

Discover available tools before selecting a runtime. Read that interface's
documentation and initial state before acting.

- When unified computer-use tools such as `mcp__cua_repl__js` are available,
  use their documented browser or app entry point. Follow their first-call
  instructions exactly.
- When the session instead exposes a browser plugin through a JavaScript REPL,
  follow that plugin's current setup instructions. Do not guess an import path,
  runtime object, or method from an older plugin version.
- A harness-provided Chrome extension can control the signed-in profile. Read
  its tab inventory and ownership rules before attaching.
- Use the bundled Agent Browser MCP when no suitable host interface is available
  and that MCP is connected.
- Use Peekaboo for native UI when it is the available supported interface. Start
  with `see` and act on the resulting element IDs.

Missing tools do not establish that a restart is needed. Check discovery and the
documented connection or setup state. Report the missing capability; recommend
a restart only when the host documentation or diagnostics supports it.

## Bundled Agent Browser

This skill ships `extension/`, `native-host/bridge.mjs`, and
`mcp/agent-browser.mjs`. Chrome starts the native host, which connects agent
sessions. Runtime state is under `~/.agents/browser/`.

Discover the MCP tools and call `status` first. If disconnected or stale, check
whether Chrome has loaded the unpacked extension and ask the user to reload it
when needed. Use `open` with a short task label or `attach` to an unowned tab.

Each session owns one tab in an `Agent: <label>` tab group. The tab inventory
marks ownership; do not attach to another agent's tab. When a session ends, its
tab is released and left open. The debugger banner clears after inactivity.

For requested setup, register the MCP server at the installed path:

```json
{ "mcpServers": { "agent-browser": { "command": "node", "args": ["/Users/<you>/.agents/skills/computer-and-browser/mcp/agent-browser.mjs"] } } }
```

The server refreshes native messaging manifests on startup. For manifest-only
setup, run `node <skill>/mcp/agent-browser.mjs install`. Load `extension/` as an
unpacked extension in Chrome. Reload it after extension or native-host updates.

Do not use `chrome-devtools --autoConnect` or hangwin `chrome-mcp-server` on this
machine; they are not the configured browser stack.

## Peekaboo setup

When Peekaboo is the chosen interface, use
`peekaboo permissions status --no-remote` to diagnose missing permissions.
Screen Recording, Accessibility, and Event Synthesizing belong to Peekaboo
(`boo.peekaboo.peekaboo`), not Terminal.

## Action boundaries

Actions in a signed-in browser affect the real account. Perform writes only
within the user's authorization. Ask when an action, destination, or commitment
is unclear; do not ask again merely because an already-requested action uses UI.

Leave the user's other tabs alone. Do not copy cookies, credentials, or profile
files into another client. Use the supported login flow when authentication is
needed.

Do not grant Peekaboo foreground cursor control (`move`, `drag`, or untargeted
`scroll`) unless the user requested it.
