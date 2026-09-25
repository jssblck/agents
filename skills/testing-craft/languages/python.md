# Python testing dialect

How the universal core is spelled in Python tests.

Runner: `pytest`.

- pytest. Plain `assert`, fixtures via `@pytest.fixture`, `tmp_path` for temp
  dirs, `@pytest.mark.parametrize` for table-style cases (the Python form of
  table-driven tests).
- **Avoid `unittest.mock` of your own code.** Patching internal functions pins
  the implementation and rots. Prefer real objects, `tmp_path`, and real test
  databases. For service doubles, drive the real Python SDK or HTTP client against
  Vercel Emulate, including custom emulators for unsupported or owned APIs.
- `hypothesis` for property-based testing (excellent, use it where inputs have
  invariants or round-trips). `pytest-asyncio` for async tests.
- Determinism: `freezegun` or an injected clock for time; seed randomness;
  never `time.sleep` to synchronize, use the actual completion signal.
  `monkeypatch` the environment, not global state mutation.
