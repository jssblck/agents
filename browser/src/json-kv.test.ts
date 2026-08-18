import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { JsonFileKv } from "./json-kv.ts";

describe("JsonFileKv", () => {
  it("round-trips values through a file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agent-browser-kv-"));
    const store = new JsonFileKv(join(directory, "state.json"));
    await store.set("tab:scratch", { browserId: "browser-1", tabId: 12 });
    await expect(store.get<{ tabId: number }>("tab:scratch")).resolves.toEqual({
      browserId: "browser-1",
      tabId: 12,
    });
    await store.delete("tab:scratch");
    await expect(store.get("tab:scratch")).resolves.toBeUndefined();
  });

  it("serializes overlapping writes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agent-browser-kv-"));
    const path = join(directory, "state.json");
    const store = new JsonFileKv(path);
    await Promise.all([store.set("a", 1), store.set("b", 2), store.set("c", 3)]);
    const raw = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    expect(raw).toEqual({ a: 1, b: 2, c: 3 });
  });
});
