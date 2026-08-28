---
name: testing-craft
description: Use when writing, reviewing, or refactoring tests in any language. Test behavior at real boundaries, delete change-detector tests, choose doubles in order (real, fake, stub, mock), pick the cheapest layer that catches the risk (SMURF), author tests DAMP, keep them deterministic, prove they can fail, with dialects for Rust, TypeScript, Go, and Python.
user-invocable: true
argument-hint: "[rust|typescript|go|python] [target]"
---

# Testing Craft

Durable, language-agnostic testing principles, plus a router to the dialect of
whatever language you are testing. A test earns its keep by failing when
behavior breaks and staying green through refactors.

## How to use this skill

1. **Apply the universal core below.** It holds in every language.
2. **Detect the language(s) in scope** from the files being touched, then
   **read `languages/<lang>.md`** for the test runner, fixture tools, and
   property-test library in that dialect. Load only the language(s) in scope.
3. Run the project's own test suite (plus its type-check and lint gates) before
   claiming done.

For general code quality while writing the code under test, use the
[`code-craft`](../code-craft/SKILL.md) skill; this one covers the tests.

## Universal core

### 1. Test behavior at the boundary, not the wiring

Pick the feature boundary first, then test inputs to outputs across it. Good
boundaries are the ones a user or a caller actually cares about: config
parsing, request handling, a planning/translation step, a state transition.
Tests that poke internal helpers directly tend to pin the current
implementation and break on every refactor while catching few real bugs.

Prefer the public API. Exhaustive tests of a private helper, fed inputs no
caller ever passes, are change detectors in disguise; if the helper deserves
that much testing, it deserves to be a public unit.

A `check(input) -> expected_output` helper with a table of cases beats a dozen
tests that each call private functions. Data in, data out, assert on the data.

### 2. No change-detector tests

A change-detector test is a transformation of the same information as the code
under test. The absurd form reads the production source and asserts each line;
that is obviously a checksum, not a test. The common form is only superficially
different: mock every collaborator and verify the exact sequence of internal
calls.

```
// Production code:
def process(w: Work)
  firstPart.process(w)
  secondPart.process(w)

// Test code:
part1 = mock(FirstPart)
part2 = mock(SecondPart)
w = Work()
Processor(part1, part2).process(w)
verify_in_order
  was_called part1.process(w)
  was_called part2.process(w)
```

This test restates the implementation. A correct and an incorrect program are
equally likely to pass it, and any change to the production code breaks it
without verifying the behavior of either version.

The symptom: a refactor with no behavior change turns the suite red, and
fixing it means mechanically applying one transformation across many tests
(add a parameter, update a hundred call sites with an empty string). When a
test failure is fixed by mirroring the production edit rather than by thinking
about behavior, the test is a change detector.

Change detectors have negative value: they catch no defects and their
maintenance cost slows every future change. Rewrite them to assert state, a
return value, rendered output, or persisted data, or delete them. Deletion is
a valid fix; a test that cannot fail for a real reason protects nothing. Two
questions expose one: could this test fail while observable behavior stays
correct? Could behavior break while this test passes? A yes to either means
rewrite or delete.

### 3. Keep the core IO-free

Push IO (filesystem, network, clock, randomness) to the edges so the core
logic is a pure function you can test by building values in memory. A function
that takes the parsed config and returns a plan is trivial to test; one that
reads the file, calls the network, and writes the result is not. Separate
them.

Give the shell honest seams: inject long-lived collaborators through the
constructor and pass per-call data as method arguments. A hidden singleton, a
static call, or a `now()` buried inside the logic under test is a dependency
the test cannot control.

### 4. Choose the double: real, fake, stub, mock, in that order

Mocks that record "method X was called with Y" test the implementation, not
the behavior (see change detectors above), and they drift from reality. Work
down this list and stop at the first entry that fits:

1. **The real thing**, when it is fast, deterministic, and in-process: pure
   functions, real temp directories, throwaway git repos, ephemeral databases
   (`sqlx::test`, testcontainers), a real local HTTP server.
2. **A fake**: a simplified working implementation of the contract (an
   in-memory backend, a hermetic server), maintained by whoever owns the real
   type. Keep it narrow. If a fake is shared, contract-test it against the
   real implementation so the two cannot drift.
3. **A stub**: canned return values for queries. Never verify that a query or
   getter was called; a query has no side effect worth asserting.
4. **A mock**, last: verify only state-changing calls whose occurrence is
   itself the contract (charge the card once, send exactly one email, tell the
   view to show X), and verify only the arguments that matter. If you are
   unsure whether the call is the contract, rewrite to a state or return
   assertion.

Two hard rules:

- **Do not mock types you do not own.** A mock of a third-party API encodes
  your guess about its behavior and goes stale silently. Wrap the library in a
  thin interface you own, double the wrapper, and test the wrapper against the
  real library.
- **Needing to mock more than one or two collaborators is a seam smell.** So
  is a long stub/verify chain. The fix is in the production code: extract a
  narrower port and fake that.

If you find yourself asserting on call counts and argument matchers, you are
testing the wrong layer.

### 5. Pick the cheapest layer that still catches the risk

Name the bug you are defending against first, then take the topmost row of
this table that can catch it. Escalate a row only when the cheaper layer would
miss the risk, and say what it would miss.

| Risk | Layer |
|---|---|
| Pure logic, parsing, validation, state transitions | Fast unit test through the public API |
| Collaborators you own, in-process | Real objects or an owner-maintained fake |
| Service or HTTP contract | Owner-maintained fake or hermetic server, not a handwritten request mock |
| UI wiring (disabled, unbound, hidden controls) | Drive the rendered control (click, type), not the handler function |
| Cross-system critical path | A tiny end-to-end set: one path per use case plus the key error classes, asserting system outcomes, not copy or layout |

