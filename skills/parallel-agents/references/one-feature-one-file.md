# File boundaries for parallel work

Separate independently owned behavior when concurrent edits or observed
conflicts justify it. A file split should improve ownership or cohesion, not
satisfy a fixed line count.

## Recognize a shared-file hotspot

Look for unrelated work repeatedly touching the same dispatcher, registry,
router, stylesheet, test entry point, or root instruction file. File size alone
does not establish a conflict problem.

When a feature has a distinct owner, keep its body in a focused module and its
registration in the shared file. A small registration often merges cleanly,
but one line is a useful shape rather than a requirement.

## Choose a boundary

- CLI: a command handler can live separately from command registration.
- HTTP: group handlers by resource or behavior; keep routing concise.
- UI: keep page-specific components and styles near their page.
- Tests: follow the behavior's ownership. Add cases to an existing cohesive suite
  when that is clearer than creating another file.

Follow the project's layout. Do not split a small cohesive module or create
one-function files merely because parallel agents are available.

## Shared plumbing

Some changes need edits across a shared boundary. Keep them scoped and follow
[mergeable-edits.md](mergeable-edits.md) for generated files and conflict handling.
Propose an independent structural refactor rather than adding it to a bug fix
solely to prevent hypothetical future conflicts.
