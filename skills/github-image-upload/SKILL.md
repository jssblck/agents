---
name: github-image-upload
description: "Use when a GitHub PR, issue, or comment needs screenshots, recordings, test results, or other visual or text evidence."
license: MIT
compatibility: Requires GitHub CLI (`gh`) 2.99.0 or newer, and network access to GitHub.
allowed-tools: >-
  Glob Bash(gh auth status) Bash(gh --version) Bash(gh pr create:*)
  Bash(gh pr edit:*) Bash(gh pr comment:*) Bash(gh issue create:*)
  Bash(gh issue edit:*) Bash(gh issue comment:*) Bash(gh pr view:*)
  Bash(gh issue view:*)
---

# Attach images and videos on GitHub

`--attach` uploads a local image or video on the same command that writes an
issue, pull request, or comment: `gh issue create`, `gh issue edit`,
`gh issue comment`, `gh pr create`, `gh pr edit`, and `gh pr comment`.

`--attach` is for images and videos. Inline text in the body as a fenced code
block with a language tag.

## Prerequisites

1. `gh auth status`: if it fails, tell the user to run `gh auth login`.
2. `gh --version`: needs 2.99.0+. If older, stop and tell the user to upgrade
   (`brew upgrade gh`, or the install they use). Do not upgrade `gh` yourself.

## Attach

State the image and video files and the destination, then attach. Quote
`--attach` values. `--attach` accepts png, jpg, jpeg, gif, webp, svg, mp4, mov,
and webm.

If you are writing the body, put a Markdown image whose destination is the
same path you pass to `--attach`. `gh` rewrites that path to a
`user-attachments` URL and keeps the alt text from the Markdown:

```sh
gh pr comment 13 --body "$(cat <<'EOF'
The error state:

![Error state](/abs/path/error.png)
EOF
)" --attach '/abs/path/error.png'
```

A video renders as a player only when its image reference is the whole
paragraph, with empty alt: `![](/abs/path/walkthrough.mp4)`.

If you are not rewriting the body, `--attach` alone appends:

```sh
gh pr comment 13 --attach '/abs/path/shot.png#The login error state'
gh pr edit 13 --attach '/abs/path/shot.png#The login error state'
```

`#` alt on the flag applies only when the body does not already reference the
file. Repeat `--attach` for each file.

If attach fails, stop and tell the user. Partial success still creates or
updates the item and prints its URL, then exits non-zero: treat that as
failure until every intended file is present.

Do not commit the attached files.

## Text

Inline a transcript, log, or other text in the body as a fenced code block.
Set the language to match the content: `console` for a shell transcript,
`json` for JSON, `diff` for a diff, `text` when nothing else fits. Do not pass
text files to `--attach`.

````markdown
```console
$ pnpm test
PASS  src/foo.test.ts
```
````

## Verify

After `--attach`, count matches instead of printing the body. Expect at least 1
(use `gh issue view <n>` for issues):

```sh
gh pr view <pr> --repo owner/repo --json body,comments \
  -q '[.body] + [.comments[].body] | join("\n")' | grep -c 'user-attachments'
```

0 means the attach failed. Re-run the attach command. On a private repo the
URL renders only for authorized viewers; an anonymous 404/403 is expected.

When the proof is only inlined text, confirm the language-tagged fence is in
the body. A missing `user-attachments` URL is not a failure if you did not
attach media.
