# Rust testing dialect

How the universal core is spelled in Rust tests.

Runner: `cargo nextest run` in the server stack, `cargo test` elsewhere.

## One test crate

Unit tests are welcome; Cargo's in-crate unit-test target is not. A
`#[cfg(test)]` module makes Cargo compile the library a second time with
`--cfg test`, and every file directly under `tests/` links its own binary
against the library. Both cost compile and link time on every run. Following
matklad's
[Delete Cargo Integration Tests](https://matklad.github.io/2021/02/27/delete-cargo-integration-tests.html):

- Set `test = false` on each `[lib]` and `[[bin]]` target, and keep `src/` free
  of `#[cfg(test)]` and `mod tests`. Under `test = false` a stray in-crate test
  compiles away and never runs, so keep the Nudge rule that rejects one.
- Put every test, unit through integration, in one test crate: `tests/it/main.rs`
  with a module per area. The library links once, and shared helpers are plain
  modules. In a workspace, one test crate covers every library.
- Make what a test needs public, or reach it through the crate's API; do not
  move tests back into `src/` for private access.
- Set `doctest = false` on internal crates; each doctest links its own binary.
  Published libraries keep runnable examples and run `cargo test --doc`, which
  nextest does not run.

## Writing the tests

- Unit tests call the pure domain crate's public functions directly. Test
  capability-backed logic by building the aerosol row with fake `Raw`
  implementations behind the real capability newtypes; the compiler holds each
  fake to its trait.
- Route a family of cases through one `#[track_caller] fn check(input,
  expected)`, so an API change edits the helper instead of every test. Use
  `expect-test` or `insta` when the expected output is large or changes often.
- Never fake Postgres. `#[sqlx::test]` gives each test its own migrated
  database; store functions take `&mut PgConnection`, so tests pass the
  connection it provides.
- Drive workflows through the HTTP surface at the integration rung. Use the real
  HTTP client against Vercel Emulate for providers, with custom emulators for
  unsupported or owned APIs.
- Gate slow tests behind an environment variable that CI sets, not behind
  `cfg`, so they still compile with everything else.
- `#[tokio::test]` for async. Use `tempfile` directories and throwaway Git
  repositories for file and repository fixtures.
- Keep compile-fail checks for proof types with `trybuild` in the test crate.
- `proptest` for properties, `criterion` with `black_box` for benchmarks.
