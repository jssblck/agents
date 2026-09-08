---
name: merge-open-prs
description: "Use when asked to merge all open PRs or land a specified set of PRs together."
user-invocable: true
---

# Merge the open PRs

Snapshot the open PRs. That list is the work set. Merge each PR through the
forge, one at a time, in an order that keeps later PRs updateable onto the
default branch. Do not assemble independent PRs into a stack or replace the
work set with one combined PR.

Standing rules:

- **The work set does not grow.** A PR opened after the snapshot is ignored.
  After every merge, compare remaining open PRs to the work set; never merge
  extras.
- **A default-branch move is in scope.** After each merge the default branch
  has moved. Update the next PR onto it, resolve, and re-verify before merging.
- **Every PR lands through the forge.** Never merge into a local default branch
  and push, and never push straight to the default branch. Do local git work
  only on the PRs' own branches, in a temporary worktree you remove afterwards.

## 1. Snapshot the work set

```sh
gh api --paginate 'repos/{owner}/{repo}/pulls?state=open&per_page=100' \
  --jq '.[] | {number,title,headRefName:.head.ref,headRefOid:.head.sha,baseRefName:.base.ref,isDraft:.draft}'
```

Read every page. If the user named specific PRs, those are the work set;
otherwise every open PR is. Record numbers, head SHAs, and head branches.

For anything but a single obvious PR, build a file-overlap map:

```sh
gh pr view <n> --json files,headRefName,headRefOid,baseRefName,isDraft,reviewDecision,statusCheckRollup,isCrossRepository,maintainerCanModify
gh pr diff <n>
```

An unready PR (draft, requested changes) stays in the work set. Make it
mergeable; do not drop it, and do not merge over unanswered requested
changes without user direction.

If the work set is empty, stop.

## 2. Choose the merge order

Files-disjoint PRs cannot conflict textually in any order, so order for
semantics and verifiability. In priority order:

- Small, isolated PRs first (config tweaks, dependency bumps, tooling that
  helps verify later PRs).
- Foundational before dependent: when one PR calls what another adds, merge
  the dependency first.
- Shared-state PRs last: a version constant, migration number, or checked-in
  generated artifact compounds with everything already landed.
- Otherwise by blast radius, smallest first.

If a PR's base is another work-set PR, merge the parent first. An existing
base chain is evidence for that order. A user-stated order wins. State the
order and a one-line reason per PR before you start.

## 3. Know the gate

```sh
gh repo view --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed
gh api repos/{owner}/{repo}/branches/{branch}/protection   # may 404 even when gated
gh api repos/{owner}/{repo}/rulesets
```

Pass the repo's merge method explicitly on `gh pr merge`. Rulesets and classic
protection are separate; check both for required checks, required reviews, and
strict up-to-date policy.

## 4. Merge each PR

Work in a temporary worktree. For each PR in order:

1. Fetch. Record the default-branch tip.
2. If this PR's base is another work-set PR, wait until that parent has
   merged. Retarget with `gh pr edit <n> --base <default-branch>` when GitHub
   has not already.
3. Update the PR branch onto the current default. Resolve conflicts on that
   branch with [resolve-pr-conflicts](../resolve-pr-conflicts/SKILL.md).
   Confirm `isCrossRepository` and
   `maintainerCanModify` match the remote you will update. Get explicit
   approval before rewriting a branch you do not own, and disclose every
   rewrite.
4. Push the update. Drafts block: `gh pr ready` first, with user direction
   where the draft was deliberate.
5. Verify with the repo's own checks on this PR: build, format, lint, and the
   tests for its blast radius. Wait until every required check on this PR is
   green using [babysit](../babysit/SKILL.md). If the PR cannot be made
   mergeable on the current default, stop and ask.
6. Re-read the head SHA and the default-branch tip. If either moved since
   verification, update and re-verify. Then:

```sh
gh pr view <n> --json headRefOid
gh pr merge <n> <verified-method-flag> --delete-branch --match-head-commit <sha>
```

A merge queue queues the PR and picks its own method; wait until it lands
before starting the next PR.

If a teammate pushes to a work-set branch or closes a work-set PR, stop and
ask. If someone merges a work-set PR to the default branch, that is a trunk
move: continue with the remaining PRs.

`--admin` only with explicit approval, disclosed in the report.

After the last merge, run the full suite on the actual default branch and
confirm integration tests ran rather than skipped. Remove the worktree.

## 5. Report

1. Work-set PRs, PRs ignored as later arrivals, and whether files overlapped.
2. Merge order with a reason each. Any work-set PR not merged, and why.
3. Conflicts resolved, branches rewritten, any bypass.
4. Default-branch moves and what you did about them.
5. What you ran and what passed, including on the final default branch.
6. Final default-branch SHA and remaining open PRs.

If the request chains a release, use `$tag-release` after CI is green on the
merged commit.
