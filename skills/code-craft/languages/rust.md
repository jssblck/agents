# Rust dialect

How the universal core is spelled in Rust, plus Rust-specific idioms. Distilled
from the Rust API Guidelines, the Performance Book, and production crates
(ripgrep, tokio, serde, axum).

## Tooling baseline

```sh
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

Lints worth setting at the crate/workspace root:

```rust
#![warn(clippy::all, clippy::pedantic)]   // pedantic selectively; allow the noisy ones
#![deny(clippy::correctness)]
#![warn(missing_docs)]                      // for libraries
```

Deny `clippy::inline_always` and `clippy::unnecessary_wraps` (the latter catches
functions that claim fallibility they do not have). Configure lints in
`Cargo.toml` `[lints]` for a workspace.

## Illegal states (core 1, 4)

- **Newtypes with private fields + smart constructors.** Not
  `pub struct UserId(pub String)` (a public field is a trapdoor). Use a private
  field and a constructor that parses:
  ```rust
  pub struct Email(String);
  impl Email {
      pub fn parse(raw: &str) -> Result<Self, EmailError> { /* check, then wrap */ }
      pub fn as_str(&self) -> &str { &self.0 }
  }
  ```
- **Enums for states.** Model mutually exclusive states as an `enum` with data on
  the variant. Use `#[non_exhaustive]` on public enums/structs you may extend.
- **Typestate** for compile-time state machines (a builder that only exposes
  `.build()` once required fields are set), `PhantomData` for type-level markers.
- **Do not derive your way around an invariant.** Be careful with `From`,
  `Deref`/`DerefMut`, and `#[serde(...)]` on checked types; deserialization can
  reconstruct an invalid value unless it goes through the parser (use
  `#[serde(try_from = "Raw")]`).
- Wrap IDs and units: `OrderId(u64)`, `Cents(i64)`. `#[repr(transparent)]` for
  FFI-safe newtypes.

## Parse, don't validate (core 2)

- Raw serde structs at the boundary, a checked domain type inside, a parser
  between. Name the checked form: `CheckedConfig`, `VerifiedPlan`.
- Return the parsed value, not `Result<(), E>`. `clippy::unnecessary_wraps`
  helps; treat `parse* -> Result<()>` and `validate* -> Result<()>` as smells.
- Accept the most general input: `&str` not `&String`, `&[T]` not `&Vec<T>`,
  `impl AsRef<Path>` for paths, `impl Into<String>` where you will own a string.

## Errors (core 3)

- **Server stack:** snafu, as above.
- **Libraries elsewhere:** typed errors with the project's library (`snafu` or
  `thiserror`), one enum of failure modes, `#[source]` to chain. Document them
  with a `# Errors` section.
- **Applications / top level:** `eyre` or `anyhow` in `main` only, with context
  added as the error propagates.
- **Bugs only:** where the lints allow it, `.expect("invariant: ...")` for
  things that cannot happen; never `.unwrap()` in production paths. Under the
  server stack's lints, return the operation's `Internal` variant instead.
- **Fail closed:** a gate that errors or times out returns the block verdict, not
  a default pass.
- Error messages: lowercase, no trailing period.

## Server stack: Effect, taken apart

For new Rust servers and the full project template, Jess's stack is tokio,
axum, snafu, aerosol, and sqlx, with nextest, Clippy, and Nudge. In an existing
repository, use its equivalents; adopting these is an architecture change to
ask about first.

Rust has no effect tracking, so the stack splits Effect's `Effect<A, E, R>`
across plain Rust and lints. `E` is a `Result` with a small typed error enum,
`R` is a capability list in the signature, and the crate graph, Clippy, and
Nudge enforce both. It gives up Effect's fiber and scope runtime: there is no
async drop, cancel safety is manual, and structured concurrency is a
convention.

### Requirements: aerosol capability rows

A function takes its capabilities as an aerosol row; the row is its effect
signature. Each capability is a newtype over a trait object, so tests swap the
`Raw` implementation while the row keeps naming the newtype:

```rust
pub trait RawMailer: Send + Sync {
    fn send(&self, to: &str, body: &str) -> Result<(), MailError>;
}
#[derive(Clone)]
pub struct Mailer(Arc<dyn RawMailer>);

pub fn remind(deps: &Aero![Clock, Mailer], to: &str) -> Result<(), RemindError> {
    let Clock(clock) = deps.get();
    let Mailer(mailer) = deps.get();
    let sent_at = clock.now();
    mailer
        .send(to, &format!("reminder at {sent_at:?}"))
        .context(SendSnafu { to })
}

// A caller with a wider row narrows it at compile time.
pub fn handle(state: &Aero![Db, Clock, Mailer]) -> Result<(), RemindError> {
    remind(state.as_ref(), "grace@example.com")
}
```

- Use only the statically checked accessors outside the place that assembles
  the container: `get`, plus `as_ref` and `into` to narrow a row. `try_get`,
  `obtain`, `try_obtain`, `try_as_ref`, `try_into`, and the axum `Dep` and
  `Obtain` extractors are checked at runtime and bypass the row; ban them
  elsewhere with `disallowed_methods` and `disallowed_types`.
- Ambient effects are capabilities too. Ban `Instant::now`, `SystemTime::now`,
  `std::env::var`, and `reqwest::Client::new` outside assembly with
  `disallowed_methods`.

### Failures: snafu

- One small snafu enum per operation, not a crate-wide `Error` that hides which
  failures can occur.
