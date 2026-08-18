import type { PickedElement } from "./pick.ts";

export interface KvStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

const MAX_PICKS_PER_SESSION = 20;

const pickKey = (id: string) => `pick:${id}`;
const indexKey = (sessionKey: string) => `pick-index:${sessionKey}`;

export class PickStore {
  #kv: KvStore;

  constructor(kv: KvStore) {
    this.#kv = kv;
  }

  async get(id: string): Promise<PickedElement | undefined> {
    return this.#kv.get<PickedElement>(pickKey(id));
  }

  async list(sessionKey: string): Promise<PickedElement[]> {
    const ids = (await this.#kv.get<string[]>(indexKey(sessionKey))) ?? [];
    const picks = await Promise.all(ids.map((id) => this.get(id)));
    return picks.filter((pick): pick is PickedElement => pick !== undefined);
  }

  async save(pick: PickedElement): Promise<void> {
    await this.#kv.set(pickKey(pick.id), pick);
    const ids = (await this.#kv.get<string[]>(indexKey(pick.sessionKey))) ?? [];
    const next = [pick.id, ...ids.filter((id) => id !== pick.id)].slice(
      0,
      MAX_PICKS_PER_SESSION,
    );
    await this.#kv.set(indexKey(pick.sessionKey), next);
    const dropped = ids.filter((id) => !next.includes(id));
    await Promise.all(dropped.map((id) => this.#kv.delete(pickKey(id))));
  }
}
