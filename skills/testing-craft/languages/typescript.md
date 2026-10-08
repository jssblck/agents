# TypeScript / JavaScript testing dialect

How the universal core is spelled in TypeScript tests.

Runner: Vitest. `tsc --noEmit` is part of the test gate: a green suite with type
errors is not green, and the type check also runs the compile-fail checks.

## Effect logic

Use `@effect/vitest`. `it.effect` provides a Scope plus `TestClock` and
`TestConsole`; `it.live` uses live services. Build a fake from the service's own
interface with `Service.of`, so the compiler rejects one that drifts. Keep one
fake per service next to its contract, and pass test data to its constructor:

```ts
export const fakeDirectory = () =>
  Layer.effect(
    Directory,
    Effect.gen(function* () {
      const rows = yield* Ref.make(new Map<string, Contact>());
      return Directory.of({
        save: (contact) => Ref.update(rows, (m) => new Map(m).set(contact.id, contact)),
        find: (id) =>
          Effect.flatMap(Ref.get(rows), (m) => {
            const contact = m.get(id);
            return contact ? Effect.succeed(contact) : Effect.fail(new ContactNotFound({ id }));
          }),
      });
    }),
  );
```

When a fake carries behavior other tests rely on, give it a contract suite and
run it against the fake and the real Layer at its real boundary (Postgres or
Emulate):

```ts
export const directoryContract = (name: string, layer: () => Layer.Layer<Directory>) =>
  describe(`Directory contract: ${name}`, () => {
    it.effect("fails with ContactNotFound for an unknown id", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip((yield* Directory).find("missing"));
        assert.strictEqual(error._tag, "ContactNotFound");
      }).pipe(Effect.provide(layer())),
    );
  });

// directory-fake.test.ts:        directoryContract("fake", fakeDirectory);
// directory.integration.test.ts: directoryContract("Postgres", () => Directory.layer.pipe(Layer.provide(testDb)));
```

- Provide a fresh Layer per test. `layer(L)(name, (it) => ...)` shares one
  instance across its block, so a stateful fake carries state between tests.
- Check failures with `Effect.flip` and `_tag` or `instanceOf`. Do not
  deep-compare `Exit` or `Cause`; they carry stack annotations.
- Test time starts at zero, and `Effect.sleep` waits for the clock:
  `yield* TestClock.adjust("30 seconds")`, with `TestClock` from
  `effect/testing`.
- `it.effect.prop` runs property tests from Schema or fast-check arbitraries.

## Typed doubles outside Effect

Pass a typed parameter, and type the double as the real function:

```ts
test("a verified member gets exactly one welcome email", async () => {
  const send = vi.fn<SendEmail>(async () => {});
  expect(await welcome({ email: "ada@example.com", verified: true }, send)).toBe("sent");
  expect(send).toHaveBeenCalledExactlyOnceWith("ada@example.com", "Welcome to Sorted");
});
```

Reach for a module mock only when the code has no seam. Pass `import(...)` so
the factory is checked against the module's type:

```ts
vi.mock(import("./mailer.ts"), async (importOriginal) => ({
  ...(await importOriginal()),
  sendEmail: vi.fn<typeof sendEmail>(async () => {}),
}));
```

A module mock replaces only what other modules import; a call inside the mocked
module still reaches the real function. Never type a double with `as any` or
`as unknown as`.

## Workflows

- Drive timers with `SimulatedClock`:
  `createActor(machine, { clock }).start(); clock.increment(30_000);`.
- Assert refusals with `actor.getSnapshot().can(event)`; an unhandled event is
  otherwise dropped silently.
- `createTestModel` from `xstate/graph` generates a path per reachable state;
  `@xstate/test` is deprecated. It rejects machines with `after` transitions, so
  test those through `SimulatedClock`. Supply event payloads through `events`:
  ```ts
  const model = createTestModel(approval, { events: [{ type: "approve", by: "grace" }] });
  for (const path of model.getShortestPaths()) {
    test(path.description, async () => {
      const actor = createActor(approval).start();
      await path.test({
        events: {
          submit: () => actor.send({ type: "submit" }),
          approve: () => actor.send({ type: "approve", by: "grace" }),
          reject: () => actor.send({ type: "reject" }),
        },
        states: { "*": (state) => expect(actor.getSnapshot().value).toEqual(state.value) },
      });
    });
  }
  ```
  Replace the actor with the real surface to turn the same paths into
  integration or end-to-end coverage.

## Emulate

- `createEmulator({ service: "github", port: 0 })` returns `{ url, reset(),
  close() }`. Custom emulators from `defineEmulator` add `snapshot()` and
  `restore()`, and can run without a socket (`listen: false`).
- Emulate 0.12.1 binds `127.0.0.1` but reports a `localhost` URL. Rewrite the
  host to `127.0.0.1` for a client that resolves `localhost` to IPv6 first.
- Custom routes accept a bare `*` as the only wildcard; `/prefix/*` matches
  literally in 0.12.
- Run the CLI as `pnpm exec emulate`; bare `emulate` is a zsh builtin.

## Compile-fail checks

Keep proof and ownership mistakes in a file the normal type check includes, one
`// @ts-expect-error <reason>` per mistake; the code-craft TypeScript reference
has a gdp-ts example. An unused `@ts-expect-error` is itself a type error, so the
check fails when a mistake starts compiling.

## Determinism and names

- Use `fast-check` for justified property tests. Inject clocks and randomness
  when they affect behavior. Use fake timers only for isolated timer logic; keep
  native HTTP and SDK transport timers real. Await observable completion instead
  of sleeping for an arbitrary duration.
- Write `describe`/`it` names that read as behavior sentences.
