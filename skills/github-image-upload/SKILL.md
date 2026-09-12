---
name: github-image-upload
description: Attach requested screenshots or recordings to a GitHub PR, issue, or comment and verify their destination.
license: MIT
compatibility: Requires GitHub CLI (`gh`) 2.99.0 or newer, and network access to GitHub.
allowed-tools: >-
  Glob Bash(gh auth status) Bash(gh --version) Bash(gh pr create:*)
  Bash(gh pr edit:*) Bash(gh pr comment:*) Bash(gh issue create:*)
  Bash(gh issue edit:*) Bash(gh issue comment:*) Bash(gh pr view:*)
  Bash(gh issue view:*)
---

# Attach proof on GitHub

Use `--attach` on `gh pr create`, `edit`, or `comment`, or the corresponding
`gh issue` command. Publication must be authorized by the task. Inline text
evidence in a language-tagged fence; `--attach` accepts images and videos.

Check `gh --version` and authentication if they are not already established.
If the installed CLI lacks `--attach`, continue preparing the proof and report
the version needed. A request to upload proof does not authorize upgrading the CLI.

## Attach to the intended destination

Identify the repository, PR or issue, and whether the destination is its body
or a particular comment. Preserve existing content. Do not commit proof files.

Write a multiline body to a file and pass `--body-file`. An image reference
whose destination matches the attachment path is replaced with the uploaded URL:

```markdown
![Error state](/abs/path/error.png)
```

```sh
gh pr edit <number> -R <owner/repo> --body-file <body-file> --attach '/abs/path/error.png'
```

For an appended attachment, `--attach '/abs/path/error.png#Error state'` supplies
alt text. Repeat the flag for multiple files. Videos render as players when
their image reference has empty alt text and occupies its own paragraph.

## Verify and recover

Read the specific body or comment that the command created or changed. Verify
each requested file has its corresponding uploaded URL in that destination,
using the command result and the attachment's surrounding text. An attachment
elsewhere in the thread does not prove this upload succeeded.

A nonzero exit can still leave a created PR or comment and some uploaded files.
Inspect that result before retrying. Preserve successful uploads, correct a
recoverable error, and edit the existing destination with only the missing
files. Never replay a create or comment command blindly. If the result is
uncertain or access prevents repair, report what succeeded and what remains.

For a private repository, verify with the signed-in account; an anonymous
403 or 404 does not establish failure. Text-only proof needs its intended
fenced content, not an attachment URL.
