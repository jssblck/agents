---
name: reddit
description: "Browse Reddit or perform explicitly requested account actions through the existing signed-in Chrome session."
---

# Reddit in signed-in Chrome

Use the host's page-level browser tools on the existing Chrome profile on the
machine selected for the task. Confirm the signed-in account before reading or
acting; do not switch accounts. If logged out, ask the user to sign in there.

## Direct URLs

- Inbox: https://old.reddit.com/message/inbox
- Unread: https://old.reddit.com/message/unread
- Mentions: https://old.reddit.com/message/mentions
- User: the signed-in profile from the account menu
- Front: https://old.reddit.com/{hot|new|rising|top}
- Listing: https://old.reddit.com/r/{sub}/{hot|new|rising|top}
- Search: https://old.reddit.com/search?q={query}
- Sub search: https://old.reddit.com/r/{sub}/search?q={query}&restrict_sr=on
- Thread: https://old.reddit.com/r/{sub}/comments/{id}/

"Check reddit" is read-only. Report relevant titles, permalinks, authors, and
asks; do not dump whole pages unless requested.

Comment, submit, vote, or message only with explicit authorization in the
current task. Authorization persists through clarifications unless changed or
withdrawn. After a write, report the permalink or on-page error.

Do not copy cookies, tokens, or profile files, use an HTTP client with a copied
session, attach a debugger to Chrome, or launch another browser with a copied
profile. Do not create Reddit apps or accounts, use oauth.reddit.com or script
apps, or use ~/.reddit/credentials.
