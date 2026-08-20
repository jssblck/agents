import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { KvStore } from "./picks.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Durable JSON bag. Writes are queued so two sets cannot clobber each other. */
export class JsonFileKv implements KvStore {
  #path: string;
  #queue: Promise<void> = Promise.resolve();

  constructor(path: string) {
    this.#path = path;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const data = await this.#read();
    if (!(key in data)) return undefined;
    return data[key] as T;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.#mutate((data) => {
      data[key] = value;
    });
  }

  async delete(key: string): Promise<void> {
    await this.#mutate((data) => {
      delete data[key];
    });
  }

  async #mutate(fn: (data: Record<string, unknown>) => void): Promise<void> {
    const run = this.#queue.then(async () => {
      const data = await this.#read();
      fn(data);
      await mkdir(dirname(this.#path), { recursive: true });
      const temporary = `${this.#path}.${process.pid}.tmp`;
      await writeFile(temporary, `${JSON.stringify(data)}\n`, "utf8");
      await rename(temporary, this.#path);
    });
    this.#queue = run.then(
      () => undefined,
      () => undefined,
    );
    await run;
  }

  async #read(): Promise<Record<string, unknown>> {
    let raw: string;
    try {
      raw = await readFile(this.#path, "utf8");
    } catch {
      return {};
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {};
    }
    return isRecord(parsed) ? parsed : {};
  }
}
