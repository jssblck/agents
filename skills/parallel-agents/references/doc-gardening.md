# Doc gardening

Keep instructions useful to a fresh reader without duplicating the repository.
Reduce shared-doc churn when it causes conflicts; do not delete useful guidance
merely because a tool can rediscover it.

## What belongs where

AGENTS.md and CLAUDE.md hold working agreements, non-obvious constraints, and
concise entry points for setup and validation.

- Record intent and lessons that change an agent's decisions: why an obvious
  approach fails, an invariant, or a recurring failure.
- Keep the canonical setup and check commands easy to find. A short command
  remains useful even when it also appears in package scripts.
- Point to relevant module documentation rather than copying its detail.
- Avoid exhaustive file inventories, duplicated command help, and task status.

README and user guides explain concepts and common workflows. Keep enough
examples and commands for a reader to use the product without reconstructing
the intended procedure from source code.

## Decide what to keep

Ask whether the text saves meaningful discovery work or prevents a likely
mistake. Prefer a concise entry point or link when a maintained source already
contains the detail.

Do not reproduce full flag lists or directory trees that add no explanation.
Discoverability alone is not a reason to delete a setup step, test command,
or useful example.

## Prune within scope

Remove stale or duplicated guidance when maintaining the relevant document.
Remove a historical constraint when the underlying limitation is gone.
Do not delete progress files, plans, or user-maintained checklists merely
because they are not suitable for AGENTS.md.

Keep the root instructions stable. Put specialized guidance near the module
it governs, and update the root only when shared expectations or entry points
change.
