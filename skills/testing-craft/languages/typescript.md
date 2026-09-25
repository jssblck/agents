# TypeScript / JavaScript testing dialect

How the universal core is spelled in TypeScript tests.

Runner: Vitest or Jest; `tsc --noEmit` is part of the test gate (a green test
suite with type errors is not green).

- Drive the running application or workflow first, using the core's boundary
  order. `vi.mock` / `jest.mock`
  are lint errors under the anti-slop config (`anti-slop/no-module-mocking`;
  see the code-craft TypeScript dialect for the lint setup); avoid `vi.spyOn`
  on your own functions too. Both pin implementation. Use real
  implementations, real fixture databases and temporary directories, and
  Vercel Emulate for service APIs. Drive the native SDK or HTTP client against
  the fixture's returned URL; use custom emulators for unsupported or owned APIs.
- Use `fast-check` for justified property tests. Inject clocks and randomness
  when they affect behavior. Use fake timers only for isolated timer logic;
  keep native HTTP and SDK transport timers real. Await observable completion
  instead of sleeping for an arbitrary duration.
- Descriptive `describe`/`it` names that read as behavior sentences.
