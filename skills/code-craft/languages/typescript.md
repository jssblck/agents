# TypeScript / JavaScript dialect

How the universal core is spelled in TypeScript, plus TS/JS-specific idioms. The
overriding rule: let the type system do work, and keep `any` out.

## Stack

For new TypeScript code and the full project template, Jess's stack climbs the
[proof ladder](../principles/proof-ladder.md):

- Effect Schema or Zod to decode boundaries into brands and tagged unions.
- Effect for services, typed failures, and resource scopes.
- xstate for named workflows.
- gdp-ts for sensitive preconditions.
- Postgres, following [database-craft](../../database-craft/SKILL.md).

In an existing repository, use its equivalents. Adding Effect, xstate, or gdp-ts
to a codebase that lacks it is an architecture change to ask about first.

Effect 4 renamed much of Effect 3. The names below are Effect 4; write against
the installed version, not remembered v3 APIs.

## Tooling

Follow the project's formatter, linter, and TypeScript configuration. Do not
replace tooling or install additional lint plugins during ordinary coding.

When repository setup is requested, Jess's defaults are `oxfmt`, `oxlint`,
and `tsc --noEmit`; see [project-bootstrap](../../project-bootstrap/SKILL.md).
Enable restrictions only where their scope fits the project.

Lint is part of the first rung when it fails the gate. Ban `any`, unchecked
`as`, non-null `!`, and floating promises in application logic, and require a
reason on every suppression comment. Effect projects report the Effect language
service diagnostics in the type check. gdp-ts projects enable its lint preset.

Boundary parsers may accept `unknown`, and adapters may return it until the
caller parses it.

## Illegal states (core 1, 4)

- **Discriminated unions for state.** Replace boolean/optional soup with a
  tagged union and switch on the tag. `satisfies never` in the default case
  turns a new, unhandled variant into a compile error:
  ```ts
  function summary(event: TicketEvent): string {
    switch (event._tag) {
      case "Opened":
        return `opened ${event.id}`;
      case "Closed":
        return `closed ${event.id}: ${event.reason}`;
      default:
        return event satisfies never;
    }
  }
  ```
- **Brands come from the decoder.** TypeScript is structural, so distinct
  domain values need brands. A brand is type-only in both Effect Schema and Zod;
  put the runtime checks before it:
  ```ts
  const TicketId = Schema.String.check(Schema.isMinLength(1)).pipe(Schema.brand("TicketId"));
  type TicketId = typeof TicketId.Type;
  ```
  Without a schema library, mint the brand in one constructor that checks the
  invariant, and nowhere else.
- `unknown`, never `any`. Narrow with a schema or a type guard before use. If an
  assertion is necessary, explain the invariant the checker cannot express.
- `readonly` and `as const` for immutability; `satisfies` to check a literal
  against a type without widening it.
- Prefer unions of string literals over `enum`.

## Parse, don't validate (core 2)

Use one schema library per type. Effect Schema belongs inside Effect programs:
decode failures land in the typed error channel, and it pairs with tagged errors
and classes. Use Zod where the ecosystem expects it: OpenAPI tooling, AI SDK
tool schemas, form resolvers. Never define the same type in both. Bridge at a
seam through Standard Schema (`Schema.toStandardSchemaV1`), or wrap a Zod decode
once in an adapter that returns a typed failure.

```ts
// Effect Schema
const TicketEvent = Schema.Union([
  Schema.TaggedStruct("Opened", { id: TicketId }),
  Schema.TaggedStruct("Closed", { id: TicketId, reason: Schema.String }),
]);
type TicketEvent = typeof TicketEvent.Type;
const decodeTicketEvent = Schema.decodeUnknownEffect(TicketEvent); // fails with SchemaError

// Zod
const ZodTicketId = z.string().min(1).brand<"TicketId">();
const ZodTicketEvent = z.discriminatedUnion("_tag", [
  z.object({ _tag: z.literal("Opened"), id: ZodTicketId }),
  z.object({ _tag: z.literal("Closed"), id: ZodTicketId, reason: z.string() }),
]);
const parsed = ZodTicketEvent.safeParse(JSON.parse(body));
```

- Effect Schema stops at the first issue; pass `{ errors: "all" }` when the
  caller needs every issue. `decodeUnknownSync` exists for synchronous edges.
- `JSON.parse` returns `any`, network payloads need runtime checks, and
  `process.env` values are `string | undefined`. Parse them before use.
- Derive static types from the schema (`typeof X.Type`, `z.output`) so the type
  and the runtime check cannot drift.

## Effect

A service is a `Context.Service` class with a `layer`. The layer reads its
collaborators once and returns methods that need nothing further; `Service.of`
makes the compiler reject an implementation, or a test fake, that drifts from
the interface.

