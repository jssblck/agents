/** Every MCP client shares this key unless it names its own session. */
export const DEFAULT_MCP_SESSION = "scratch";

export function mcpSessionId(raw: string | undefined): string {
  const trimmed = raw?.trim();
  return trimmed === undefined || trimmed === "" ? DEFAULT_MCP_SESSION : trimmed;
}
