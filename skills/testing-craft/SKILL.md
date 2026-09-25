---
name: testing-craft
description: "Use when writing, reviewing, or refactoring tests, or choosing verification for a code change."
user-invocable: true
argument-hint: "[rust|typescript|go|python] [target]"
---

# Testing Craft

Prefer end-to-end tests that prove a feature works through its public boundary.
Use real integration coverage when a full end-to-end flow is impractical. Keep
an isolated test only for a specific defect the broader coverage reasonably misses.

## Scope and verification

- Identify the behavior being changed and the specific defect each new or
  modified test should catch. A test need not detect unrelated defects.
- Follow project instructions and existing test conventions over these defaults.
- Run affected tests and required checks. Broaden coverage when the change's
  dependencies, failures, or unresolved risks justify it.
- Do not change production architecture merely to satisfy a testing preference.
  Restructure when needed for the requested fix; propose independent refactors.
- Read only the relevant language file below when runner or fixture guidance is
  needed. General code guidance lives in `code-craft`.

## Choose the boundary and layer

Use this order, rather than defaulting to unit tests because they run quickly:

1. Drive the running application, public CLI, or complete workflow. Assert what
   its user or caller observes, including persisted effects.
2. When a full flow is impractical, exercise real integration boundaries: routes,
   jobs, repositories, SDKs, transport, serialization, and rendered controls.
3. Retain isolated coverage only for a named failure that the broader tests cannot
   reasonably exercise, such as a substantial algorithm, race, or malformed input.
   Record the reason and the boundary it leaves untested.

Never write unit tests after the implementation to restate its code. Before
testing a system in isolation, enumerate its failure modes, write tests for those
failures, then implement it. Do not expose private helpers solely for testing.

Use existing automation when it covers the changed behavior. Manual exercise is
useful when it catches a risk that automation does not, such as visual layout.

## Avoid implementation-mirroring tests

Source-text assertions and exact internal call scripts often pin an
implementation without protecting its contract. For a suspect test, identify:

- The behavior it protects.
- A concrete defect that would make it fail.
- Whether it rejects a valid implementation with the same behavior.

Rewrite brittle assertions to check results, state, rendered output, or external
effects. Delete a unit test that cannot catch a real defect missed by the
end-to-end tests, integration tests, or type checker. Run its replacement before
deleting it, and preserve useful invalid-input, ownership, concurrency, and failure
cases. Renaming a mocked test does not strengthen its coverage. Keep checks that
enforce documented repository policy.

Interaction assertions are useful when the interaction is itself the contract,
such as sending one email, avoiding a network request on a cache hit, or checking
authorization before a write. Assert only the relevant calls and arguments.

## Choose collaborators

Use real repositories and storage: isolated database instances, fixture SQLite,
temporary directories, and throwaway Git repositories. Do not replace the
database behavior under test with a fake repository.

When a service double is needed, use [Vercel Emulate](https://github.com/vercel-labs/emulate).
Prefer a built-in provider; use a custom emulator for unsupported APIs or the
project's own services. Install its upstream `emulate` skill into the repository
through the project's skill installer and read it before use. Declare the test
dependency in every workspace that imports it.

- Drive the real SDK or client over native HTTP. Inject the emulator's URL through
  the existing dependency boundary. Preserve headers, bodies, and cancellation.
- Validate requests and maintain observable state. Canned success responses
  behind an HTTP server do not establish a working integration.
- Give each fixture its own state and an OS-assigned port (`port: 0`). Reset or
  recreate state between scenarios, and await cleanup even after failure. Never
  share mutable state, fixed ports, or persistence files across parallel worktrees.
- Exercise relevant failures through the service boundary. Check authorization,
  pagination, retries, and cancellation when they are part of the contract.

For a justified isolated failure case, inject only the dependency needed to
produce it. Avoid mocking the project's own functions or scripting their internal
call sequence. Follow explicit project constraints; report a tool limitation
instead of silently substituting a lower-fidelity test and calling it end-to-end.

## Write readable tests

- Name the scenario and expected outcome. Keep cause and effect visible.
- Keep relevant inputs and expectations in the test body. Helpers may hide
  irrelevant construction; table-driven cases are useful for parallel scenarios.
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

For a bug fix, write the failing scenario before changing production code.
Confirm it fails for the intended reason, then passes with the fix. If the real
failure cannot be reproduced, state the evidence and remaining uncertainty.

For other changes, identify the defect the assertion detects. Use targeted
mutation when sensitivity is uncertain or the risk warrants it. If mutating
production code, isolate the experiment and restore it before continuing.

Inverting an assertion checks execution, not sensitivity to the intended defect.
Routine test edits and green-to-green refactors do not require production
mutations. Preserve the behaviors covered and compare relevant results before
and after a refactor. Report verification you could not perform.

## Leave repeatable proof

End each end-to-end test with a verifiable artifact: its exact command or
replayable flow and the output, screenshot, or recording it produced. Use the
project's artifact directory and publication rules. A rendered component test
alone does not prove navigation, authentication, or native platform wiring.

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
[shamashel/testing-on-the-toilet](https://github.com/shamashel/testing-on-the-toilet).