```ts
export class TicketClosed extends Schema.TaggedError<TicketClosed>()("TicketClosed", {
  id: TicketId,
}) {}

export class Tickets extends Context.Service<Tickets, {
  readonly reply: (id: TicketId, body: string) => Effect.Effect<void, TicketClosed>;
}>()("app/Tickets") {
  static readonly layer = Layer.effect(
    Tickets,
    Effect.gen(function* () {
      const mailer = yield* Mailer;
      const conn = yield* Effect.acquireRelease(openConnection, (c) => Effect.sync(() => c.close()));
      return Tickets.of({
        reply: Effect.fn("Tickets.reply")(function* (id: TicketId, body: string) {
          const ticket = yield* conn.load(id);
          if (ticket.closed) return yield* new TicketClosed({ id });
          yield* mailer.send(ticket.requester, body);
        }),
      });
    }),
  );
}
```

- **Requirements:** `Tickets.layer` has type `Layer<Tickets, never, Mailer>`. A
  program cannot run until every requirement is provided.
- **Failures:** expected failures are `Schema.TaggedError` classes; fail with
  `yield* new TicketClosed(...)`. Anything a caller cannot act on is a defect:
  `Effect.die`, or `Effect.orDie` over a failure that cannot happen.
- **Lifetimes:** acquire resources with `Effect.acquireRelease` inside
  `Layer.effect` or `Effect.scoped`; the scope runs the finalizer on success,
  failure, or interruption.
- **Tracing:** name traced methods `Effect.fn("Area.method")`.
- **Running:** call `run*` only at entrypoints, framework adapters, and listed
  bridges, through a `ManagedRuntime` or the platform's main runner.
  `runPromise` rejects with the first failure and drops defects and concurrent
  failures; use `runPromiseExit` where the full cause matters, and pass
  `{ signal }` so cancellation reaches the fiber.
- **Concurrency:** inside Effect code use `Effect.all(..., { concurrency })`,
  not `Promise.all`.
- **Effect 3 names that no longer exist:** `Context.Tag`, `Effect.Service`,
  `Layer.scoped` (merged into `Layer.effect`), `Effect.catchAll` (now
  `Effect.catch`), `Schema.decodeUnknown` (now `decodeUnknownEffect`).

## Errors outside Effect (core 3)

In code that does not use Effect, be consistent within a module:

- `throw` a typed `Error` subclass and catch it at a known seam. Always extend
  `Error` (never `throw "string"`) and chain with `cause`:
  `throw new ConfigError("loading profile", { cause: err })`.
- Or return a `{ ok: true; value } | { ok: false; error }` union when the
  failure belongs in the signature.

Everywhere: never swallow (no empty `catch {}`), `await` or explicitly handle
every promise, and fail closed in gates.

## Workflows with xstate

