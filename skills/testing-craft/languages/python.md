# Python testing dialect

How the universal core is spelled in Python tests.

Runner: `pytest`.

- pytest. Plain `assert`, fixtures via `@pytest.fixture`, `tmp_path` for temp
  dirs, `@pytest.mark.parametrize` for table-style cases (the Python form of
  table-driven tests).
- **Type doubles against the real interface:** a fake that implements the
  `Protocol`, or `create_autospec(real, spec_set=True)`. Patch at a seam, never
  the unit under test or its internal helpers. At the integration rung, use
  `tmp_path`, real test databases, and the real SDK or HTTP client against
  Vercel Emulate, including custom emulators for unsupported or owned APIs.
- `hypothesis` for property-based testing (excellent, use it where inputs have
  invariants or round-trips). `pytest-asyncio` for async tests.
- Determinism: `freezegun` or an injected clock for time; seed randomness;
  never `time.sleep` to synchronize, use the actual completion signal.
  `monkeypatch` the environment, not global state mutation.
