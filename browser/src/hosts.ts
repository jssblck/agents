// The client side of the bridge: connections to every live native host.
//
// Chrome starts one native host per browser profile running the extension,
// and each host listens on a socket named after its pid. This process is one
// of many agents dialing in: it lists the directory to find hosts and treats
// a socket that refuses as a dead one.
import { readdir } from "node:fs/promises";
import { connect, type Socket } from "node:net";
import { join } from "node:path";

const DEFAULT_TIMEOUT_MS = 30_000;
const HELLO_TIMEOUT_MS = 3_000;
const SOCKET_PATTERN = /^host-\d+\.sock$/;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export interface BrowserConnection {
  /** The socket file name, stable for the life of that host. */
  readonly id: string;
  readonly version: string;
  request<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<T>;
}

class Connection implements BrowserConnection {
  readonly id: string;
  version = "unknown";
  readonly ready: Promise<void>;
  closed = false;
  #socket: Socket;
  #pending = new Map<number, Pending>();
  #nextId = 1;
  #buffer = "";

  constructor(id: string, path: string, onClose: () => void) {
    this.id = id;
    this.#socket = connect(path);
    let hello!: () => void;
    let failed!: (error: Error) => void;
    this.ready = new Promise<void>((resolve, reject) => {
      hello = resolve;
      failed = reject;
    });
    // An unhandled rejection here would crash the process for a host that
    // happened to die between readdir and connect.
    this.ready.catch(() => undefined);
    const helloTimer = setTimeout(
      () => failed(new Error("The native host did not introduce the extension in time")),
      HELLO_TIMEOUT_MS,
    );
    this.#socket.on("data", (chunk) => {
      this.#buffer += chunk.toString("utf8");
      let newline = this.#buffer.indexOf("\n");
      while (newline !== -1) {
        const line = this.#buffer.slice(0, newline).trim();
        this.#buffer = this.#buffer.slice(newline + 1);
        newline = this.#buffer.indexOf("\n");
        if (!line) continue;
        let message: Record<string, unknown>;
        try {
          message = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (message.type === "hello") {
          this.version = String(message.version ?? "unknown");
          clearTimeout(helloTimer);
          hello();
          continue;
        }
        if (message.type !== "response") continue;
        const pending = this.#pending.get(Number(message.id));
        if (!pending) continue;
        this.#pending.delete(Number(message.id));
        clearTimeout(pending.timer);
        if (message.ok) pending.resolve(message.result);
        else pending.reject(new Error(String(message.error ?? "Browser command failed")));
      }
    });
    const drop = (reason: string) => {
      if (this.closed) return;
      this.closed = true;
      clearTimeout(helloTimer);
      failed(new Error(reason));
      for (const pending of this.#pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error(reason));
      }
      this.#pending.clear();
      onClose();
    };
    this.#socket.on("close", () => drop("The browser disconnected"));
    this.#socket.on("error", (error) => drop(`The browser disconnected: ${error.message}`));
  }

  request<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (this.closed) {
        reject(new Error("The browser disconnected"));
        return;
      }
      const id = this.#nextId++;
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`Browser did not answer ${method} within ${timeoutMs}ms`));
      }, timeoutMs);
      this.#pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      this.#socket.write(`${JSON.stringify({ type: "request", id, method, params })}\n`);
    });
  }

  close(): void {
    this.#socket.destroy();
  }
}

export class HostPool {
  #dir: string;
  #connections = new Map<string, Connection>();

  constructor(hostsDir: string) {
    this.#dir = hostsDir;
  }

  /** Dial any host that appeared since last time, and forget the ones that died. */
  async refresh(): Promise<BrowserConnection[]> {
    let entries: string[] = [];
    try {
      entries = await readdir(this.#dir);
    } catch {
      // No host has ever started: the directory does not exist yet.
    }
    const live = entries.filter((entry) => SOCKET_PATTERN.test(entry));
    for (const id of live) {
      if (this.#connections.has(id)) continue;
      const connection = new Connection(id, join(this.#dir, id), () =>
        this.#connections.delete(id),
      );
      this.#connections.set(id, connection);
    }
    await Promise.all([...this.#connections.values()].map((c) => c.ready.catch(() => undefined)));
    return this.connections();
  }

  connections(): BrowserConnection[] {
    return [...this.#connections.values()].filter((c) => !c.closed && c.version !== "unknown");
  }

  /** The browser an agent should drive: the only one, or the first one seen. */
  async primary(): Promise<BrowserConnection> {
    const [connection] = await this.refresh();
    if (!connection) {
      throw new Error(
        "No browser is connected. Open Chrome with the Agent Browser extension enabled (reload it from chrome://extensions if it already is), then call the status tool.",
      );
    }
    return connection;
  }

  close(): void {
    for (const connection of this.#connections.values()) connection.close();
    this.#connections.clear();
  }
}
