# Rust testing dialect

How the universal core is spelled in Rust tests.

Runner: `cargo test`.

- Drive the public CLI or application first; put real boundary workflows in
  `tests/`. Group related scenarios into a modular integration crate when useful.
  Reserve `#[cfg(test)]` modules for justified isolated failure coverage.
- `#[tokio::test]` for async, `#[should_panic]` for panic paths.
- Use `tempfile` directories, throwaway Git repositories, and `sqlx::test` for
  Postgres. Drive the real HTTP client against Vercel Emulate when a service double
  is needed, with custom emulators for unsupported or owned APIs.
- `proptest` for properties, `criterion` with `black_box` for benchmarks. Keep
  doctests runnable (use `?` in examples, `#` to hide setup lines).
