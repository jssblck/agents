---
name: reddit
description: >
  Read and act on Reddit through the signed-in Chrome session on the
  shared computer. Use page-level browser tools only. Open old.reddit.com
  URLs for inbox, user, listings, search, and threads. Write (comment,
  post, vote, message) only when the user explicitly asks.
---

# Reddit (signed-in Chrome)

Drive the shared computer's Chrome profile where the user is already
signed in. Use page-level browser tools only (browserUse on Grok Bot).

Confirm the account menu shows a signed-in user before you do anything
else. If Chrome is logged out, stop and have them sign in on that
Chrome. Do not invent a workaround. Act as whatever account is signed
in. Do not switch accounts.

## Direct URLs

Open these. Do not click through the site to rebuild them.

- Inbox: https://old.reddit.com/message/inbox
- Unread: https://old.reddit.com/message/unread
- Mentions: https://old.reddit.com/message/mentions
- User: the signed-in profile from the account menu
- Front: https://old.reddit.com/{hot|new|rising|top}
- Listing: https://old.reddit.com/r/{sub}/{hot|new|rising|top}
- Search: https://old.reddit.com/search?q={query}
- Sub search: https://old.reddit.com/r/{sub}/search?q={query}&restrict_sr=on
- Thread: https://old.reddit.com/r/{sub}/comments/{id}/

## Read (default)

"Check reddit" is read-only. Open the URL, read the page, report titles,
permalinks, authors, and the specific ask. Do not dump the whole page
unless they want it.

## Write (explicit ask only)

Do not comment, submit, vote, or message unless the current message
clearly asks for that action. After a write, report the permalink or
the on-page error.

## Forbidden

- Copying cookies, tokens, or profile files out of Chrome
- curl or any HTTP client with a copied session
- oauth.reddit.com, script apps, or ~/.reddit/credentials
- Attaching a debugger to Chrome or launching a second browser that
  copies the signed-in profile
- Creating a Reddit app or a new account

## What to tell them

- Read results: titles, permalinks, authors, and the specific ask.
- Write results: the permalink or the on-page error.
- Logged out: Chrome is not signed in. They need to sign in on the
  shared computer.
