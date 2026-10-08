---
name: testing-craft
description: "Use when writing, reviewing, or refactoring tests, or choosing verification for a code change."
user-invocable: true
argument-hint: "[rust|typescript|go|python] [target]"
---

# Testing Craft

Tests own only what no stronger rung can prove. Every invariant has one owner:
the strongest rung of code-craft's
[proof ladder](../code-craft/principles/proof-ladder.md) that can actually
prove it. In order: types and linters, effects, proofs, database constraints,
unit tests, integration tests, end-to-end tests. Make the bad case fail to
compile or construct where you can, then test the remainder at the strongest
test rung that proves it, with as few tests as keep that proof.

## Scope and verification

- Identify the behavior being changed and the specific defect each new or
  modified test should catch. A test need not detect unrelated defects.
- Before testing new code, enumerate its failure modes and give each one to the
  strongest rung that can own it.
- Follow project instructions and existing test conventions over these defaults.
- Run affected tests and required checks. Broaden coverage when the change's
  dependencies, failures, or unresolved risks justify it.
- Do not change production architecture merely to satisfy a testing preference.
  Restructure when needed for the requested fix; propose independent refactors.
- Use existing automation when it covers the changed behavior. Manual exercise
  is useful when it catches a risk automation does not, such as visual layout.
- Read only the relevant language file below when runner or fixture guidance is
  needed. Design guidance lives in `code-craft` and `database-craft`.

## Test the remainder

Types cannot prove computation, parsing edge cases, SQL, ordering, timing,
remote behavior, rendering, or wiring between processes. Put each at the
strongest test rung that proves it:

| Property | Rung | How |
| --- | --- | --- |
| Pure computation: formatting, ranking, diffing, date math, parsers | Unit | Call it directly with real values |
| Service logic | Unit | Typed doubles at its declared dependencies |
| Rendered controls | Unit | The real component with typed props and injected services |
| Queries, repositories, constraints, jobs, migrations | Integration | Real Postgres ([database-craft](../database-craft/SKILL.md)) |
| Provider SDKs and transport | Integration | The real client against Vercel Emulate |
| Native modules, files, processes | Integration | Real code, fixture SQLite, temporary directories, throwaway Git repositories |
| Navigation, authentication, wiring between processes and platforms | End-to-end | A small deterministic set that gates releases |

Unit tests outrank integration tests, which outrank end-to-end tests: each step
down is slower, noisier, and covers fewer inputs per run. Choose a lower rung
only for what the higher one cannot show.

## Keep the suite minimal

- Do not test what a type, lint rule, effect signature, proof, or constraint
  already proves.
- Prove each property at one rung. A route test does not repeat its repository's
  SQL cases; an end-to-end flow does not repeat a formatter's edge cases.
  Contract suites are the one deliberate exception.
- When a stronger rung takes over a test's cases, delete the test and name the
  new owner. Run any replacement before deleting.
- When moving or deleting coverage, keep the ownership, concurrency,
  cancellation, invalid-input, and failure cases that still need a test.
- Guard proof and ownership boundaries with compile-fail checks: lines that
  assert a type error, so loosening a proof type breaks the build. Do not add
  them for ordinary types.
- Do not restate the implementation in a test, and do not expose private
  helpers solely for testing.

## Doubles

Doubles are fine once the stronger rungs have done their work. Types fix a
dependency's shape, effects fix what it requires and how it fails, and proofs
fix its preconditions, so a typed double can stand in for its behavior in unit
tests. A double cannot show that the real dependency still behaves that way;
smoke tests cover that.

- **Typed against the real interface.** The compiler must reject a double that
  drifts in shape: build it from the service's interface, or type it as the real
  function. An untyped double (`as any`, `as unknown as`) is a cast.
- **Replace dependencies, not the thing being proven.** Testing SQL needs
  Postgres, and testing a provider's protocol needs the emulator. The logic that
  calls them can use doubles. Never double the unit under test.
- **Prefer existing seams.** Provide a test implementation at a service tag or
  pass a typed parameter before reaching for a module mock, which ties the test
  to file layout.
- **Drive the declared failures.** Typed failures make each error variant cheap
  to reach through a double; cover the ones the caller handles.
- **Assert outcomes.** Assert calls only when the call is the contract, such as
  sending one email, skipping the network on a cache hit, or checking
  authorization before a write. Assert only the relevant calls and arguments.
- **Contract suites when a fake carries behavior.** When a shared fake models
  state, pagination, or errors that many tests rely on, write the cases every
  implementation promises once and run them against both the fake and the real
  implementation. Change the contract first when the real behavior changes.

### Smoke tests are sentinels

