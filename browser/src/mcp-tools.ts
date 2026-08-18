import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { Bridge } from "./bridge.ts";
import { mcpSessionId } from "./mcp-session.ts";
import { formatPickContext, PICK_TIMEOUT_MS } from "./pick.ts";
import { cancelPickInSession, pickFromSession } from "./pick-session.ts";
import type { PickStore } from "./picks.ts";
import type { TabRegistry, TabSummary } from "./tabs.ts";
import { normalizeUrl } from "./url.ts";

const MAX_EXTRACT_CHARS = 200_000;
const sessionField = z.string().optional();

export interface McpToolRuntime {
  bridge: Bridge;
  tabs: TabRegistry;
  picks: PickStore;
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

function formatTab(tab: TabSummary): string {
  return `${tab.active ? "*" : " "} ${tab.tabId}  ${tab.title || tab.url}\n    ${tab.url}`;
}

export function registerMcpTools(server: McpServer, runtime: McpToolRuntime): void {
  const { bridge, tabs, picks } = runtime;

  server.registerTool(
    "status",
    {
      description: "Show whether Chrome is connected and which tab this session drives",
      inputSchema: { session: sessionField },
    },
    async ({ session }) => {
      try {
        const sessionKey = mcpSessionId(session);
        const connections = bridge.connections();
        const resolved = await tabs.resolve(sessionKey);
        const tab = resolved
          ? await resolved.connection.request<TabSummary>("tabs.get", {
              tabId: resolved.tabId,
            })
          : null;
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
    async () => {
      try {
        const { tabs: listed } = await tabs
          .connection()
          .request<{ tabs: TabSummary[] }>("tabs.list");
        if (listed.length === 0) return ok("No open tabs.");
        return ok(listed.map(formatTab).join("\n"));
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "open",
    {
      description:
        "Open or navigate this session's tab. Creates and claims a background tab when none is bound.",
      inputSchema: {
        url: z.string().min(1),
        show: z.boolean().optional(),
        session: sessionField,
      },
    },
    async ({ url, show, session }) => {
      try {
        const tab = await tabs.open(mcpSessionId(session), normalizeUrl(url), {
          active: show === true,
        });
        return ok(`Tab ${tab.tabId}: ${tab.url}`);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "attach",
    {
      description: "Claim one of the user's existing tabs for this session",
      inputSchema: { tabId: z.number().int(), session: sessionField },
    },
    async ({ tabId, session }) => {
      try {
        const tab = await tabs.attach(mcpSessionId(session), tabId);
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
        const binding = await tabs.release(mcpSessionId(session));
        return ok(binding ? `Released tab ${binding.tabId}.` : "No tab was bound.");
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
        const sessionKey = mcpSessionId(session);
        const { connection, tabId } = await tabs.require(sessionKey);
        await connection.request("tabs.close", { tabId });
        await tabs.release(sessionKey);
        return ok(`Closed tab ${tabId}.`);
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
        const { connection, tabId } = await tabs.require(mcpSessionId(session));
        const tab = await connection.request<TabSummary>("tabs.select", { tabId });
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
        const { connection, tabId } = await tabs.require(mcpSessionId(session));
        const tab = await connection.request<TabSummary>("tabs.reload", { tabId });
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
        const { connection, tabId } = await tabs.require(mcpSessionId(session));
        const result = await connection.request<{ text?: string }>("page.text", { tabId });
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
        const { connection, tabId } = await tabs.require(mcpSessionId(session));
        const result = await connection.request<{ html?: string }>("page.html", { tabId });
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
        const { connection, tabId } = await tabs.require(mcpSessionId(session));
        const { value } = await connection.request<{ value: unknown }>("page.eval", {
          tabId,
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
        const { connection, tabId } = await tabs.require(mcpSessionId(session));
        await connection.request("input.click", { tabId, selector });
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
        const { connection, tabId } = await tabs.require(mcpSessionId(session));
        await connection.request("input.type", {
          tabId,
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
        const { connection, tabId } = await tabs.require(mcpSessionId(session));
        await connection.request("input.press", { tabId, key });
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
        const { connection, tabId } = await tabs.require(mcpSessionId(session));
        await connection.request("input.scroll", {
          tabId,
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
        const { connection, tabId } = await tabs.require(mcpSessionId(session));
        await connection.request(
          "page.wait",
          { tabId, selector, timeoutMs: timeout },
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
        const { connection, tabId } = await tabs.require(mcpSessionId(session));
        const { data } = await connection.request<{ data: string }>("page.screenshot", {
          tabId,
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
          { tabs, picks },
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
        await cancelPickInSession({ tabs, picks }, mcpSessionId(session));
        return ok("Cancelled the in-page picker.");
      } catch (error) {
        return fail(error);
      }
    },
  );
}
