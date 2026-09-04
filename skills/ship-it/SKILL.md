---
name: ship-it
description: Commit and publish a completed change as a pull request, add verification evidence with gh --attach, and drive CI green. Use for "ship it", "commit and open a PR", or "push this and watch CI". CI-only requests must not expand into PR creation or readiness changes.
user-invocable: true
---

# Ship it

For a full shipping request, finish with the change committed, pushed, open as a
ready pull request, and green in CI. Open a new PR as a draft so CI can run while
you verify locally. Mark it ready only after verification succeeds.

A narrower request keeps its scope. For CI-only repair, fix the affected branch
and checks without creating a PR or changing its draft/ready state, base, title,
or unrelated content. For monitoring only, report results without making fixes.
An explicit request to keep a draft takes precedence over the full workflow.

Do not merge the PR unless asked. Pause only for material ambiguity, a required
approval, or a blocker that cannot be resolved with available access.

## Commit the requested work

Work on a feature branch, not the default branch. Stay on the current feature
branch when it owns the change; otherwise follow the repo's naming convention,
or use `agent/` when none exists.

Inspect the diff and working tree. Preserve unrelated user changes and stage
explicit paths. Group related files into logical commits.

Use an imperative subject. Explain the reason for the change where it is not
obvious from the subject. Follow active attribution and punctuation instructions.
Wrap commit bodies around 80 columns, but do not hard-wrap PR paragraphs.
Apply `stop-slop` to Git text.

## Open or reuse the PR

For a full shipping request, push and check for an existing PR:

```sh
gh pr list --state open --head <branch> --json number,title,url,isDraft,baseRefName,headRefName
```

Reuse the existing PR. Do not convert a ready PR back to draft. Otherwise, create
a draft with `gh pr create --draft`. Use the default branch as the base unless
this is a dependent layer in an existing stack or the user specified another base.

Explain why the change is needed and what changed. Reference the originating
issue with `Fixes #<n>` when applicable. Preserve existing context when editing
the body. Do not add labels or reviewers unless requested.

## Verify proportionally

Read the repo's check commands. Run required local checks and the tests that
cover the changed behavior. Generate required code before building.

- Include integration tests when the change reaches that boundary. Confirm
  relevant tests ran rather than silently skipped.
- Existing automated end-to-end tests can supply runtime evidence. Do not repeat
  their coverage manually without a distinct risk to check.
- Use manual interaction for uncovered integration or visual risks. Exercise
  representative affected flows rather than every route sharing a component.
  Check responsive layouts when the change affects them.
- For CLI or API behavior, a focused test or real command/request can supply
  evidence. Choose the method that catches the risk.
- For changes with no runtime surface, state that no runtime capture was needed.
- Report local environment gaps and let CI cover checks that require its platform.

After passing checks, repeat or broaden verification only for new edits, failures,
or unresolved risks. Do not refactor unrelated code to improve the verification
process. Commit and push any necessary fixes.

## Add evidence and mark ready

For a full shipping request, add a Testing section with exact commands, results,
and relevant gaps. Use existing automation output when sufficient.

Inline concise text evidence in a language-tagged fence: `console` for a command
transcript, `json` for JSON, or `text` for other output. Remove secrets and private
data from proof before publishing it.

Attach useful screenshots or recordings with `gh --attach`, not `gh-image`.
Follow [github-image-upload](../github-image-upload/SKILL.md) for supported media,
attachment syntax, and verification. No media is required when text evidence
covers the change. Do not commit proof files.

Invoking this full workflow authorizes adding its proof to the PR. Keep evidence
in the PR body, preserve its existing explanation, and keep any required
attribution footer last.

After local verification, mark the PR ready unless the user asked to keep it a
draft. Skip readiness changes for CI-only requests. Verify the intended PR base,
head, state, and evidence with `gh pr view`.

## Drive CI green

Watch the complete check set so a filtered view cannot hide a failure:

```sh
gh pr checks <n> --watch --interval 20
gh run view <run-id> --log-failed
```

For failures within the request, diagnose, fix, run affected checks, commit, push,
and watch again. Refresh proof when the behavior it documents changes. Preserve
required checks; do not bypass them or claim success when checks failed, were
cancelled, or did not run as expected.

Report unrelated failures rather than expanding the work without direction.
If access or infrastructure blocks progress, identify the blocker and checks
that remain unresolved.

## Report

Link the PR and state its actual readiness and CI results. Summarize meaningful
changes and verification gaps. Say CI is green only when the complete applicable
check set supports that claim.
