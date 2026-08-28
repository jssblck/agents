# Python testing dialect

How the universal core is spelled in Python tests.

Runner: `pytest`.

- pytest. Plain `assert`, fixtures via `@pytest.fixture`, `tmp_path` for temp
  dirs, `@pytest.mark.parametrize` for table-style cases (the Python form of
  table-driven tests).
- **Avoid `unittest.mock` of your own code.** Patching internal functions pins
  the implementation and rots. Prefer real objects, real `tmp_path`, a real
  in-memory fake you wrote, `responses`/`respx` or a local server for HTTP, a
  real test DB. Reserve mocking for genuine external services, and prefer a
  contract test against the real thing.
- `hypothesis` for property-based testing (excellent, use it where inputs have
  invariants or round-trips). `pytest-asyncio` for async tests.
- Determinism: `freezegun` or an injected clock for time; seed randomness;
  never `time.sleep` to synchronize, use the actual completion signal.
  `monkeypatch` the environment, not global state mutation.
