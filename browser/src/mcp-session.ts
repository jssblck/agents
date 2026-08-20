import { randomUUID } from "node:crypto";

/**
 * One MCP process is one agent, so its session is the default. An explicit
 * name lets a harness keep the same tab across process restarts.
 */
export const DEFAULT_MCP_SESSION = `agent-${randomUUID().slice(0, 8)}`;

export function mcpSessionId(raw: string | undefined): string {
  const trimmed = raw?.trim();
  return trimmed === undefined || trimmed === "" ? DEFAULT_MCP_SESSION : trimmed;
}