When two layers could both catch the risk, compare them on **SMURF**: Speed,
Maintainability, Utilization (resource cost), Reliability, Fidelity. Prefer
the faster, cheaper, more reliable layer.

On coverage: meters find untested gaps; they do not certify quality. Cover
both sides of every branch (an `if` with no `else` still has an implicit else
worth a case). Do not enumerate input combinatorics; extract each predicate
and cover it independently.

Keep unit tests in-source and close to the code, keep integration tests few
and high-value behind one modular surface, and use doctests or runnable
examples where the language supports them cheaply; they keep docs honest.

### 6. Author tests DAMP

Tests have no tests, so a reader must be able to verify one by eye. That means
DAMP (descriptive and meaningful phrases) beats DRY inside a test body: prefer
a little repetition over indirection that hides cause and effect.

- One behavior per test. Name the test for the scenario and the outcome it
  pins: `parses_empty_config_as_default`, not `test_config_2`. The name should
  read as a sentence about the system.
- Arrange / act / assert in one block. Setup soup in a distant shared fixture
  is how wrong expected values sneak in. Multiple asserts are fine if they
  describe one outcome.
- Helpers and builders may hide irrelevant construction; every value the
  scenario depends on stays visible in the test body. Do not assert against a
  default a helper set silently.
- No logic in tests: literal inputs, literal expected outputs. A loop or
  conditional that computes the expectation can share a bug with production.
  If a helper genuinely needs logic, unit-test the helper.
- Pick distinct, non-default values for each input. `0`, `""`, and the first
  enum variant match zero-initialized memory and let a broken implementation
  pass by accident.
- Assert narrowly: the fields under test, not a whole-object snapshot whose
  irrelevant churn breaks the test. One full-equality check on the common
  happy object is enough.
- Make failures actionable: precise matchers that print expected vs. actual
  (`contains_entry`, an `is_ok` that shows the error) over a bare
  `assert(result.ok())`. Compare floats with a tolerance, never exact
  equality.
- Cover the unhappy paths: invalid input, empty input, boundary values, the
  error branches. Bugs live there.

### 7. Determinism

Flaky tests are worse than no tests because they train people to ignore red.

- **No sleeps for synchronization.** Do not `sleep(100ms)` and hope the work
  finished. Expose a join handle, a completion channel, a callback, or an
  observable side effect, and wait on that with a timeout.
- **Control time and randomness.** Inject the clock and tick it; seed the RNG
  so a test is reproducible.
- **Isolate state.** Each test gets its own temp dir / database / fixture; no
  shared mutable global that leaks between tests and orderings.
- **Force rare failures through the double.** Timeouts, connection errors, and
  torn writes must be producible on demand; live infrastructure cannot do that
  for you.

### 8. Property-based tests

When the input space is large or has invariants (round-trip encode/decode,
sort is a permutation, parse then serialize equals input), use property tests
(proptest, fast-check, gopter, hypothesis) to generate cases and shrink
failures. They find the edge you did not think to write.

### 9. Prove the test can fail

A test proves nothing until you have seen it red for the right reason.

- **Writing a test:** run it green, then break the production code (or invert
  the assertion), confirm it fails with a useful message, and restore.
- **Reviewing a test you cannot run:** name the one concrete behavior bug this
  assertion would catch. If you cannot, treat it as a change detector and do
  not approve it.
- **Refactoring tests:** put production in a known-broken state first, so an
  assertion dropped during cleanup shows up as an unexpected green; then
  restore. Never do green-to-green test cleanup without that check.

## Review checklist

A test you would merge:

- [ ] Would fail on a real behavior bug, not only on a rename or extract
- [ ] Asserts a result or state, not a call script (unless the call is the
      contract)
- [ ] Exercises the public API or a user-facing path, not a private helper
- [ ] Keeps cause and effect visible; the name states the outcome
- [ ] Is deterministic: clock, IO, and fixture isolation handled
- [ ] Fails with a message that starts the fix without extra logging

## Language router

Detect the language, then read its file for the runner, fixture idioms, async
test support, and property-test library.

| Language | File | Detect by |
|---|---|---|
| Rust | [`languages/rust.md`](languages/rust.md) | `*.rs`, `Cargo.toml` |
| TypeScript / JavaScript | [`languages/typescript.md`](languages/typescript.md) | `*.ts`, `*.tsx`, `*.js`, `tsconfig.json`, `package.json` |
| Go | [`languages/go.md`](languages/go.md) | `*.go`, `go.mod` |
| Python | [`languages/python.md`](languages/python.md) | `*.py`, `pyproject.toml`, `requirements.txt` |

For a language not listed, apply the universal core directly and follow the
project's existing test conventions; the principles transfer.

## Precedence

Project instructions and existing test conventions win over this skill. If a
repo's `AGENTS.md`/`CLAUDE.md` or its established patterns conflict with a
principle here, follow the repo and say so. This skill is the default, not an
override.

## Provenance

Distilled from Google's Testing on the Toilet series (2007-2026): the
change-detector section is from Alex Eagle's "Change-Detector Tests Considered
Harmful" (2015), and the double taxonomy, layer table, SMURF, DAMP rules, and
prove-it-can-fail loop follow the episodes indexed in
[`references/episodes.md`](references/episodes.md), by way of
[`shamashel/testing-on-the-toilet`](https://github.com/shamashel/testing-on-the-toilet)'s
distillation. The rest was carved out of the code-craft skill's testing
principle.
