import { describe, expect, it } from "vitest";

import {
  formatPickContext,
  formatPickLabel,
  parsePickedElement,
  type PickedElement,
} from "./pick.ts";
import { PickStore } from "./picks.ts";

const meta = { id: "el_abc", sessionKey: "thr_1", createdAt: "2026-08-13T00:00:00.000Z" };

function raw(overrides: Record<string, unknown> = {}) {
  return {
    pageUrl: "http://localhost:5173/login",
    pageTitle: "Sign in",
    tagName: "BUTTON",
    selector: "#submit",
    text: "Continue",
    htmlPreview: '<button id="submit">Continue</button>',
    styles: "display: inline-flex;",
    componentName: "SubmitButton",
    source: { fileName: "Login.tsx", lineNumber: 42, columnNumber: 8, functionName: "SubmitButton" },
    rect: { x: 10, y: 20, width: 80, height: 32 },
    ...overrides,
  };
}

describe("parsePickedElement", () => {
  it("keeps a complete payload", () => {
    const pick = parsePickedElement(raw(), meta);
    expect(pick).toMatchObject({
      id: "el_abc",
      sessionKey: "thr_1",
      pageUrl: "http://localhost:5173/login",
      tagName: "button",
      selector: "#submit",
      componentName: "SubmitButton",
      source: { fileName: "Login.tsx", lineNumber: 42 },
    });
  });

  it("rejects a payload with no url or tag", () => {
    expect(parsePickedElement(raw({ pageUrl: "  " }), meta)).toBeNull();
    expect(parsePickedElement(raw({ tagName: "" }), meta)).toBeNull();
    expect(parsePickedElement(null, meta)).toBeNull();
  });

  it("truncates oversized html", () => {
    const pick = parsePickedElement(raw({ htmlPreview: "x".repeat(8_000) }), meta);
    expect(pick?.htmlPreview.length).toBeLessThanOrEqual(4_000);
    expect(pick?.htmlPreview.endsWith("…")).toBe(true);
  });
});

describe("formatPickLabel", () => {
  it("prefers the React name", () => {
    expect(formatPickLabel({ tagName: "button", componentName: "SubmitButton" })).toBe(
      "<SubmitButton>",
    );
  });

  it("falls back to the tag", () => {
    expect(formatPickLabel({ tagName: "button", componentName: null })).toBe("<button>");
  });
});

describe("formatPickContext", () => {
  it("builds an element_context block the agent can act on", () => {
    const pick = parsePickedElement(raw(), meta) as PickedElement;
    const block = formatPickContext(pick);
    expect(block.startsWith("<element_context>")).toBe(true);
    expect(block).toContain("selector: #submit");
    expect(block).toContain("source: Login.tsx:42:8");
    expect(block).toContain("text: Continue");
    expect(block.endsWith("</element_context>")).toBe(true);
  });
});

describe("PickStore", () => {
  it("returns saved picks newest first and drops the oldest past the cap", async () => {
    const data = new Map<string, unknown>();
    const store = new PickStore({
      get: async <T>(key: string) => data.get(key) as T | undefined,
      set: async (key, value) => {
        data.set(key, value);
      },
      delete: async (key) => {
        data.delete(key);
      },
    });

    for (let index = 0; index < 21; index++) {
      const pick = parsePickedElement(raw({ selector: `#n${index}` }), {
        ...meta,
        id: `el_${index}`,
      }) as PickedElement;
      await store.save(pick);
    }

    const listed = await store.list("thr_1");
    expect(listed).toHaveLength(20);
    expect(listed[0]?.id).toBe("el_20");
    expect(await store.get("el_0")).toBeUndefined();
    expect(await store.get("el_20")).toMatchObject({ selector: "#n20" });
  });
});
