---
name: code-craft
description: Apply Jess's engineering conventions to invariants, boundary typing, state, effects, proofs, error handling, and abstraction decisions.
user-invocable: true
argument-hint: "[rust|typescript|go|python] [target]"
---

# Code craft

Prove what the types can, then test only what they cannot. Every invariant has
one owner: the strongest rung of the [proof ladder](principles/proof-ladder.md)
that can actually prove it. In order: types and linters, effects, proofs,
database constraints, unit tests, integration tests, end-to-end tests.

Use the repository's current instructions and established conventions. Apply
these defaults where the requested change needs a design decision; they do not
authorize unrelated restructuring or new tooling.

Read the reference for the decision in scope:

| Decision | Reference |
| --- | --- |
| Decide which rung owns an invariant | [Proof ladder](principles/proof-ladder.md) |
| Represent states, workflows, and domain identities | [Illegal states](principles/illegal-states.md) |
| Decode external input into useful types | [Parse, don't validate](principles/parse-dont-validate.md) |
| Type dependencies, failures, and resource lifetimes | [Effects](principles/effects.md) |
| Model recoverable errors and required gates | [Errors as values](principles/errors-as-values.md) |
| Guard a sensitive precondition | [Proof parameters](principles/proof-parameters.md) |
| Choose an abstraction or investigate performance | [Simplicity](principles/simplicity.md) |
| Maintain module boundaries and their documentation | [Architecture docs](principles/architecture-docs.md) |

Read a language reference only when its idioms, concurrency, or tooling details
matter: [TypeScript](languages/typescript.md), [Rust](languages/rust.md),
[Go](languages/go.md), or [Python](languages/python.md).

For new TypeScript code and the full project template, Jess's stack is Effect,
Effect Schema or Zod, xstate, and gdp-ts. For new Rust servers it is tokio,
axum, snafu, aerosol, and sqlx. In an existing repository, use its equivalents;
adding any of these is an architecture change to ask about first.

Use [database-craft](../database-craft/SKILL.md) for schemas, constraints,
queries, and jobs, and [testing-craft](../testing-craft/SKILL.md) for the test
rungs. Repository setup belongs to
[project-bootstrap](../project-bootstrap/SKILL.md) when that setup is requested.
Follow the project's required verification; reviews do not automatically require
a full test suite.

Adapted from `leonardomso/rust-skills` (MIT), Matklad's Rust100k series, Alexis
King's writing on parsing and type safety, and Matt Noonan's Ghosts of Departed
Proofs.
