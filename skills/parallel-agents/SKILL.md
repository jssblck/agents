---
name: parallel-agents
description: Coordinate edits when agents share a codebase, resolve shared-file conflicts, or address measured merge hotspots. Also use for maintaining AGENTS.md or CLAUDE.md. Do not impose file splits on ordinary solo changes.
---

# Parallel agents

Keep independently owned work from colliding in shared files. Apply structural
changes when concurrent work or observed conflict history justifies them.

- Give independent behavior its own file when that creates a useful ownership
  boundary. Keep edits to shared registries small. Do not split a cohesive
  module merely to achieve a one-line registration.
- Shape shared lists for merging: one item per line, stable insertion order,
  and no unrelated reformatting. Regenerate generated files and lockfiles.
- Investigate repeated conflict hotspots before splitting them. Keep structural
  moves separate from behavior changes when both are requested.
- Keep agent docs concise: working agreements, non-obvious constraints, and
  useful setup/check entry points. Keep module detail near its owner.

## References

Read only the reference relevant to the task:

- [one-feature-one-file.md](references/one-feature-one-file.md): choosing file
  boundaries for concurrent feature work.
- [mergeable-edits.md](references/mergeable-edits.md): editing shared registries,
  generated files, or conflicting branches.
- [hotspot-audit.md](references/hotspot-audit.md): measuring conflict hotspots
  when an audit or structural repair is requested.
- [doc-gardening.md](references/doc-gardening.md): maintaining agent instructions
  or reducing duplicated documentation.