Use a machine for a named workflow when the
[illegal states](../principles/illegal-states.md#workflows-tagged-unions-or-state-machines)
heuristic says a tagged union is not enough. Keep one machine in a shared
library that every surface drives.

```ts
const runtime = ManagedRuntime.make(AppLayer);

export const checkout = setup({
  types: {
    context: {} as { orderId: string | null },
    events: {} as { type: "submit"; cartId: string } | { type: "cancel" },
  },
  actors: {
    placeOrder: fromPromise<string, { cartId: string }>(({ input, signal }) =>
      runtime.runPromise(placeOrder(input.cartId), { signal }),
    ),
  },
}).createMachine({
  context: { orderId: null },
  initial: "idle",
  states: {
    idle: { on: { submit: "placing" } },
    placing: {
      invoke: {
        src: "placeOrder",
        input: ({ event }) => {
          assertEvent(event, "submit");
          return { cartId: event.cartId };
        },
        onDone: { target: "placed", actions: assign({ orderId: ({ event }) => event.output }) },
        onError: "failed",
      },
      on: { cancel: "idle" }, // leaving the state aborts the signal and interrupts the fiber
    },
    placed: { type: "final" },
    failed: {},
  },
});
```

- Declare types, actors, guards, and actions in `setup` so names and payloads
  are checked. Narrow with `assertEvent`.
- The types do not prove which events a state handles: `send` accepts the whole
  event union, transition targets are strings, and an unhandled event is
  dropped. Test refusals with `snapshot.can(event)`.
- Use `@xstate/store` for named events over context with no finite modes.

## Proofs with gdp-ts

The package is `@gdp-ts/core`. Version 0.1.0 predates two forging fixes on its
main branch; use a later release or a commit that has them, and fork it if it
falls short. See [proof parameters](../principles/proof-parameters.md).

```ts
// proofs/member-can-edit.ts: the only module that can mint this proof.
const MemberCanEdit = defineProof("MemberCanEdit"); // never exported
export interface MemberCanEdit<M, D> extends Proof<"MemberCanEdit", [M, D]> {}

export async function memberCanEdit<M, D>(member: Named<M, UserId>, doc: Named<D, DocumentId>) {
  const role = await db.roleFor(member.value, doc.value);
  return role === "owner" || role === "editor" ? MemberCanEdit.prove(member, doc) : null;
}

// The data layer demands named values plus a proof about exactly those names.
export function renameDocument<M, D>(
  doc: Named<D, DocumentId>,
  editor: Named<M, UserId>,
  title: string,
  _proof: MemberCanEdit<M, D>,
) {
  return db.rename(doc.value, editor.value, title);
}

// The handler names the values, proves, and maps a missing proof to a response.
export const handleRename = (userId: UserId, documentId: DocumentId, title: string) =>
  name(userId, documentId, async (member, doc) => {
    const canEdit = await memberCanEdit(member, doc);
    if (!canEdit) throw new NotFound();
    return renameDocument(doc, member, title, canEdit);
  });
```

- One `proofs/<fact>.ts` per fact. A policy is a union of proofs; switch on
  `kind` to see which one granted access.
- Enable the lint preset (`@gdp-ts/core/lint/oxlint` or `/lint/eslint`). It
  bans defining proofs outside `proofs/`, exporting a prover, and asserting a
  proof type; `strict` also bans `as` and `any`.
- Keep a compile-fail file of the mistakes the proofs reject:
  ```ts
  name(userId, docA, docB, async (member, a, b) => {
    const canEdit = await memberCanEdit(member, a);
    // @ts-expect-error the proof may be null
    await renameDocument(a, member, "title", canEdit);
    if (!canEdit) return;
    // @ts-expect-error a raw ID is not a named document
    await renameDocument(docA, member, "title", canEdit);
    // @ts-expect-error the proof is about document A, not document B
    await renameDocument(b, member, "title", canEdit);
  });
  ```

## Naming and style

`camelCase` values/functions, `PascalCase` types/classes/components,
`UPPER_SNAKE` consts. Booleans `is`/`has`/`can`. No Hungarian, no `I` prefix on
interfaces. Files: match the project (kebab-case is common). Prefer named exports
over default exports (better refactor/autocomplete).

## Async (TS-specific)

- `async`/`await` throughout; never mix with bare callbacks.
- Outside Effect, `Promise.all([...])` for independent parallel work, not
  sequential awaits in a loop when the iterations are independent.
  `Promise.allSettled` to collect all outcomes. `AbortController` /
  `AbortSignal` for cancellation and timeouts.

## Functional and immutability

Prefer `map`/`filter`/`reduce` and immutable updates over in-place mutation where
it reads clearly. `const` by default. Do not mutate function arguments. Keep
side effects at the edges so the core is testable.

## Project structure

Organize by feature/domain, not by technical layer (`user/` not
`controllers/ models/ views/` split across the app). Barrel files (`index.ts`)
sparingly: they help the public surface but can create import cycles and slow
tooling. Keep the public API of a module explicit.

## Testing (core 6)

See the testing-craft skill:
[`testing-craft/languages/typescript.md`](../../testing-craft/languages/typescript.md).

## React: `useEffect` discipline

`useEffect` synchronizes a component with a system React does not own. It is not
a data-flow tool. Effect chains (an effect sets state, which triggers another
effect) turn a component from a readable tree into a timeline that a reader,
human or agent, must simulate step by step. Default to zero effects; see
[You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).

- Prefer these alternatives to effects:
  - Derived state: compute it during render (`useMemo` if expensive).
  - Resetting state when a prop changes: pass a `key` instead.
  - Reacting to a user event: put the logic in the event handler.
  - Data fetching: use the project's data-fetching layer (TanStack Query, SWR,
    or the framework loader), which handles races, caching, and cancellation.
- **Allowed:** synchronizing with an external system: DOM APIs, subscriptions,
  timers, third-party widgets, analytics. Clean up resources or subscriptions
  when needed, and list accurate dependencies. For external stores, prefer
  `useSyncExternalStore` over a hand-rolled subscribe effect.
- Extract a wrapper hook when it provides reuse or a clearer lifecycle boundary.
  Do not create a wrapper directory solely to prohibit effect imports. Keep
  dependencies accurate and do not suppress hook lint rules to hide stale state.

## Anti-patterns to refuse

`any` (use `unknown` + narrowing); non-null `!` to silence the checker instead of
handling the null; `as` casts that lie about runtime shape, especially onto
brands or proofs; a brand applied before its checks; one type defined in two
schema libraries; `Effect.run*` inside library code; Effect 3 API names;
`enum` by reflex; floating promises; empty `catch`; `JSON.parse` result used
untyped; boolean-flag soup instead of a discriminated union; default exports
everywhere; `==` (use `===`). Follow the project's enforced rules rather than
installing new gates during a code change.
