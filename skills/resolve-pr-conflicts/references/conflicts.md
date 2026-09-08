# Resolving conflicts

**Textual conflicts.** Read each hunk and combine intent: prose takes the
richer superset, code keeps both sides' additions (two PRs that each add a
function at the same anchor: keep both). For a generated or lock file
(`Cargo.lock`, `package-lock.json`, `poetry.lock`), take the base version and
regenerate from the resolved manifest, then confirm consistency (`npm ci` fails
if a lockfile and manifest disagree).

**Semantic conflicts** (invisible to Git), caught when updating this PR onto a
base branch that already contains other changes:

- **Shared version or sequence constants.** Two PRs must not both claim the
  same bump. If a landed PR took `3 -> 4`, this PR's bump becomes `4 -> 5`.
  Regenerate whatever the change feeds and re-run the affected tests.
- **Migration or numbered-file collisions.** The same numeric prefix on
  different filenames is a clash Git cannot see. Renumber so the prefix does
  not collide with what already landed.
- **Combined-tree build or test breaks.** Two PRs that touch the same module
  in different files can still fail together. The update onto default is where
  you catch that.
- **Mutually dependent PRs.** Merge the library bump first, then the
  call-site, after updating the second onto default. If neither PR is
  mergeable on its own, stop and ask.
