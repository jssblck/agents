# TypeScript / JavaScript testing dialect

How the universal core is spelled in TypeScript tests.

Runner: Vitest or Jest; `tsc --noEmit` is part of the test gate (a green test
suite with type errors is not green).

- Test behavior through the module's public surface. `vi.mock` / `jest.mock`
  are lint errors under the anti-slop config (`anti-slop/no-module-mocking`;
  see the code-craft TypeScript dialect for the lint setup); avoid `vi.spyOn`
  on your own functions too. Both pin implementation. Use real
  implementations, a real in-memory store, MSW for HTTP boundaries, real temp
  dirs.
- `fast-check` for property-based tests. Deterministic: fake timers
  (`vi.useFakeTimers`) instead of real `setTimeout` waits; inject the clock
  and RNG.
- Descriptive `describe`/`it` names that read as behavior sentences.
