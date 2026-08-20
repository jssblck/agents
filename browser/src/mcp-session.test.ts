import { describe, expect, it } from "vitest";

import { DEFAULT_MCP_SESSION, mcpSessionId } from "./mcp-session.ts";

describe("mcpSessionId", () => {
  it("uses this process's session when the caller omits one", () => {
    expect(DEFAULT_MCP_SESSION).toMatch(/^agent-[0-9a-f]{8}$/);
    expect(mcpSessionId(undefined)).toBe(DEFAULT_MCP_SESSION);
    expect(mcpSessionId("")).toBe(DEFAULT_MCP_SESSION);
    expect(mcpSessionId("   ")).toBe(DEFAULT_MCP_SESSION);
  });

  it("keeps an explicit session", () => {
    expect(mcpSessionId("thr_abc")).toBe("thr_abc");
    expect(mcpSessionId("  thr_abc  ")).toBe("thr_abc");
  });
});
