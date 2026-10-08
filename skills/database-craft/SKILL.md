---
name: database-craft
description: "Use when designing Postgres schemas, constraints, queries, transactions, staging, or background jobs, or reviewing database code."
user-invocable: true
argument-hint: "[target]"
---

# Database craft

The database holds state; the application holds logic. Postgres enforces
structure, each action runs as one statement whose own locks make it atomic, and
jobs derive everything else by construction.

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

Do not use `SERIALIZABLE` transactions. Single-statement actions and the staging
pattern below remove the need. Ordinary transactions are fine.

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

Do not put logic in the database. Work a trigger would do becomes a job that
polls for its condition, optionally woken by `LISTEN`/`NOTIFY`. Send
`pg_notify` in the transaction that writes the row, so it is delivered only on
commit. A notification is lost when nobody is listening, so it is a wake-up
hint; the poll guarantees the work.

## No reconciliation queues

Derive pending work from state instead of tracking it. A periodic job selects
the oldest rows that lack the derived state, does the work, upserts the result,
and exits. The same job performs the backfill and the steady-state work.

```sql
SELECT m.id, m.storage_key
FROM media m
LEFT JOIN thumbnails t ON t.media_id = m.id
WHERE t.media_id IS NULL
ORDER BY m.thumbnail_attempted_at NULLS FIRST, m.created_at
LIMIT 100;
```

- Index the "missing" condition so the scan stays cheap.
- End the work in an idempotent upsert, so overlapping runs are harmless. Claim
  rows with `SKIP LOCKED` only when duplicate work is expensive.
- Record a failed attempt on the row, as `thumbnail_attempted_at` does above, so
  a row that always fails cannot hold the front of the window.

## Proofs and the database

A proof parameter is evidence that a check passed at one moment; see code-craft's
[proof parameters](../code-craft/principles/proof-parameters.md). The statement
that acts re-asserts the fact in its own `WHERE` or CTE, or a constraint holds
it. These are two invariants with two owners: the proof owns "this code path ran
the check", and the statement or constraint owns "the write happened only while
the fact held".

## Verify

- Prove queries, constraints, jobs, and migrations against real Postgres; see
  [testing-craft](../testing-craft/SKILL.md). Test a constraint with the write it
  must refuse. Never fake the database to test SQL.
- Where the project has a migration or SQL policy check, put these bans in it:
  `CHECK` expressions, `CREATE TRIGGER`, `LOCK TABLE`, advisory locks, and
  `SERIALIZABLE`. A check that fails the gate outranks review.
