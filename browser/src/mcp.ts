// Standalone MCP server for the Agent Browser extension.
//
// This process owns the unix socket the native host dials, then exposes the
// extension's commands over stdio MCP so any harness can drive the user's
// real Chrome. `install` as the first argument only refreshes the native
// messaging manifests and exits.
import { join } from "node:path";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { Bridge } from "./bridge.ts";
import { JsonFileKv } from "./json-kv.ts";
import { registerMcpTools } from "./mcp-tools.ts";
import { extensionDir, install, installPaths } from "./install.ts";
import { PickStore } from "./picks.ts";
import { TabRegistry } from "./tabs.ts";

function log(message: string): void {
  process.stderr.write(`${message}\n`);
}

async function installOnly(): Promise<void> {
  const result = await install(installPaths());
  for (const { browser, path } of result.manifests) log(`${browser}: ${path}`);
  if (result.missing.length) log(`Not installed: ${result.missing.join(", ")}`);
  log(`Load unpacked once from ${extensionDir()} (chrome://extensions, Developer mode).`);
}

async function serve(): Promise<void> {
  const paths = installPaths();
  const kv = new JsonFileKv(join(paths.dataDir, "mcp-kv.json"));

  const bridge = new Bridge({ pointerPath: paths.pointerPath, log, onChange: () => undefined });
  await bridge.start();

  const tabs = new TabRegistry({ bridge, kv, onChange: () => undefined });
  const picks = new PickStore(kv);

  try {
    await install(paths);
  } catch (error) {
    log(`Could not refresh the native messaging host: ${String(error)}`);
  }

  const server = new McpServer({ name: "agent-browser", version: "0.2.0" });
  registerMcpTools(server, { bridge, tabs, picks });

  const shutdown = async () => {
    await bridge.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  log(
    `agent-browser MCP waiting for the extension at ${extensionDir()}. If status stays disconnected, reload the unpacked Agent Browser extension.`,
  );
  await server.connect(new StdioServerTransport());
}

const main = process.argv[2] === "install" ? installOnly : serve;
void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