Every integration point keeps at least one test against the real thing:
Postgres, each provider (through Emulate or the provider's sandbox), each
process boundary, and each app surface through an end-to-end test. Cover the
main path plus whatever only the real thing can break: authentication,
serialization, transport. The smoke test exists to fail when the integration
point drifts; it is not a second copy of the unit cases.

## Real collaborators

At the integration rung, use real storage: isolated database instances,
fixture SQLite, temporary directories, and throwaway Git repositories.

For provider and service APIs, use
[Vercel Emulate](https://github.com/vercel-labs/emulate). Prefer a built-in
provider; use a custom emulator for unsupported APIs or the project's own
services. Install its upstream `emulate` skill into the repository through the
project's skill installer and read it before use. Declare the test dependency in
every workspace that imports it.

- Drive the real SDK or client over native HTTP. Inject the emulator's URL
  through the existing dependency boundary. Preserve headers, bodies, and
  cancellation.
- Decode request bodies in custom emulator routes with the same schema the
  application uses, and keep observable state. Canned success responses behind
  an HTTP server do not prove an integration.
- Give each fixture its own state and an OS-assigned port (`port: 0`). Reset or
  recreate state between scenarios, and await cleanup even after failure. Never
  share mutable state, fixed ports, or persistence files across parallel
  worktrees.
- Exercise relevant failures through the service boundary. Check authorization,
  pagination, retries, and cancellation when they are part of the contract.

Report a tool limitation instead of silently substituting a lower-fidelity test
and calling it integration or end-to-end.

## End-to-end tests gate releases

Keep a small deterministic set that drives the running application, public CLI,
or packaged app and asserts what its user observes, including persisted
effects. Gate releases on deterministic assertions only; a model judgment may
explain a failure but never gates. A rendered component test alone does not
prove navigation, authentication, or native platform wiring.

## Avoid implementation-mirroring tests

Source-text assertions and exact internal call scripts often pin an
implementation without protecting its contract. For a suspect test, identify:

- The behavior it protects.
- A concrete defect that would make it fail.
- Whether it rejects a valid implementation with the same behavior.

Rewrite brittle assertions to check results, state, rendered output, or external
effects. Delete a test that cannot catch a real defect missed by a stronger
rung. Keep checks that enforce documented repository policy.

## Write readable tests

- Name the scenario and expected outcome. Keep cause and effect visible.
- Keep relevant inputs and expectations in the test body. Helpers may hide
  irrelevant construction; table-driven cases are useful for parallel scenarios.
- Route a family of cases through one `check(input, expected)` helper, so an
  API change edits the helper instead of every test. Use inline snapshot
  (expect) tests when the expected output is large or changes often.
- Do not compute expected results by repeating the production algorithm.
- Choose distinct values that expose swapped inputs or accidental defaults.
  Include empty, zero, and boundary values when those are the behavior under test.
- Assert the fields that matter. Use full-object equality when the whole object
  is the contract, rather than a broad snapshot of incidental details.
- Make failures show expected and actual values.
- Cover relevant failure paths and boundaries. Use property tests when invariants
  or a large input space justify them, not merely because a library is available.

## Keep tests deterministic

- Wait for completion signals or observable conditions with a timeout; do not
  sleep for an arbitrary duration and assume work finished.
- Control time and randomness when they affect the result.
- Isolate mutable state between tests.
- Make important failures reproducible through a controlled dependency or input.

## Establish regression sensitivity

For a bug fix, reproduce the failure first at the strongest rung that shows it:
a type that rejects the bad state, or a failing test. Confirm it fails for the
intended reason, then passes with the fix. If the real failure cannot be
reproduced, state the evidence and remaining uncertainty.

For other changes, identify the defect the assertion detects. Use targeted
mutation when sensitivity is uncertain or the risk warrants it. If mutating
production code, isolate the experiment and restore it before continuing.

Inverting an assertion checks execution, not sensitivity to the intended defect.
Routine test edits and green-to-green refactors do not require production
mutations. Preserve the behaviors covered and compare relevant results before
and after a refactor. Report verification you could not perform.

## Leave repeatable proof

Name the guarantee: which invalid input, state, or call no longer compiles or
constructs, and where. For each remaining test, name the defect it catches and
its rung.

End each end-to-end test with a verifiable artifact: its exact command or
replayable flow and the output, screenshot, or recording it produced. Use the
project's artifact directory and publication rules.

Run focused scenarios during iteration and the required full gates before
shipping. Repeat a passing check only after relevant edits, failures, or an
unresolved risk. Measure slow suites before changing their execution; preserve
isolation and useful coverage when improving runtime.

## Language references

Read the relevant file when runner, fixture, or async-test details are needed:

- [Rust](languages/rust.md)
- [TypeScript / JavaScript](languages/typescript.md)
- [Go](languages/go.md)
- [Python](languages/python.md)

For other languages, follow the project's conventions.

## Provenance

Adapted from Google's Testing on the Toilet series, including behavior-focused
tests, test doubles, DAMP, and SMURF. The source episodes are indexed in
[references/episodes.md](references/episodes.md), by way of
[shamashel/testing-on-the-toilet](https://github.com/shamashel/testing-on-the-toilet),
and from matklad's [How to Test](https://matklad.github.io/2021/05/31/how-to-test.html).
