---
name: database-craft
description: "Use when designing Postgres schemas, constraints, queries, transactions, staging, or background jobs, or reviewing database code."
user-invocable: true
argument-hint: "[target]"
---

# Database craft

The database holds state; the application holds logic. Postgres enforces
structure, each action runs as one statement whose own locks make it atomic, a
derived value is written with its input, and jobs do the rest.

These rules assume Postgres. Follow the project's database policy where it is
stricter, and its migration tooling for schema changes. Ask before introducing a
pattern these rules ban, such as a trigger, a manual lock, or a serializable
transaction; restructure first.

## Structure in the database, values in the parser

Postgres owns structural integrity. Use:

- Primary keys, foreign keys, `NOT NULL`, and uniqueness, including partial
  unique indexes such as one active subscription per member.
- `EXCLUDE` constraints for structural conflicts such as overlapping ranges.
- Compound foreign keys that carry the owner, so a child row cannot point at
  another tenant's parent.

Do not add `CHECK` expressions (patterns, ranges, allowed values). Value rules
belong to the application's boundary parser, which already proves them at a
stronger rung; see code-craft's
[parse, don't validate](../code-craft/principles/parse-dont-validate.md). Each
rule has one owner.

Parse write inputs before the write, in the layer every caller shares. Routes,
jobs, CLI commands, and webhooks then cannot bypass the contract.

## One action, one statement

Make each action a single statement, so the row locks Postgres takes for that
statement are the only coordination it needs. Fold permission and ownership
checks into the statement that reads or writes, so the check and the action
cannot separate:

```sql
WITH allowed AS (
  SELECT d.id
  FROM documents d
  JOIN memberships m
    ON m.organization_id = d.organization_id AND m.user_id = $2
  WHERE d.id = $1 AND m.role IN ('owner', 'editor')
)
UPDATE documents
SET title = $3, updated_at = now()
FROM allowed
WHERE documents.id = allowed.id
RETURNING documents.*;
```

No row back means not found or not permitted; the caller maps it to one error.
Use `INSERT ... ON CONFLICT` for idempotent writes, and let a unique index decide
which concurrent writer wins.

An action that must also update a derived value or enqueue a job may run as a
short transaction of such statements; see [No triggers](#no-triggers) and
[No reconciliation queues](#no-reconciliation-queues).

## Use locks; do not manage them

Locking is how a relational database works, and designing around it is
encouraged. The test is whether a lock lives inside the statement that does the
work.

- **Allowed:** locks taken as a side effect of the working statement, such as a
  `FOR UPDATE SKIP LOCKED` claim feeding an `UPDATE`, `ON CONFLICT` upserts, and
  unique-index arbitration. Setting `lock_timeout` only bounds a wait.
- **Banned:** a lock taken as its own step to coordinate later steps: `LOCK
  TABLE`, advisory locks, and a standalone `SELECT ... FOR UPDATE` that holds rows
  while the application works and writes in a later round trip.

A queue claim is one statement:

```sql
WITH next AS (
  SELECT id
  FROM tasks
  WHERE status = 'pending'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
UPDATE tasks
SET status = 'in_progress', started_at = now()
FROM next
WHERE tasks.id = next.id
RETURNING tasks.*;
```

Do not introduce `SERIALIZABLE` transactions. Single-statement actions and the
staging pattern below remove the need. Ordinary transactions are fine. An existing
one stays until a restructuring protects what it protected.

### Removing a serializable transaction or a manual lock

Restructure the write; do not fence it. Each action becomes one statement whose
`WHERE` clause or a constraint re-asserts the facts it depends on, using unique,
exclusion, and foreign key constraints, `INSERT ... ON CONFLICT`, a conditional
`UPDATE ... WHERE ... RETURNING`, compare-and-set on the row being changed, or a
job enqueued in the writer's transaction for follow-up work that must see the
committed state.

A `WHERE` clause protects facts about the rows its statement writes. A fact about
other rows does not survive concurrency: two on-call doctors can each leave
because each saw the other still on call. Hold such an invariant in a constraint,
or keep its data on one row and change it with a conditional update, such as
`UPDATE shifts SET on_call = on_call - 1 WHERE id = $1 AND on_call > 1`. If no
restructuring protects the invariant, keep the existing protection and ask the
owner.

List what the old code guaranteed and keep what a user would notice. A guarantee
the isolation level happened to provide is not a requirement by default; ask the
owner before dropping or changing a user-visible one.

Do not rebuild serializability by hand. Without the owner's approval, add none
of: revision counters on rows other than the one being written, commit hooks that
bump or validate, capture-then-validate guards, replay or deadlock retry loops
(let the job queue retry, or return a retryable error), one-row-per-parent side
tables, or deploy and drain orderings.

Removing the isolation option alone is not a fix. Check the outer transaction
and nested callers, keep savepoint rollback and cancellation working, and keep
network and model calls outside transaction bodies.

## Multi-step operations

Upsert directly into the canonical table when a partial result is safe to
expose. Otherwise stage:

1. Create a staging table for the operation: a regular table with a fixed prefix
   and the operation's hash or timestamp, such as `staging_contacts_3f9a2c`. It
   survives connection pooling and accepts `COPY`. Build its name from a
   generated token and quote it as an identifier.
2. Fill it over as many statements as needed.
3. Move the rows into their canonical table in one statement.
4. Drop the staging table once the move succeeds.

```sql
INSERT INTO contacts (organization_id, external_id, name)
SELECT organization_id, external_id, name
FROM staging_contacts_3f9a2c
ON CONFLICT (organization_id, external_id) DO UPDATE SET name = excluded.name;
```

A `TEMP` table is acceptable when the whole operation fits in one transaction on
one connection. A crashed operation leaves its staging table behind; a periodic
job drops prefixed tables older than the longest operation.

## No triggers

Do not put logic in the database. A derived value that must stay current with
its input, such as a last-activity time or a cached flag, is written by the code
path that changes the input, in the same transaction, through one shared
function per derived value. Every writer reaches that function, so none can
forget it, and the value commits or rolls back with its input.

Joint commit does not make the value fresh. Write it with an update that is
correct in any order, using only the row's own columns: a monotonic expression
such as `last_activity_at = GREATEST(last_activity_at, $1)` or arithmetic such as
`reply_count = reply_count + 1`. A value recomputed from other rows, such as a
count of children, can be computed from a snapshot that misses a concurrent
writer's rows; recompute it in a job keyed by the record instead (see below).
Writing the input, its derived value, and a job in one short transaction is
fine; keep that work small on rows many writers share.

Work that is slow, calls a provider, reads other rows, or spans many rows
becomes a job instead (see below). Without a database-backed queue, the job polls for its condition,
optionally woken by `LISTEN`/`NOTIFY`. Send `pg_notify` in the transaction that
writes the row, so it is delivered only on commit. A notification is lost when
nobody is listening, so it is a wake-up hint; the poll guarantees the work.

## No reconciliation queues

Do not track pending work in a work, inbox, or outbox table. Either enqueue the
work with the write that creates it, or derive it from state.

When the job queue lives in the same Postgres database (pg-boss, graphile-worker,
River), enqueue the follow-up through the writer's transaction connection, in
the transaction that creates the rows the job reads, so the job and its rows
commit or roll back together. Enqueue ids, not rows, and key each job by the
record it acts on, so repeated writes collapse into one pending job.

- Deduplicate against pending jobs only. A write that commits while a job for the
  same record is running must still get a run after it; check what the queue's
  uniqueness rule covers, since some include running or completed jobs.
- Jobs run at least once. The handler reads current state when it runs and makes
  repeated execution safe. A database effect is idempotent, or commits together
  with a completion marker. An external effect needs a provider idempotency key
  or an operation id the handler can look up before trying again; without one,
  record that the outcome is unknown instead of repeating the effect.
- A late run must not overwrite newer output. Every input writer advances a
  version in its own transaction; the output row stores the input version it was
  computed from, and the publishing upsert writes only a newer one
  (`ON CONFLICT ... DO UPDATE ... WHERE outputs.source_version < excluded.source_version`).
  Checking the input row's version from the publishing statement is not enough,
  since that row is not the one being written.

Derive pending work from state for a backfill, for work whose job was lost or
exhausted its retries, and as the primary mechanism when the queue lives outside
the database. A periodic job selects the oldest rows whose derived state is
missing or older than its input, does the work, upserts the result, and exits;
the same query serves the backfill and the steady state.

```sql
SELECT m.id, m.storage_key
FROM media m
LEFT JOIN thumbnails t ON t.media_id = m.id
WHERE t.media_id IS NULL
ORDER BY m.thumbnail_attempted_at NULLS FIRST, m.created_at
LIMIT 100;
```

- Index the "missing" condition so the scan stays cheap.
- End the work in the same version-guarded upsert, so an overlapping or late run
  cannot replace newer output. Claim rows with `SKIP LOCKED` only when duplicate
  work is expensive.
- Record a failed attempt on the row, as `thumbnail_attempted_at` does above, so
  a row that always fails cannot hold the front of the window.

## Proofs and the database

A proof parameter is evidence that a check passed at one moment; see code-craft's
[proof parameters](../code-craft/principles/proof-parameters.md). The statement
that acts re-asserts the fact in its own `WHERE` or CTE, or a constraint holds
it. A `WHERE` clause holds only facts about the rows its statement writes; see
[Removing a serializable transaction or a manual lock](#removing-a-serializable-transaction-or-a-manual-lock)
for facts about other rows. These are two invariants with two owners: the proof owns "this code path ran
the check", and the statement or constraint owns "the write happened only while
the fact held".

## Verify

- Prove queries, constraints, jobs, and migrations against real Postgres; see
  [testing-craft](../testing-craft/SKILL.md). Test a constraint with the write it
  must refuse. Never fake the database to test SQL.
- Where the project has a migration or SQL policy check, have it refuse new
  `CHECK` expressions, `CREATE TRIGGER`, `LOCK TABLE`, advisory locks, and
  `SERIALIZABLE`, and inventory the existing locks and serializable requests in a
  list that only shrinks. A check that fails the gate outranks review.
