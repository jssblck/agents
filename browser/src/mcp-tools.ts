import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { HostPool } from "./hosts.ts";
import { mcpSessionId } from "./mcp-session.ts";
import { formatPickContext, PICK_TIMEOUT_MS } from "./pick.ts";
import { cancelPickInSession, pickFromSession } from "./pick-session.ts";
import type { PickStore } from "./picks.ts";
import { normalizeUrl } from "./url.ts";

const MAX_EXTRACT_CHARS = 200_000;
/** Page loads wait up to 30s inside the extension; give the round trip room. */
const LOAD_TIMEOUT_MS = 40_000;
const sessionField = z
  .string()
  .optional()
  .describe("Session name. Defaults to this process, which is one per agent.");
const labelField = z
  .string()
  .optional()
  .describe("Short name shown on this session's tab group, such as the task");

export interface McpToolRuntime {
  hosts: HostPool;
  picks: PickStore;
  /** Version in the bundled extension manifest, to spot a stale loaded copy. */
  expectedVersion: string;
}

export interface TabSummary {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
  active: boolean;
  loading: boolean;
  /** Session that holds this tab, if any. */
  session: string | null;
}


type ToolContent = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

function ok(text: string, extra: ToolContent[] = []) {
  return { content: [{ type: "text" as const, text }, ...extra] };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

function clip(value: string): string {
  if (value.length <= MAX_EXTRACT_CHARS) return value;
  return `${value.slice(0, MAX_EXTRACT_CHARS)}\n\n[truncated at ${MAX_EXTRACT_CHARS} characters of ${value.length}]`;
}

function formatTab(tab: TabSummary, session: string): string {
  const owner =
    tab.session === null ? "" : tab.session === session ? "  [yours]" : `  [agent: ${tab.session}]`;
  return `${tab.active ? "*" : " "} ${tab.tabId}  ${tab.title || tab.url}${owner}\n    ${tab.url}`;
}

export function registerMcpTools(server: McpServer, runtime: McpToolRuntime): void {
  const { hosts, picks, expectedVersion } = runtime;

  const withTab = async (session: string | undefined) => {
    const sessionKey = mcpSessionId(session);
    const connection = await hosts.primary();
    return { sessionKey, connection };
  };

  server.registerTool(
    "status",
    {
      description: "Show whether Chrome is connected and which tab this session drives",
      inputSchema: { session: sessionField },
    },
    async ({ session }) => {
      try {
        const sessionKey = mcpSessionId(session);
        const connections = await hosts.refresh();
        const primary = connections[0];
        const tab = primary
          ? (await primary.request<{ tab: TabSummary | null }>("session.status", { session: sessionKey })).tab
          : null;
        const stale = connections.filter((connection) => connection.version !== expectedVersion);
        return ok(
          JSON.stringify(
            {
              connected: connections.length > 0,
              browsers: connections.map((connection) => ({
                id: connection.id,
                version: connection.version,
              })),
              sessionKey,
              tab,
              ...(connections.length === 0
                ? { hint: "Open Chrome with the Agent Browser extension enabled, or reload it from chrome://extensions." }
                : stale.length
                  ? { hint: `The extension is ${stale[0].version} but this server expects ${expectedVersion}. Reload it from chrome://extensions.` }
                  : {}),
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "tabs",
    {
      description: "List every tab open in the user's Chrome",
      inputSchema: { session: sessionField },
    },
    async ({ session }) => {
      try {
        const sessionKey = mcpSessionId(session);
        const connection = await hosts.primary();
        const { tabs } = await connection.request<{ tabs: TabSummary[] }>("tabs.list");
        if (tabs.length === 0) return ok("No open tabs.");
        return ok(tabs.map((tab) => formatTab(tab, sessionKey)).join("\n"));
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "open",
    {
      description:
        "Open or navigate this session's tab. Creates and claims a background tab in this session's tab group when none is bound.",
      inputSchema: {
        url: z.string().min(1),
        show: z.boolean().optional(),
        label: labelField,
        session: sessionField,
      },
    },
    async ({ url, show, label, session }) => {
      try {
        const { sessionKey, connection } = await withTab(session);
        const tab = await connection.request<TabSummary>(
          "session.open",
          { session: sessionKey, url: normalizeUrl(url), active: show === true, label },
          LOAD_TIMEOUT_MS,
        );
        return ok(`Tab ${tab.tabId}: ${tab.url}`);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "attach",
    {
      description:
        "Claim one of the user's existing tabs for this session. Fails if another agent holds it.",
      inputSchema: { tabId: z.number().int(), label: labelField, session: sessionField },
    },
    async ({ tabId, label, session }) => {
      try {
        const { sessionKey, connection } = await withTab(session);
        const tab = await connection.request<TabSummary>("session.attach", {
          session: sessionKey,
          tabId,
          label,
        });
        return ok(`Attached to tab ${tab.tabId}: ${tab.url}`);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "release",
    {
      description: "Let go of this session's tab, leaving it open for the user",
      inputSchema: { session: sessionField },
    },
    async ({ session }) => {
      try {
        const { sessionKey, connection } = await withTab(session);
        const { released } = await connection.request<{ released: number | null }>(
          "session.release",
          { session: sessionKey },
        );
        return ok(released === null ? "No tab was bound." : `Released tab ${released}.`);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "close",
    {
      description: "Close this session's tab",
      inputSchema: { session: sessionField },
    },
    async ({ session }) => {
      try {
        const { sessionKey, connection } = await withTab(session);
        const { closed } = await connection.request<{ closed: number | null }>("session.close", {
          session: sessionKey,
        });
        return ok(closed === null ? "No tab was bound." : `Closed tab ${closed}.`);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "show",
    {
      description: "Bring this session's tab to the front",
      inputSchema: { session: sessionField },
    },
    async ({ session }) => {
      try {
        const { sessionKey, connection } = await withTab(session);
        const tab = await connection.request<TabSummary>("session.show", { session: sessionKey });
        return ok(`Showing ${tab.url}`);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "reload",
    {
      description: "Reload this session's tab",
      inputSchema: { session: sessionField },
    },
    async ({ session }) => {
      try {
        const { sessionKey, connection } = await withTab(session);
        const tab = await connection.request<TabSummary>(
          "session.reload",
          { session: sessionKey },
          LOAD_TIMEOUT_MS,
        );
        return ok(`Reloaded ${tab.url}`);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "text",
    {
      description: "Print the rendered text of this session's tab",
      inputSchema: { session: sessionField },
    },
    async ({ session }) => {
      try {
        const { sessionKey, connection } = await withTab(session);
        const result = await connection.request<{ text?: string }>("page.text", { session: sessionKey });
        return ok(clip(String(result.text ?? "")));
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "html",
    {
      description: "Print the HTML of this session's tab",
      inputSchema: { session: sessionField },
    },
    async ({ session }) => {
      try {
        const { sessionKey, connection } = await withTab(session);
        const result = await connection.request<{ html?: string }>("page.html", { session: sessionKey });
        return ok(clip(String(result.html ?? "")));
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "eval",
    {
      description: "Evaluate a JavaScript expression in this session's tab",
      inputSchema: { expression: z.string().min(1), session: sessionField },
    },
    async ({ expression, session }) => {
      try {
        const { sessionKey, connection } = await withTab(session);
        const { value } = await connection.request<{ value: unknown }>("page.eval", {
          session: sessionKey,
          expression,
        });
        return ok(typeof value === "string" ? value : JSON.stringify(value, null, 2));
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "click",
    {
      description: "Click the first element matching a CSS selector",
      inputSchema: { selector: z.string().min(1), session: sessionField },
    },
    async ({ selector, session }) => {
      try {
        const { sessionKey, connection } = await withTab(session);
        await connection.request("input.click", { session: sessionKey, selector });
        return ok(`Clicked ${selector}`);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "type",
    {
      description: "Type text into the element matching a CSS selector",
      inputSchema: {
        selector: z.string().min(1),
        text: z.string(),
        submit: z.boolean().optional(),
        session: sessionField,
      },
    },
    async ({ selector, text, submit, session }) => {
      try {
        const { sessionKey, connection } = await withTab(session);
        await connection.request("input.type", {
          session: sessionKey,
          selector,
          text,
          submit: submit === true,
        });
        return ok(`Typed ${text.length} characters into ${selector}`);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "press",
    {
      description: "Press a key such as Enter, Tab, Escape, or ArrowDown",
      inputSchema: { key: z.string().min(1), session: sessionField },
    },
    async ({ key, session }) => {
      try {
        const { sessionKey, connection } = await withTab(session);
        await connection.request("input.press", { session: sessionKey, key });
        return ok(`Pressed ${key}`);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "scroll",
    {
      description: "Scroll the page down, or up when up is true",
      inputSchema: {
        up: z.boolean().optional(),
        amount: z.number().optional(),
        session: sessionField,
      },
    },
    async ({ up, amount, session }) => {
      try {
        const pixels = amount ?? 600;
        const { sessionKey, connection } = await withTab(session);
        await connection.request("input.scroll", {
          session: sessionKey,
          deltaY: up === true ? -pixels : pixels,
        });
        return ok(up === true ? `Scrolled up ${pixels}px` : `Scrolled down ${pixels}px`);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "wait",
    {
      description: "Wait until a CSS selector matches something on the page",
      inputSchema: {
        selector: z.string().min(1),
        timeoutMs: z.number().optional(),
        session: sessionField,
      },
    },
    async ({ selector, timeoutMs, session }) => {
      try {
        const timeout = timeoutMs ?? 10_000;
        const { sessionKey, connection } = await withTab(session);
        await connection.request(
          "page.wait",
          { session: sessionKey, selector, timeoutMs: timeout },
          timeout + 5_000,
        );
        return ok(`Found ${selector}`);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "screenshot",
    {
      description:
        "Capture this session's tab as a PNG. Optionally write it to a local path.",
      inputSchema: {
        path: z.string().optional(),
        fullPage: z.boolean().optional(),
        session: sessionField,
      },
    },
    async ({ path, fullPage, session }) => {
      try {
        const { sessionKey, connection } = await withTab(session);
        const { data } = await connection.request<{ data: string }>("page.screenshot", {
          session: sessionKey,
          fullPage: fullPage === true,
        });
        const image = { type: "image" as const, data, mimeType: "image/png" };
        if (!path) return ok("Captured screenshot.", [image]);
        const target = isAbsolute(path) ? path : resolve(process.cwd(), path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, Buffer.from(data, "base64"));
        return ok(`Wrote ${target}`, [image]);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "pick",
    {
      description:
        "Wait for the user to click an element in this session's tab, then return its context",
      inputSchema: {
        timeoutMs: z.number().optional(),
        session: sessionField,
      },
    },
    async ({ timeoutMs, session }) => {
      try {
        const { pick, label } = await pickFromSession(
          { hosts, picks },
          mcpSessionId(session),
          timeoutMs ?? PICK_TIMEOUT_MS,
        );
        return ok(`Picked ${label}\n\n${formatPickContext(pick)}`);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "pick_cancel",
    {
      description: "Cancel an in-progress pick on this session's tab",
      inputSchema: { session: sessionField },
    },
    async ({ session }) => {
      try {
        await cancelPickInSession({ hosts, picks }, mcpSessionId(session));
        return ok("Cancelled the in-page picker.");
      } catch (error) {
        return fail(error);
      }
    },
  );
}