- Every `?` on a foreign error goes through `.context(SomeSnafu { .. })`, so
  each propagation names a variant. No blanket conversions: no `#[from]`, no
  `context(false)`, no hand-written `impl From<..> for ..Error`.
- `eyre` only in `main`. `disallowed_types` bans `eyre::Report`,
  `anyhow::Error`, and `snafu::Whatever` elsewhere.
- One exhaustive `match` at the HTTP boundary maps each variant to a status
  code and a retryable flag, with no `_` arm. Log errors once, there.
- An invariant violation returns a single `Internal` variant with its captured
  location, mapped to 500 and an alert. tower-http's `CatchPanicLayer` catches
  panics.

### Lints

Set once in `[workspace.lints]`, all failing the gate:

- No panicking shortcuts: `unwrap_used`, `expect_used`, `panic`, `todo`,
  `unimplemented`, `unwrap_in_result`.
- No swallowing: `let_underscore_must_use`, `unused_result_ok`,
  `map_err_ignore`, and rustc's `unused_must_use` as deny.
- No catch-alls: `wildcard_enum_match_arm`.
- No quiet suppressions: `allow_attributes` and
  `allow_attributes_without_reason`; use `#[expect(lint, reason = "...")]`.

Clippy takes bans that need type resolution; Nudge takes textual patterns at
write time, and `nudge check` runs the same rules in CI.

### Proofs and the database

- **Proofs:** a witness type with a private field, minted only by the module
  that runs the check. To tie a proof to one value, brand both with an invariant
  lifetime; the `generativity` crate implements the Ghosts of Departed Proofs
  `name` for Rust.
- **Database:** sqlx lives in a store crate, and the pure domain crate has no
  I/O dependencies. Store functions take `&mut PgConnection` explicitly. A
  request does its work in one transaction and preferably one statement, which
  keeps handlers atomic when axum drops a cancelled handler future; see
  [database-craft](../../database-craft/SKILL.md). `query!` checks SQL against
  the schema at compile time, which moves query shape up to the first rung; CI
  runs `cargo sqlx prepare --check`.

## Ownership and copies (core 5)

- Borrow over clone; clone only when you need owned data (storage, `'static` for
  a spawned task) and make it explicit.
- `Cow<'a, T>` for conditional ownership (borrow the common case, own only when
  you must mutate). `Arc<T>` for shared ownership across threads, `Rc<T>`
  single-threaded.
- Interior mutability: `Mutex`/`RwLock` (multi-thread), `RefCell` (single).
  `RwLock` when reads dominate.
- `with_capacity` when the size is known; reuse buffers with `clear()` in loops;
  `write!` into a buffer instead of `format!` in hot paths. `SmallVec`/`ArrayVec`
  for usually-small collections. Box large enum variants so the enum is not sized
  to its biggest case.
- Prefer iterators over manual indexing (avoids bounds checks, clearer); keep
  them lazy, `collect()` once at the end.

## Async (Rust-specific)

- Tokio for production. **Never hold a `Mutex`/`RwLock` guard across `.await`**
  (clippy `await_holding_lock`): clone the needed data and drop the guard first,
  or use `tokio::sync` primitives deliberately.
- `tokio::join!` for parallel awaits, `try_join!` when fallible, `select!` for
  racing/timeouts, `JoinSet` for dynamic task groups. `spawn_blocking` for CPU
  work or sync IO. `tokio::fs` not `std::fs` in async code.
- Channels: bounded `mpsc` for backpressure, `oneshot` for request/response,
  `watch` for latest-value, `broadcast` for pub/sub. `CancellationToken` for
  shutdown.

## Naming

`UpperCamelCase` types/traits/variants, `snake_case` fns/methods/modules,
`SCREAMING_SNAKE_CASE` consts. Conversions: `as_` (cheap borrow), `to_`
(expensive), `into_` (consumes). No `get_` prefix on simple getters. `is_`/`has_`
for booleans. Acronyms as words (`Uuid`, not `UUID`). Crates: no `-rs` suffix.

## Project structure

Keep `main.rs` thin, logic in `lib.rs`. Modules by feature, not by type. Flat
while small. `pub(crate)`/`pub(super)` for internal visibility, `pub use` to
curate the public surface. Workspaces for large multi-crate projects with shared
`[workspace.dependencies]`.

## Testing (core 6)

Keep tests out of `src/`: libraries set `test = false`, and one `tests/it`
crate holds every test. See the testing-craft skill:
[`testing-craft/languages/rust.md`](../../testing-craft/languages/rust.md).

## Docs

`///` on public items, `//!` for module docs. `# Examples` (runnable in
published crates; internal crates set `doctest = false`),
`# Errors`, `# Panics`, `# Safety` (for `unsafe`) sections. Intra-doc links
(`[Vec]`). Document every `unsafe` block with a `// SAFETY:` comment
(`clippy::undocumented_unsafe_blocks`).

## Anti-patterns to refuse

`.unwrap()`/`.expect()` on recoverable errors; cloning where a borrow works;
holding a lock across `.await`; `&String`/`&Vec<T>` in signatures; indexing where
an iterator reads cleaner; `panic!` on expected errors; empty `if let Err(_) =`;
`Box<dyn Trait>` where `impl Trait` works; stringly-typed data; `format!` in hot
paths; over-generic abstractions with one caller.

## Release profile (for performance-sensitive binaries)

```toml
[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
strip = true
```
