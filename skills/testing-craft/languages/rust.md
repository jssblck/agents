# Rust testing dialect

How the universal core is spelled in Rust tests.

Runner: `cargo test`.

- Inline `#[cfg(test)] mod tests { use super::*; }` while a module is small;
  migrate a large test body to a sibling `tests.rs` (`#[cfg(test)] mod tests;`)
  if test edits start forcing library recompiles.
- `#[tokio::test]` for async, `#[should_panic]` for panic paths.
- No mocks. Real pure functions, `tempfile` dirs, throwaway `git init` repos,
  `sqlx::test` for Postgres. A deterministic in-memory implementation of a
  trait is fine; recording mocks are not.
- `proptest` for properties, `criterion` with `black_box` for benchmarks. Keep
  doctests runnable (use `?` in examples, `#` to hide setup lines).
- For internal apps prefer `src/` unit tests over many `tests/*.rs` binaries;
  use at most one modular integration crate for a real external boundary.
