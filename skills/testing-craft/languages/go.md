# Go testing dialect

How the universal core is spelled in Go tests.

Runner: `go test ./...`; always `go test -race` in CI.

- **Table-driven tests** are the Go idiom:
  ```go
  tests := []struct{ name, in, want string }{ ... }
  for _, tt := range tests {
      t.Run(tt.name, func(t *testing.T) { /* got := f(tt.in); compare */ })
  }
  ```
- Standard `testing` package; `t.Run` for subtests, `t.Helper()` in helpers,
  `t.TempDir()`/`t.Cleanup()` for fixtures. `testify/require` is acceptable
  for assertions; do not pull in heavy frameworks.
- Unit-test pure functions directly, and service logic with small fakes that
  implement the consumer's interface. At the integration rung, use real
  databases and temporary directories, and the real Go HTTP client against
  Vercel Emulate, including custom APIs.
- Property tests via `testing/quick` or `gopter`. Fuzz tests with `go test
  -fuzz`. Benchmarks with `testing.B` and `b.N`.
- Determinism: inject the clock and randomness; never `time.Sleep` to
  synchronize (use channels/WaitGroup).
