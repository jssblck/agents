# TypeScript / JavaScript dialect

How the universal core is spelled in TypeScript, plus TS/JS-specific idioms. The
overriding rule: let the type system do work, and keep `any` out.

## Tooling

Follow the project's formatter, linter, and TypeScript configuration. Do not
replace tooling or install additional lint plugins during ordinary coding.

When repository setup is requested, Jess's defaults are `oxfmt`, `oxlint`,
and `tsc --noEmit`; see [project-bootstrap](../../project-bootstrap/SKILL.md).
Enable restrictions only where their scope fits the project.

Keep `any` and unchecked assertions out of application logic. Boundary parsers
may accept `unknown`, and adapters may return it until the caller parses it.
Use schema libraries already in the project, or focused type guards when a
dependency would add more complexity than the parser.

## Illegal states (core 1, 4)

- **Discriminated unions for state.** This is the single most valuable TS
  pattern. Replace boolean/optional soup with a tagged union and `switch` on the
  tag:
  ```ts
  type State<T> =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; data: T };
  ```
  The `ready` branch is the only place `data` exists, so you cannot read it while
  loading. Use a `never`-returning `assertNever(x)` in the `default` case to get
  exhaustiveness checking: adding a variant becomes a compile error everywhere
  it is unhandled.
- **Branded (nominal) types** for newtypes, since TS is structural:
  ```ts
  type UserId = string & { readonly __brand: "UserId" };
  const UserId = (raw: string): UserId => {
    if (raw.length === 0) throw new Error("empty UserId");
    // SAFETY: the check above is the whole UserId invariant.
    return raw as UserId;
  };
  ```
  Now a bare `string` will not pass where `UserId` is required. Brand IDs, units,
  and validated values.
- `unknown`, never `any`. `any` disables the type checker locally and infectiously.
  Parse `unknown` at the boundary into a named type; boundary function signatures
  may accept it. Narrow with a schema or a type guard before use. If an assertion
  is necessary, explain the invariant the checker cannot express.
- `readonly` and `as const` for immutability; `satisfies` to check a literal
  against a type without widening it.
- Prefer unions of string literals over `enum` (enums have surprising runtime
  and nominal behavior); reach for `enum` only when you need its specific
  features.

## Parse, don't validate (core 2)

- **Parse external data at the boundary.** Use the project's schema library
  or a focused type guard. With a schema, derive the static type from it:
  ```ts
  const Config = z.object({ port: z.number().int().positive(), host: z.string() });
  type Config = z.infer<typeof Config>;
  const config = Config.parse(rawJson);   // throws on bad shape; config is typed
  ```
  Do not hand-write `isValidConfig(x): boolean` and keep passing the raw object.
  Parse once, pass `Config` inward.
- `JSON.parse` returns `any`, network payloads need runtime checks, and
  `process.env` values are `string | undefined`. Parse them before application use.
- `z.infer` so the static type and the runtime check cannot drift.

## Errors (core 3)

- **Throw for exceptional, return for expected.** Two viable styles; be
  consistent within a module:
  - Idiomatic TS: `throw` a typed `Error` subclass, `catch` at a known seam.
    Always extend `Error` (never `throw "string"`), set `cause` to chain:
    `throw new ConfigError("loading profile", { cause: err })`.
  - Result style: return a `{ ok: true; value } | { ok: false; error }` union (or
    neverthrow's `Result`) when you want the error in the signature and
    exhaustive handling. Good for expected, branchy failure.
- **Never swallow:** no empty `catch {}`, no unhandled promise. A floating
  promise drops its rejection; `await` it or `.catch` it explicitly. The
  type-aware `no-floating-promises` and `no-misused-promises` rules gate this.
- **Fail closed** in gates: a guard that throws or times out denies.
- Async errors: `async`/`await` with `try/catch`, not raw `.then` chains. Use
  `Promise.all` for parallel, `Promise.allSettled` when you need every result
  regardless of individual failures.

## Naming and style

`camelCase` values/functions, `PascalCase` types/classes/components,
`UPPER_SNAKE` consts. Booleans `is`/`has`/`can`. No Hungarian, no `I` prefix on
interfaces. Files: match the project (kebab-case is common). Prefer named exports
over default exports (better refactor/autocomplete).

## Async (TS-specific)

- `async`/`await` throughout; never mix with bare callbacks.
- `Promise.all([...])` for independent parallel work, not sequential awaits in a
  loop when the iterations are independent. `Promise.allSettled` to collect all
  outcomes. `AbortController` / `AbortSignal` for cancellation and timeouts.
- Beware the sequential-await-in-a-loop performance trap; batch with
  `Promise.all` when order-independent.

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

## React: effect discipline

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
handling the null; `as` casts that lie about runtime shape; `enum` by reflex;
floating promises; empty `catch`; `JSON.parse` result used untyped; boolean-flag
soup instead of a discriminated union; default exports everywhere; mocking your
own modules without a contract-level reason; `==` (use `===`). Follow the
project's enforced rules rather than installing new gates during a code change.
