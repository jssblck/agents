// Drives the real native host script with a fake Chrome on its stdio and real
// clients on its socket, which is the whole multi-agent contract.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { HostPool } from "./hosts.ts";

const HOST = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "machine",
  "computer-and-browser",
  "native-host",
  "bridge.mjs",
);

/** What Chrome would do: frame JSON on stdin, read frames from stdout. */
class FakeChrome {
  readonly process: ChildProcess;
  readonly received: Record<string, unknown>[] = [];
  #waiters: ((message: Record<string, unknown>) => void)[] = [];
  #inbox = Buffer.alloc(0);

  constructor(hostsDir: string) {
    this.process = spawn(process.execPath, [HOST, hostsDir], { stdio: ["pipe", "pipe", "inherit"] });
    this.process.stdout!.on("data", (chunk: Buffer) => {
      this.#inbox = Buffer.concat([this.#inbox, chunk]);
      while (this.#inbox.length >= 4) {
        const length = this.#inbox.readUInt32LE(0);
        if (this.#inbox.length < 4 + length) return;
        const message = JSON.parse(this.#inbox.subarray(4, 4 + length).toString("utf8"));
        this.#inbox = this.#inbox.subarray(4 + length);
        this.received.push(message);
        this.#waiters.shift()?.(message);
      }
    });
  }

  send(message: unknown): void {
    const body = Buffer.from(JSON.stringify(message), "utf8");
    const header = Buffer.alloc(4);
    header.writeUInt32LE(body.length, 0);
    this.process.stdin!.write(Buffer.concat([header, body]));
  }

  next(): Promise<Record<string, unknown>> {
    return new Promise((resolve) => this.#waiters.push(resolve));
  }

  /** Answer requests the way the extension does, echoing client and id. */
  autoRespond(handler: (method: string, params: Record<string, unknown>) => unknown): void {
    const pump = async () => {
      for (;;) {
        const message = await this.next();
        if (message.type !== "request") continue;
        this.send({
          type: "response",
          id: message.id,
          client: message.client,
          ok: true,
          result: handler(String(message.method), (message.params ?? {}) as Record<string, unknown>),
        });
      }
    };
    void pump();
  }

  kill(): void {
    this.process.kill();
  }
}

async function waitForSocket(dir: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const entries = await readdir(dir).catch(() => [] as string[]);
    if (entries.some((entry) => entry.endsWith(".sock"))) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("host never bound its socket");
}

describe("native host", () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  async function start() {
    const dir = await mkdtemp(join(tmpdir(), "agent-browser-hosts-"));
    const chrome = new FakeChrome(join(dir, "hosts"));
    cleanups.push(() => chrome.kill());
    chrome.send({ type: "hello", version: "9.9.9" });
    await waitForSocket(join(dir, "hosts"));
    return { dir: join(dir, "hosts"), chrome };
  }

  it("routes each client's responses back to that client", async () => {
    const { dir, chrome } = await start();
    chrome.autoRespond((method, params) => ({ method, session: params.session }));

    const a = new HostPool(dir);
    const b = new HostPool(dir);
    cleanups.push(() => a.close(), () => b.close());
    const [ca, cb] = await Promise.all([a.primary(), b.primary()]);
    expect(ca.version).toBe("9.9.9");

    const [ra, rb] = await Promise.all([
      ca.request("page.text", { session: "agent-a" }),
      cb.request("page.html", { session: "agent-b" }),
    ]);
    expect(ra).toEqual({ method: "page.text", session: "agent-a" });
    expect(rb).toEqual({ method: "page.html", session: "agent-b" });

    const clients = new Set(
      chrome.received.filter((m) => m.type === "request").map((m) => m.client),
    );
    expect(clients.size).toBe(2);
  });

  it("tells the extension when a client goes away", async () => {
    const { dir, chrome } = await start();
    const pool = new HostPool(dir);
    await pool.primary();
    const gone = chrome.next();
    pool.close();
    expect(await gone).toMatchObject({ type: "client.gone" });
  });

  it("reports no browser when no host is listening", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agent-browser-hosts-"));
    const pool = new HostPool(join(dir, "hosts"));
    await expect(pool.primary()).rejects.toThrow(/No browser is connected/);
  });

  it("fails pending requests when the host dies", async () => {
    const { dir, chrome } = await start();
    const pool = new HostPool(dir);
    cleanups.push(() => pool.close());
    const connection = await pool.primary();
    const pending = connection.request("page.text", { session: "agent-a" });
    chrome.kill();
    await expect(pending).rejects.toThrow(/disconnected/);
    await expect(pool.primary()).rejects.toThrow(/No browser is connected/);
  });
});
