import { describe, expect, it } from "vitest";

import { DEFAULT_MCP_SESSION, mcpSessionId } from "./mcp-session.ts";

describe("mcpSessionId", () => {
  it("uses scratch when the caller omits a session", () => {
    expect(mcpSessionId(undefined)).toBe(DEFAULT_MCP_SESSION);
    expect(mcpSessionId("")).toBe(DEFAULT_MCP_SESSION);
    expect(mcpSessionId("   ")).toBe(DEFAULT_MCP_SESSION);
  });

  it("keeps an explicit session", () => {
    expect(mcpSessionId("thr_abc")).toBe("thr_abc");
    expect(mcpSessionId("  thr_abc  ")).toBe("thr_abc");
  });
});
