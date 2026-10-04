---
name: social-fetch
description: "Read referenced social posts on X, LinkedIn, Instagram, TikTok, Bluesky, Reddit, Mastodon, Threads, or Hacker News. Skip video-host transcript tasks; use reddit for signed-in account actions."
metadata:
  version: 0.1.2
  source: coreyhaines31/makerskills
---

# Social post fetching

Retrieve a referenced post's content. Default to a readable answer with its
source link, author and date when available, and any material coverage limits.
Return normalized JSON when structured data is requested or needed by a caller.

Adapted from Corey Haines's Maker Skills social-fetch. See
[attribution](references/attribution.md).

## Fetch

Identify the platform from the URL or inspect its public destination.
Ask only if it remains ambiguous or inaccessible. YouTube, Loom, Vimeo, and
other video hosts need a transcript or watch workflow. Signed-in Reddit
browsing and actions use the reddit skill.

Read the relevant platform section in [strategies](references/strategies.md).
Try free strategies first; move to the next on an auth wall, failure, or
unusable response. Prefer direct public APIs when supported. For rendered
previews, use the host's available browser tools and the session the user chose.

Paid providers require configured credentials and authorization for that
service in the current task. Preserve authorization across clarifications;
ask before an unapproved paid fallback. Follow [credential guidance](references/auth-keys.md).
Never print credentials or put them in command arguments, URLs, Git, or shell
startup files. Use protected files, a credential store, or stdin.

## Scope and output

Default to the post itself. Include replies, same-author threads, raw payloads,
downloads, or saved files only when requested. The
[output schema and request options](references/output-schema.md) define
structured output and the existing flags.

Unknown fields are null, not zero. Do not invent engagement or missing content.
When a fetch is partial, explain the useful limit. When strategies are exhausted,
state what failed and what access would allow progress without repeatedly
asking for credentials.

If the existing cache is used, its TTL is 24 hours. Skip it for fresh-data,
reply, or thread requests. Private content requires authorized access;
for deleted public posts, an available archive is the remaining option.
