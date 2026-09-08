---
name: code-craft
description: "Use when writing, reviewing, or refactoring code."
user-invocable: true
argument-hint: "[rust|typescript|go|python] [target]"
---

# Code Craft

A small set of durable, language-agnostic engineering principles, plus a router
to the dialect of whatever language you are actually editing. The principles are
the same everywhere; only the spelling changes.

## How to use this skill

1. **Apply the core below where it improves the requested change.** These are
   defaults, not reasons to refactor unrelated code.
2. **Detect the language(s) in scope** from the files being touched (see the
   detection guide), then **read `languages/<lang>.md` when needed** for its
   idioms and tooling. Load only the language(s) you are working in.
3. **Read `principles/<name>.md` for depth** when a principle is the crux of the
   change (a boundary redesign, an error-model decision). The core below is the
   summary; the principle file is the workflow and the nuance.
4. Run the project's required checks and verification appropriate to the change.
   A review does not require running the full suite. Report checks not performed.

## Universal core

Each principle links to a deeper file and maps into every language file.

### 1. Make illegal states unrepresentable

Encode invariants in the type system so the bad case cannot be constructed, not
in a name, comment, or convention that a caller can ignore. A wrapper that only
renames a value buys nothing; a type whose only constructor enforces the
invariant buys everything. Prefer enums/unions for mutually exclusive states
over flag soup, and structured data over a string that has to be re-parsed.
Depth: [`principles/illegal-states.md`](principles/illegal-states.md).

### 2. Parse, don't validate

At boundaries where external data enters (config, JSON/TOML, CLI/env, network,
user edits), parse it into a usable type and pass that value inward. Prefer
returning refined data over validating and continuing to pass the raw value.
Use the language's type system where it reduces misuse. Depth:
[`principles/parse-dont-validate.md`](principles/parse-dont-validate.md).

### 3. Errors are values; gates fail closed

Handle expected failure through the language's value channel (Result, error
return, typed exception), not by crashing on recoverable conditions. Add context
as the error propagates so the message is a chain, not a single line. Never
silently swallow an error. A gate or check that cannot produce a valid answer is
a block, never a quiet pass. Depth:
[`principles/errors-as-values.md`](principles/errors-as-values.md).

### 4. No stringly-typed data; newtypes over primitives

Use distinct types when mixing domain values would be a meaningful error, or
when a constructor preserves a useful invariant. Do not wrap every primitive
solely to replace its name. This is the everyday form of principle 1. Depth:
[`principles/illegal-states.md`](principles/illegal-states.md).

### 5. Mind ownership and copies, but clarity first

Avoid copying or allocating when borrowing or referencing is correct and clear,
especially in loops and hot paths. Accept the most general input type (a view,
not an owned container). This matters most in Rust and C-family code and least
in GC'd languages, but unnecessary deep copies and re-allocations are a smell
everywhere. Do not contort readable code for a copy you have not measured.

### 6. Testing lives in testing-craft

All test guidance (behavior over implementation, change-detector tests, test
doubles, layer choice, DAMP structure, determinism, property-based tests,
per-language test dialects) moved to the
[`testing-craft`](../testing-craft/SKILL.md) skill. Use it whenever you
write or review tests. The slot keeps its number so the other principles'
cross-references stay valid.

### 7. Architecture docs are a stable map

Keep a short, durable description of module boundaries, invariants, and
cross-cutting concerns. Name the important modules and the deliberate absences
("X stays out of layer Y"). When code moves, update the map rather than adding a
migration note. Keep churny detail in code comments, not the map. Depth:
[`principles/architecture-docs.md`](principles/architecture-docs.md).

### 8. Earn your abstractions; profile before optimizing

Prefer the smallest correct thing. Do not add generics, traits/interfaces,
layers, or indirection before there are two real callers that need them. Do not
optimize on a hunch: measure first, then optimize the proven hot path, then
measure again. Premature abstraction and premature optimization are the same
mistake (acting on a future that has not arrived). Depth:
[`principles/simplicity.md`](principles/simplicity.md).

### 9. Keep repository setup separate

Follow the existing toolchain. Ordinary coding, prototyping, and hardening do
not authorize new governance files, agent review gates, or release infrastructure.
When the user requests repository setup, use
[`project-bootstrap`](../project-bootstrap/SKILL.md) for Jess's defaults.

## Language router

Read the relevant language file when its details are needed: tooling,
concurrency, naming, project layout, and language-specific patterns.

| Language | File | Detect by |
|---|---|---|
| Rust | [`languages/rust.md`](languages/rust.md) | `*.rs`, `Cargo.toml` |
| TypeScript / JavaScript | [`languages/typescript.md`](languages/typescript.md) | `*.ts`, `*.tsx`, `*.js`, `tsconfig.json`, `package.json` |
| Go | [`languages/go.md`](languages/go.md) | `*.go`, `go.mod` |
| Python | [`languages/python.md`](languages/python.md) | `*.py`, `pyproject.toml`, `requirements.txt` |

For a language not listed, apply the universal core directly and follow the
project's existing conventions; the principles are designed to transfer.

## Precedence

Project instructions and existing code conventions win over this skill. If a
repo's `AGENTS.md`/`CLAUDE.md` or its established patterns conflict with a
principle here, follow the repo and say so. This skill is the default, not an
override.

## Provenance

Distilled from `leonardomso/rust-skills` (MIT), Matklad's Rust100k series, and
Alexis King's "Parse, don't validate" and "Names are not type safety", then
generalized beyond Rust.
